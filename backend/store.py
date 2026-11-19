"""In-memory cache over Postgres.

The app stays fast in-session (everything hot in memory) and survives
restarts (anything missing is rehydrated from the database: the raw bytes
are re-parsed with the same code path as an upload, and prepared runs are
recomputed deterministically from the stored config).

The app works with the database down — uploads still train — but writes
are not saved, and every response says so by setting `persisted: false`.
"""

import json
import logging
import pickle
import uuid
from collections import OrderedDict

import pandas as pd
from fastapi import HTTPException

import db
from csvio import clean_frame, parse_csv
from preprocessing import PreprocessConfig, prepare

logger = logging.getLogger("ml_playground.store")

MAX_DATASETS = 20  # keep memory bounded: oldest datasets are dropped first
_store: "OrderedDict[str, dict]" = OrderedDict()
_prepared: dict[str, object] = {}
# dataset_id -> model_id -> trained bundle
_models: dict[str, dict[str, dict]] = {}

_db_up: bool | None = None


def _db() -> bool:
    """Probe once per process, then remember."""
    global _db_up
    if _db_up is None:
        _db_up = db.health()
        if not _db_up:
            logger.warning("database unreachable; runs will not be saved")
    return _db_up


def save_dataset(raw: bytes, name: str, rows: int, n_columns: int) -> tuple[str, bool]:
    """Store the original bytes and cache the cleaned frame.

    Returns the dataset id and whether the database accepted it. When the
    database is down the app still works in memory, and the caller shows
    the user that their data will not survive a restart.
    """
    dataset_id = uuid.uuid4().hex[:12]
    df, _note = parse_csv(raw)
    df = clean_frame(df)
    _store_put(dataset_id, df, name)
    persisted = False
    if _db():
        try:
            db.save_dataset(dataset_id, name, raw, rows, n_columns)
            persisted = True
        except Exception:
            logger.exception("could not save dataset %s to database", dataset_id)
    return dataset_id, persisted


def _store_put(dataset_id: str, df: pd.DataFrame, name: str) -> None:
    _store[dataset_id] = {"df": df, "name": name}
    while len(_store) > MAX_DATASETS:
        old_id, _ = _store.popitem(last=False)
        _prepared.pop(old_id, None)
        _models.pop(old_id, None)


def get_dataset(dataset_id: str) -> dict:
    entry = _store.get(dataset_id)
    if entry is not None:
        return entry
    if _db():
        row = db.fetch_dataset(dataset_id)
        if row is not None:
            try:
                df, _note = parse_csv(row["bytes"])
                df = clean_frame(df)
            except ValueError as err:
                logger.error("stored dataset %s will not re-parse: %s", dataset_id, err)
                raise HTTPException(
                    status_code=500,
                    detail="The stored copy of this dataset could not be read.") from err
            _store_put(dataset_id, df, row["name"])
            return _store[dataset_id]
    raise HTTPException(
        status_code=404, detail="Dataset not found. Please upload it again.")


def save_prepared(dataset_id: str, prepared, config: PreprocessConfig) -> None:
    _prepared[dataset_id] = prepared
    # Models trained on the old split are stale now, so forget them
    _models.pop(dataset_id, None)
    if _db():
        try:
            db.save_prepare_run(
                dataset_id,
                json.loads(config.model_dump_json()),
                prepared.task,
            )
        except Exception:
            logger.exception("could not save prepare config for %s", dataset_id)


def get_prepared(dataset_id: str):
    prepared = _prepared.get(dataset_id)
    if prepared is not None:
        return prepared
    if _db():
        cfg_dict = db.fetch_prepare_config(dataset_id)
        if cfg_dict is not None:
            # Recomputing is deterministic (same file, same seed), so a
            # restarted server reproduces the exact same split.
            entry = get_dataset(dataset_id)
            prepared, _summary = prepare(
                entry["df"], PreprocessConfig(**cfg_dict))
            _prepared[dataset_id] = prepared
            return prepared
    raise HTTPException(
        status_code=409, detail="Prepare this dataset first (Step 5).")


def save_model(dataset_id: str, model_id: str, bundle: dict) -> tuple[int | None, bool]:
    """Pickle the predictor and record the run. Returns (run_id, persisted)."""
    _models.setdefault(dataset_id, {})[model_id] = bundle
    run_id = None
    persisted = False
    if _db():
        try:
            model_bytes = _pickle(bundle.get("predictor") or bundle.get("model"))
            result = dict(bundle["result"])
            # The pickle bytes never leave the server; keep the JSON clean.
            result.pop("_model", None)
            run_id = db.save_train_run(
                dataset_id=dataset_id,
                model_id=model_id,
                label=result.get("label", model_id),
                task=result.get("task", ""),
                tune=bool(result.get("tuned")),
                result=result,
                model_bytes=model_bytes,
            )
            persisted = True
        except Exception:
            logger.exception("could not save training run for dataset %s", dataset_id)
    return run_id, persisted


def _pickle(model) -> bytes | None:
    if model is None:
        return None
    try:
        return pickle.dumps(model)
    except Exception:
        logger.warning("model %s will not pickle; run saved without it",
                       type(model).__name__)
        return None


def get_model(dataset_id: str, model_id: str) -> dict:
    bundle = _models.get(dataset_id, {}).get(model_id)
    if bundle is not None:
        return bundle
    # Rehydrate from a previous run of the same model on the same dataset.
    if _db():
        payload = db.fetch_latest_model(dataset_id, model_id)
        if payload is not None:
            try:
                loaded = pickle.loads(payload)
            except Exception as err:
                logger.error("stored model will not unpickle: %s", err)
                raise HTTPException(
                    status_code=409,
                    detail="The stored model could not be loaded. Train it again.") from err
            if isinstance(loaded, dict) and "pipeline" in loaded:
                predictor = loaded
                bundle = {
                    "model": predictor["pipeline"].named_steps.get("model"),
                    "predictor": predictor,
                    "result": None,
                }
            else:
                # Runs saved before predictors were stored still have a model.
                bundle = {"model": loaded, "result": None}
            _models.setdefault(dataset_id, {})[model_id] = bundle
            return bundle
    raise HTTPException(
        status_code=409, detail="Train this model first (Step 6).")


def list_runs(limit: int = 10) -> list[dict] | None:
    if not _db():
        return None
    try:
        return db.list_train_runs(limit)
    except Exception:
        logger.exception("could not list runs")
        return None


def get_run(run_id: int) -> dict | None:
    if not _db():
        return None
    try:
        return db.fetch_train_run(run_id)
    except Exception:
        logger.exception("could not fetch run %s", run_id)
        return None


# ---- test hook ---------------------------------------------------------

def _reset_memory() -> None:
    """Drop all in-memory state. Used by tests to prove DB rehydration."""
    _store.clear()
    _prepared.clear()
    _models.clear()
