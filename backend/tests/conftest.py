"""Shared setup for the backend tests.

The backend modules are flat (they sit in backend/, not a package), so we
put that folder on the path before importing anything.

Tests also point the app at a dedicated Postgres database and wipe it
before every test, so they never touch the developer's real data. When
no database is reachable the API still answers (it degrades gracefully),
and tests that require persistence skip instead of failing.
"""

import os
import sys

import psycopg
import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Never run the suite against the dev database. The test database is named
# separately and truncated between tests.
TEST_URL = os.environ.get(
    "ML_PLAYGROUND_TEST_DATABASE_URL",
    "postgresql://ml_playground:ml_playground@127.0.0.1:5433/ml_playground_test",
)
ADMIN_URL = os.environ.get(
    "ML_PLAYGROUND_ADMIN_DATABASE_URL",
    "postgresql://ml_playground:ml_playground@127.0.0.1:5433/ml_playground",
)
os.environ["DATABASE_URL"] = TEST_URL


def _available() -> bool:
    try:
        with psycopg.connect(TEST_URL, connect_timeout=2) as conn:
            conn.execute("SELECT 1")
        return True
    except psycopg.OperationalError:
        pass
    try:
        # Maybe the test database simply does not exist yet — create it.
        with psycopg.connect(ADMIN_URL, connect_timeout=2, autocommit=True) as conn:
            conn.execute("CREATE DATABASE ml_playground_test")
        return True
    except Exception:
        return False


_DB_AVAILABLE = _available()
_SCHEMA_READY = False


@pytest.fixture(autouse=True)
def _clean_database():
    """Give every test a clean database when one is reachable."""
    global _SCHEMA_READY
    if _DB_AVAILABLE:
        if not _SCHEMA_READY:
            # A freshly created test database has no tables, so the truncate
            # below (and every persistence test) would fail on the very first
            # run. Create the schema once before touching it. db.py reads
            # DATABASE_URL at import time, which we set above.
            import db

            db.init_schema()
            _SCHEMA_READY = True
        with psycopg.connect(TEST_URL) as conn:
            conn.execute("TRUNCATE train_runs, prepare_runs, datasets")
    yield


@pytest.fixture
def require_db():
    if not _DB_AVAILABLE:
        pytest.skip("Postgres is not available")
