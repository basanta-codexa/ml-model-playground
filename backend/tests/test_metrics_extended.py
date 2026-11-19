"""Extended metric-correctness tests.

These pin down the properties the headline numbers depend on: every CV
bundle is a well-formed fold summary, out-of-fold per-class metrics cover the
training rows, regression verdicts compare CV with CV, and a tuned model's
reported score comes from nested cross-validation rather than the rows that
picked its parameters.
"""

import numpy as np
import pandas as pd
import pytest

import trainer
from preprocessing import PreprocessConfig, prepare
from trainer import _regression_verdict, train_model


@pytest.fixture(scope="module")
def iris():
    from samples import build_sample
    return build_sample("iris")


def _regression_frame():
    rng = np.random.default_rng(0)
    x = rng.normal(0, 1, 80)
    return pd.DataFrame({
        "x": x,
        "z": rng.normal(0, 1, 80),
        "y": 3 * x + rng.normal(0, 0.5, 80),
    })


def _assert_bundle(bundle, metric, n_splits):
    """A CV bundle has the documented shape and internally consistent stats."""
    assert bundle is not None
    assert set(bundle) == {"metric", "folds", "mean", "std", "n_splits"}
    assert bundle["metric"] == metric
    assert bundle["n_splits"] == n_splits
    assert len(bundle["folds"]) == n_splits
    assert bundle["mean"] == pytest.approx(np.mean(bundle["folds"]), abs=0.01)
    assert bundle["std"] == pytest.approx(np.std(bundle["folds"]), abs=0.01)


