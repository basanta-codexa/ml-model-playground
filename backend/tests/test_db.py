"""Low-level tests for the Postgres layer (db.py).

These only make sense with a real database, so they all depend on the
``require_db`` fixture and skip cleanly when Postgres is not reachable.
"""

import db


def test_init_schema_creates_all_tables(require_db):
    db.init_schema()
    with db.connect() as conn:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            ).fetchall()
        }
    assert {"datasets", "prepare_runs", "train_runs"} <= tables


def test_init_schema_is_idempotent(require_db):
    # The app calls this on every startup; re-running the DDL must be harmless.
    db.init_schema()
    db.init_schema()


def test_health_is_true(require_db):
    assert db.health() is True
