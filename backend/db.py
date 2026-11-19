"""Postgres persistence for the playground.

Everything the app used to forget on restart lives here: the uploaded
CSVs (as bytes), the preprocessing configuration for each one, and every
training run (the exact result dict the UI renders, plus the fitted
estimator pickled when pickle cooperates).

Configuration is one environment variable, DATABASE_URL. The default
matches `docker compose up -d db`; point it at your own instance for
anything real.

No ORM: the queries are few and plain, and a schema of four tables does
not need one.
"""

import os
from datetime import datetime

import psycopg
from psycopg.types.json import Json

DEFAULT_URL = "postgresql://ml_playground:ml_playground@127.0.0.1:5433/ml_playground"
DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_URL)

SCHEMA = """
CREATE TABLE IF NOT EXISTS datasets (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    rows        INTEGER NOT NULL,
    n_columns   INTEGER NOT NULL,
    bytes       BYTEA NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prepare_runs (
    dataset_id TEXT PRIMARY KEY REFERENCES datasets(id) ON DELETE CASCADE,
    config     JSONB NOT NULL,
    task       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS train_runs (
    id         BIGSERIAL PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    model_id   TEXT NOT NULL,
    label      TEXT NOT NULL,
    task       TEXT NOT NULL,
    tune       BOOLEAN NOT NULL DEFAULT FALSE,
    result     JSONB NOT NULL,
    model      BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS train_runs_dataset_idx ON train_runs (dataset_id);
CREATE INDEX IF NOT EXISTS train_runs_created_idx ON train_runs (created_at DESC);
"""


def connect():
    """One connection for one operation. Cheap, honest, easy to reason about."""
    return psycopg.connect(DATABASE_URL, connect_timeout=3)


def init_schema() -> None:
    with connect() as conn:
        conn.execute(SCHEMA)


def health() -> bool:
    try:
        with connect() as conn:
            conn.execute("SELECT 1")
        return True
    except psycopg.OperationalError:
        return False


def save_dataset(dataset_id: str, name: str, raw: bytes, rows: int, n_columns: int) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO datasets (id, name, rows, n_columns, bytes) VALUES (%s, %s, %s, %s, %s)",
            (dataset_id, name, rows, n_columns, raw),
        )


def fetch_dataset(dataset_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, name, bytes, uploaded_at FROM datasets WHERE id = %s",
            (dataset_id,),
        ).fetchone()
    if row is None:
        return None
    return {"id": row[0], "name": row[1], "bytes": bytes(row[2]),
            "uploaded_at": row[3]}


def save_prepare_run(dataset_id: str, config: dict, task: str) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO prepare_runs (dataset_id, config, task)
            VALUES (%s, %s, %s)
            ON CONFLICT (dataset_id) DO UPDATE
                SET config = EXCLUDED.config,
                    task = EXCLUDED.task,
                    created_at = now()
            """,
            (dataset_id, Json(config), task),
        )


def fetch_prepare_config(dataset_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT config FROM prepare_runs WHERE dataset_id = %s",
            (dataset_id,),
        ).fetchone()
    return row[0] if row else None


def save_train_run(dataset_id: str, model_id: str, label: str, task: str,
                   tune: bool, result: dict, model_bytes: bytes | None) -> int:
    with connect() as conn:
        row = conn.execute(
            """
            INSERT INTO train_runs (dataset_id, model_id, label, task, tune, result, model)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (dataset_id, model_id, label, task, tune, Json(result), model_bytes),
        ).fetchone()
    return int(row[0])


def list_train_runs(limit: int = 10) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT t.id, t.dataset_id, d.name AS dataset, t.model_id,
                   t.label, t.task, t.tune,
                   t.result->'cv'->>'mean' AS cv_mean,
                   t.result->'cv'->>'metric' AS cv_metric,
                   t.result->>'test_accuracy'    AS test_accuracy,
                   t.result->>'test_r2'          AS test_r2,
                   t.created_at
            FROM train_runs t
            JOIN datasets d ON d.id = t.dataset_id
            ORDER BY t.id DESC
            LIMIT %s
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "id": r[0],
            "dataset_id": r[1],
            "dataset": r[2],
            "model_id": r[3],
            "label": r[4],
            "task": r[5],
            "tune": r[6],
            "cv_mean": float(r[7]) if r[7] is not None else None,
            "cv_metric": r[8],
            "test_accuracy": float(r[9]) if r[9] is not None else None,
            "test_r2": float(r[10]) if r[10] is not None else None,
            "created_at": r[11].isoformat() if isinstance(r[11], datetime) else str(r[11]),
        }
        for r in rows
    ]


def fetch_train_run(run_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT t.id, t.dataset_id, d.name AS dataset, t.model_id,
                   t.label, t.task, t.tune, t.result, t.created_at
            FROM train_runs t
            JOIN datasets d ON d.id = t.dataset_id
            WHERE t.id = %s
            """,
            (run_id,),
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row[0],
        "dataset_id": row[1],
        "dataset": row[2],
        "model_id": row[3],
        "label": row[4],
        "task": row[5],
        "tune": row[6],
        "result": row[7],
        "created_at": row[8].isoformat() if isinstance(row[8], datetime) else str(row[8]),
    }


def fetch_latest_model(dataset_id: str, model_id: str) -> bytes | None:
    """The fitted estimator for the most recent run of this model on this dataset."""
    with connect() as conn:
        row = conn.execute(
            """
            SELECT model FROM train_runs
            WHERE dataset_id = %s AND model_id = %s AND model IS NOT NULL
            ORDER BY id DESC LIMIT 1
            """,
            (dataset_id, model_id),
        ).fetchone()
    return bytes(row[0]) if row and row[0] is not None else None