def test_classification_cv_bundles_are_well_formed(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    for field, metric in (("cv", "accuracy"), ("cv_auc", "auc"),
                          ("cv_precision", "precision"), ("cv_recall", "recall"),
                          ("cv_f1", "f1"), ("cv_f1_weighted", "f1_weighted")):
        _assert_bundle(result[field], metric, 5)

    # Precision/recall/F1 are shown on the same 0-100 scale as the headline
    # metrics, and a class-balanced iris run should score high on all of them.
    assert result["cv_f1"]["mean"] > 70
    assert result["cv_f1_weighted"]["mean"] > 70


def test_oof_metrics_cover_every_training_row(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    oof = result["oof_confusion_matrix"]
    assert oof is not None
    assert len(oof) == len(prepared.class_names)
    assert all(len(row) == len(prepared.class_names) for row in oof)
    assert sum(sum(row) for row in oof) == len(prepared.y_train)

    oof_per_class = result["oof_per_class"]
    assert oof_per_class is not None
    assert [entry["label"] for entry in oof_per_class] == result["class_names"]
    assert sum(entry["support"] for entry in oof_per_class) == len(prepared.y_train)
    for entry in oof_per_class:
        assert 0 <= entry["precision"] <= 100
        assert 0 <= entry["recall"] <= 100
        assert 0 <= entry["f1"] <= 100

    # The original holdout fields must not have changed meaning.
    assert sum(sum(row) for row in result["confusion_matrix"]) == result["test_rows"]
    assert sum(entry["support"] for entry in result["per_class"]) == result["test_rows"]


def test_oof_fields_are_absent_when_cv_is_off(iris):
    prepared, _ = prepare(iris, PreprocessConfig(target="species", cv_folds=0))
    result = train_model("random_forest", prepared)["result"]
    assert result["oof_confusion_matrix"] is None
    assert result["oof_per_class"] is None


def test_regression_cv_bundles_include_mae_and_rmse():
    prepared, _ = prepare(_regression_frame(), PreprocessConfig(target="y"))
    result = train_model("linear_regression", prepared)["result"]

    _assert_bundle(result["cv"], "r2", 5)
    _assert_bundle(result["cv_mae"], "mae", 5)
    _assert_bundle(result["cv_rmse"], "rmse", 5)
    # sklearn's loss scorers are negative; the reported errors are positive.
    assert all(value > 0 for value in result["cv_mae"]["folds"])
    assert all(value > 0 for value in result["cv_rmse"]["folds"])
    _assert_bundle(result["cv_baseline_mae"], "mae", 5)


def _cv(mean, n_splits=5):
    return {"metric": "r2", "folds": [mean] * n_splits, "mean": mean,
            "std": 0.0, "n_splits": n_splits}


def _bundle(mean, n_splits=5):
    return {"metric": "mae", "folds": [mean] * n_splits, "mean": mean,
            "std": 0.0, "n_splits": n_splits}


def test_regression_verdict_uses_cv_mae_over_single_split():
    # The single split says the model is great; the CV errors say it is much
    # worse than the baseline. When CV is present it is the CV numbers that
    # must decide the verdict.
    verdict = _regression_verdict(
        0.9, 1.0, 100.0,
        cv=_cv(0.9), cv_baseline=_cv(0.0),
        cv_mae=_bundle(200.0), cv_baseline_mae=_bundle(100.0),
    )
    assert verdict["title"] == "Worse than guessing the average"
    assert "off by 200" in verdict["text"]


def test_regression_verdict_does_not_use_single_split_when_cv_is_better():
    # The reverse case: a bad single-split MAE must not poison the verdict
    # when the cross-validated MAE shows the model beating the baseline.
    verdict = _regression_verdict(
        0.9, 200.0, 100.0,
        cv=_cv(0.9), cv_baseline=_cv(0.0),
        cv_mae=_bundle(1.0), cv_baseline_mae=_bundle(100.0),
    )
    assert verdict["title"] == "Learned something real"
    assert "Worse than guessing the average" not in verdict["title"]
    assert "beats the average" in verdict["text"]


def test_regression_verdict_falls_back_to_single_split_without_cv():
    # With no CV at all the single-split MAE decides, and the verdict says
    # which source it used.
    verdict = _regression_verdict(0.9, 1.0, 100.0)
    assert verdict["title"] == "Learned something real"
    assert "held-out test rows" in verdict["text"]


def test_tuned_estimate_comes_from_nested_cv_not_the_search_folds(iris, monkeypatch):
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    real_cross_validate = trainer.cross_validate
    seen = []

    def spy(estimator, *args, **kwargs):
        seen.append(type(estimator).__name__)
        return real_cross_validate(estimator, *args, **kwargs)

    monkeypatch.setattr(trainer, "cross_validate", spy)

    tuned = train_model("decision_tree", prepared, tune=True)["result"]
    # The reported CV bundles came from an estimator that re-runs the search
    # inside every outer fold, not from the parameters chosen on all folds.
    assert "RandomizedSearchCV" in seen
    assert tuned["cv"] is not None
    assert tuned["cv"]["n_splits"] == 5

    seen.clear()
    plain = train_model("decision_tree", prepared)["result"]
    assert "RandomizedSearchCV" not in seen
    assert plain["tuned"] is None


def test_tuning_with_a_single_row_class_does_not_crash():
    # A class with just one training row cannot be split into even two
    # stratified folds. RandomizedSearchCV used to be handed
    # StratifiedKFold(n_splits=2), which raised and surfaced as a 500. The
    # search must be skipped and the model trained with its defaults.
    labels = ["a"] * 10
    labels[0] = "b"  # index 0 lands in train for seed 42 (test rows are 8, 1)
    frame = pd.DataFrame({
        "x": [float(i) for i in range(10)],
        "label": labels,
    })
    prepared, _ = prepare(frame, PreprocessConfig(target="label"))
    assert np.bincount(prepared.y_train).min() == 1  # the rare row is in train

    result = train_model("decision_tree", prepared, tune=True)["result"]
    assert result["task"] == "classification"
    assert result["tuned"] is None  # no honest search could be run
    assert result["verdict"]["title"]  # a verdict is still produced


def test_tuned_runs_do_not_publish_biased_oof_metrics(iris):
    # Parameters chosen on all training rows would make out-of-fold per-class
    # scores optimistically biased, so those fields stay empty for tuned runs.
    prepared, _ = prepare(iris, PreprocessConfig(target="species"))
    result = train_model("decision_tree", prepared, tune=True)["result"]

    assert result["tuned"] is not None
    assert result["cv"] is not None
    assert result["oof_confusion_matrix"] is None
    assert result["oof_per_class"] is None
