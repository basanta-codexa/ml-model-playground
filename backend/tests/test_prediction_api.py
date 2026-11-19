"""End-to-end tests for scoring new rows with a saved model."""

import pytest
from fastapi.testclient import TestClient

import store
from main import app
from samples import build_sample


@pytest.fixture
def client():
    return TestClient(app)


def _train(client, sample_id, target, model_id):
    dataset_id = client.post(f"/api/samples/{sample_id}").json()["dataset_id"]
    assert client.post(
        f"/api/datasets/{dataset_id}/preprocess",
        json={"target": target},
    ).status_code == 200
    assert client.post(
        f"/api/datasets/{dataset_id}/train",
        json={"model_id": model_id},
    ).status_code == 200
    return dataset_id


def test_predict_classification(client):
    dataset_id = _train(client, "iris", "species", "random_forest")
    rows = build_sample("iris").drop(columns=["species"]).head(3).to_dict("records")

    response = client.post(
        f"/api/datasets/{dataset_id}/predict",
        json={"model_id": "random_forest", "rows": rows},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["task"] == "classification"
    assert len(body["predictions"]) == 3
    assert all(p in {"setosa", "versicolor", "virginica"} for p in body["predictions"])
    assert body["probabilities"] is not None
    for row in body["probabilities"]:
        assert abs(sum(row.values()) - 1.0) < 0.01


def test_predict_regression(client):
    dataset_id = _train(client, "retail_orders", "Order Value", "linear_regression")
    rows = (
        build_sample("retail_orders").drop(columns=["Order Value"]).head(2).to_dict("records")
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/predict",
        json={"model_id": "linear_regression", "rows": rows},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["task"] == "regression"
    assert len(body["predictions"]) == 2
    assert all(isinstance(p, float) for p in body["predictions"])
    assert body["probabilities"] is None


def test_predict_requires_a_trained_model(client):
    dataset_id = client.post("/api/samples/iris").json()["dataset_id"]
    response = client.post(
        f"/api/datasets/{dataset_id}/predict",
        json={"model_id": "random_forest", "rows": [{}]},
    )
    assert response.status_code == 409


def test_predict_rejects_empty_rows(client):
    dataset_id = _train(client, "iris", "species", "random_forest")
    response = client.post(
        f"/api/datasets/{dataset_id}/predict",
        json={"model_id": "random_forest", "rows": []},
    )
    assert response.status_code == 422


def test_predict_fills_missing_feature_columns(client):
    dataset_id = _train(client, "iris", "species", "random_forest")
    response = client.post(
        f"/api/datasets/{dataset_id}/predict",
        json={"model_id": "random_forest", "rows": [{"sepal length (cm)": 5.1}]},
    )
    assert response.status_code == 200
    assert len(response.json()["predictions"]) == 1


def test_predict_after_memory_reset(require_db, client):
    dataset_id = _train(client, "iris", "species", "random_forest")
    store._reset_memory()
    rows = build_sample("iris").drop(columns=["species"]).head(2).to_dict("records")

    response = client.post(
        f"/api/datasets/{dataset_id}/predict",
        json={"model_id": "random_forest", "rows": rows},
    )
    assert response.status_code == 200
    assert len(response.json()["predictions"]) == 2
