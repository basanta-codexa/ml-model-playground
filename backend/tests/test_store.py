"""Tests for the store's Postgres-backed save/rehydrate paths.

Each test throws away the in-memory caches with ``_reset_memory()`` and then
reads the data back through the normal getters, proving the bytes really came
from Postgres rather than from a leftover Python object.
"""

import pickle

import numpy as np
import pytest
from sklearn.utils.validation import check_is_fitted

import db
import samples
import store
from preprocessing import PreprocessConfig, prepare
from trainer import train_model


@pytest.fixture
def clean_store():
    store._reset_memory()
    yield
    store._reset_memory()


def _iris_bytes():
    """A small real dataset as the raw CSV bytes an upload would produce."""
    df = samples.build_sample("iris")
    return df.to_csv(index=False).encode("utf-8"), df.shape[0], df.shape[1]


def test_save_dataset_persists_and_rehydrates(require_db, clean_store):
    raw, rows, n_columns = _iris_bytes()
    dataset_id, persisted = store.save_dataset(raw, "Iris flowers", rows, n_columns)
    assert persisted is True

    original = store.get_dataset(dataset_id)
    original_shape = original["df"].shape
    assert original_shape == (rows, n_columns)

    # Nothing left in memory: the only copy is the row in Postgres.
    store._reset_memory()
    rehydrated = store.get_dataset(dataset_id)
    assert rehydrated["name"] == "Iris flowers"
    assert rehydrated["df"].shape == original_shape


def test_save_prepared_rehydrates_the_same_split(require_db, clean_store):
    raw, rows, n_columns = _iris_bytes()
    dataset_id, persisted = store.save_dataset(raw, "Iris flowers", rows, n_columns)
    assert persisted is True

    config = PreprocessConfig(target="species", random_state=42, cv_folds=0)
    prepared, summary = prepare(store.get_dataset(dataset_id)["df"], config)
    store.save_prepared(dataset_id, prepared, config)

    store._reset_memory()
    restored = store.get_prepared(dataset_id)

    # Same resolved task, and the deterministic split reproduces exactly.
    assert restored.task == prepared.task
    assert restored.X_train.shape == prepared.X_train.shape
    assert restored.X_test.shape == prepared.X_test.shape
    assert summary["train_rows"] == restored.X_train.shape[0]
    assert summary["test_rows"] == restored.X_test.shape[0]
    assert np.array_equal(restored.X_train, prepared.X_train)
    assert np.array_equal(restored.X_test, prepared.X_test)
    assert np.array_equal(restored.y_train, prepared.y_train)
    assert np.array_equal(restored.y_test, prepared.y_test)


def test_save_model_pickles_and_rehydrates(require_db, clean_store):
    raw, rows, n_columns = _iris_bytes()
    dataset_id, persisted = store.save_dataset(raw, "Iris flowers", rows, n_columns)
    assert persisted is True

    config = PreprocessConfig(target="species", random_state=42, cv_folds=0)
    prepared, _summary = prepare(store.get_dataset(dataset_id)["df"], config)
    bundle = train_model("logistic_regression", prepared, tune=False)

    run_id, persisted = store.save_model(dataset_id, "logistic_regression", bundle)
    assert persisted is True
    assert isinstance(run_id, int)

    payload = db.fetch_latest_model(dataset_id, "logistic_regression")
    assert isinstance(payload, bytes)
    loaded = pickle.loads(payload)
    assert isinstance(loaded, dict)
    check_is_fitted(loaded["pipeline"])
    assert loaded["features"] == prepared.raw_features

    store._reset_memory()
    restored = store.get_model(dataset_id, "logistic_regression")
    assert restored["model"] is not None
    check_is_fitted(restored["model"])
    assert restored["predictor"]["features"] == prepared.raw_features
    assert len(restored["model"].predict(prepared.X_train[:2])) == 2


def test_legacy_estimator_payload_still_loads(require_db, clean_store):
    raw, rows, n_columns = _iris_bytes()
    dataset_id, persisted = store.save_dataset(raw, "Iris flowers", rows, n_columns)
    assert persisted is True

    config = PreprocessConfig(target="species", cv_folds=0)
    prepared, _summary = prepare(store.get_dataset(dataset_id)["df"], config)
    bundle = train_model("logistic_regression", prepared, tune=False)

    # Older runs stored a bare estimator rather than the full predictor.
    db.save_train_run(
        dataset_id=dataset_id,
        model_id="logistic_regression",
        label="Logistic Regression",
        task="classification",
        tune=False,
        result={"task": "classification"},
        model_bytes=pickle.dumps(bundle["model"]),
    )

    store._reset_memory()
    restored = store.get_model(dataset_id, "logistic_regression")
    check_is_fitted(restored["model"])
    assert restored.get("predictor") is None
