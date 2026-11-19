"""End-to-end tests for the history API over real Postgres rows."""

import pytest
from fastapi.testclient import TestClient

import store
from main import app


@pytest.fixture
def client():
    # Entering the context manager runs the app's lifespan (schema init).
    with TestClient(app) as test_client:
        yield test_client


def _train_iris(client):
    """Load iris, prepare it and train one classifier, returning the pieces."""
    body = client.post("/api/samples/iris").json()
    dataset_id = body["dataset_id"]

    pre = client.post(
        f"/api/datasets/{dataset_id}/preprocess",
        json={"target": "species"},
    )
    assert pre.status_code == 200

    trained = client.post(
        f"/api/datasets/{dataset_id}/train",
        json={"model_id": "logistic_regression"},
    )
    assert trained.status_code == 200
    return dataset_id, trained.json()


def test_history_lists_and_returns_the_full_run(require_db, client):
    dataset_id, result = _train_iris(client)

    history = client.get("/api/history")
    assert history.status_code == 200
    runs = history.json()
    assert len(runs) == 1
    run = runs[0]
    assert run["dataset_id"] == dataset_id
    assert run["model_id"] == "logistic_regression"
    assert run["task"] == "classification"
    assert run["cv_mean"] is not None
    assert run["cv_metric"] == "accuracy"

    detail = client.get(f"/api/history/{run['id']}")
    assert detail.status_code == 200
    saved = detail.json()
    assert saved["dataset_id"] == dataset_id
    assert saved["result"]["cv"]["mean"] == result["cv"]["mean"]
    assert saved["result"]["test_accuracy"] == result["test_accuracy"]
    assert saved["result"]["confusion_matrix"] == result["confusion_matrix"]
    assert saved["result"]["class_names"] == result["class_names"]


def test_history_detail_returns_404_for_unknown_run(client):
    assert client.get("/api/history/999999").status_code == 404


def test_history_rejects_limit_zero(client):
    assert client.get("/api/history", params={"limit": 0}).status_code == 400


def test_train_response_flags_not_persisted_when_db_is_unavailable(client, monkeypatch):
    # Simulate an outage after the module-level probe may have cached "up".
    # monkeypatch restores the original value when the test ends.
    monkeypatch.setattr(store, "_db_up", False)

    body = client.post("/api/samples/iris").json()
    assert body["persisted"] is False
    dataset_id = body["dataset_id"]

    pre = client.post(
        f"/api/datasets/{dataset_id}/preprocess",
        json={"target": "species"},
    )
    assert pre.status_code == 200

    trained = client.post(
        f"/api/datasets/{dataset_id}/train",
        json={"model_id": "logistic_regression"},
    )
    assert trained.status_code == 200
    assert trained.json()["persisted"] is False
