"""Tests for the honest-scoring layer: class weights, AUC, per-class metrics,
and the quick tune option.
"""

import numpy as np
import pandas as pd
import pytest
from sklearn.datasets import load_iris

from preprocessing import PreprocessConfig, prepare
from trainer import train_model


@pytest.fixture(scope="module")
def iris():
    return load_iris(as_frame=True).frame.rename(columns={"target": "species"})


@pytest.fixture(scope="module")
def imbalanced_iris(iris):
    # 9:1 majority after filtering.
    return pd.concat([
        iris[iris["species"] == 0],
        iris[iris["species"] == 1].head(5),
        iris[iris["species"] == 2].head(5),
    ]).reset_index(drop=True)


def _labels(iris):
    names = {0: "setosa", 1: "versicolor", 2: "virginica"}
    iris = iris.copy()
    iris["species"] = iris["species"].map(names)
    return iris


def test_an_imbalanced_target_gets_balanced_weights(imbalanced_iris):
    df = _labels(imbalanced_iris)
    prepared, _ = prepare(df, PreprocessConfig(target="species"))
    result = train_model("logistic_regression", prepared)["result"]
    assert result["class_weight"] == "balanced"


def test_a_balanced_target_gets_no_special_handling(iris):
    df = _labels(iris)
    prepared, _ = prepare(df, PreprocessConfig(target="species"))
    result = train_model("logistic_regression", prepared)["result"]
    assert result["class_weight"] is None


def test_per_class_metrics_add_up(iris):
    df = _labels(iris)
    prepared, _ = prepare(df, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    per_class = result["per_class"]
    assert [entry["label"] for entry in per_class] == result["class_names"]
    for entry in per_class:
        assert 0 <= entry["precision"] <= 100
        assert 0 <= entry["recall"] <= 100
        assert 0 <= entry["f1"] <= 100
    assert sum(entry["support"] for entry in per_class) == result["test_rows"]


def test_cross_validation_reports_auc_for_classifiers(iris):
    df = _labels(iris)
    prepared, _ = prepare(df, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    auc = result["cv_auc"]
    assert auc is not None
    assert auc["metric"] == "auc"
    assert len(auc["folds"]) == 5
    assert 0.5 <= auc["mean"] <= 1.0
    assert result["cv_baseline_auc"] is not None
    # A coin-flip model sits at 0.5 by definition.
    assert result["cv_baseline_auc"]["mean"] == pytest.approx(0.5, abs=0.01)


def test_regression_does_not_report_auc():
    rng = np.random.default_rng(0)
    x = rng.normal(0, 1, 80)
    frame = pd.DataFrame({
        "x": x,
        "y": 3 * x + rng.normal(0, 0.5, 80),
    })
    prepared, _ = prepare(frame, PreprocessConfig(target="y"))
    result = train_model("ridge", prepared)["result"]
    assert "cv_auc" not in result


def test_quick_tune_returns_tuned_params(iris):
    df = _labels(iris)
    prepared, _ = prepare(df, PreprocessConfig(target="species"))
    result = train_model("decision_tree", prepared, tune=True)["result"]

    tuned = result["tuned"]
    assert tuned is not None
    assert tuned["params"]
    assert all(key in ("max_depth", "min_samples_leaf") for key in tuned["params"])
    # Tuning must not secretly swap in a different estimator.
    assert result["model_id"] == "decision_tree"


def test_quick_tune_skips_models_without_a_grid(iris):
    rng = np.random.default_rng(0)
    x = rng.normal(0, 1, 80)
    frame = pd.DataFrame({
        "x": x,
        "y": 3 * x + rng.normal(0, 0.5, 80),
    })
    prepared, _ = prepare(frame, PreprocessConfig(target="y"))
    result = train_model("linear_regression", prepared, tune=True)["result"]
    # A plain straight-line fit has no knobs; it is not "tuned", and it
    # should not pretend to be.
    assert result["tuned"] is None
    assert result["task"] == "regression"
