"""The verdict must compare like with like and respect score stability."""

from preprocessing import PreprocessConfig, prepare
from trainer import _verdict, train_model


def _cv(mean, spread=0.0, n_splits=5):
    return {
        "metric": "accuracy",
        "folds": [mean] * n_splits,
        "mean": mean,
        "std": spread,
        "n_splits": n_splits,
    }


def test_overfitting_uses_training_folds_when_cv_is_available():
    cv = _cv(70)
    baseline = _cv(50)

    with_cv_train = _verdict(
        0.99, 0.70, 0.50, cv=cv, cv_baseline=baseline, cv_train=_cv(95))
    assert with_cv_train["title"] == "Possible overfitting"
    assert "training folds" in with_cv_train["text"]

    # The single-split training accuracy is higher, but the training folds
    # are what should decide whether this is overfitting.
    without_gap = _verdict(
        0.99, 0.70, 0.50, cv=cv, cv_baseline=baseline, cv_train=_cv(72))
    assert without_gap["title"] != "Possible overfitting"


def test_baseline_margin_grows_with_fold_spread():
    stable = _verdict(0.55, 0.53, 0.50, cv=_cv(53, 0.5), cv_baseline=_cv(50, 0))
    assert stable["title"] == "Weak signal"

    unstable = _verdict(0.55, 0.53, 0.50, cv=_cv(53, 5), cv_baseline=_cv(50, 0))
    assert unstable["title"] == "No better than guessing"


def test_cv_training_score_is_returned_for_classifiers():
    from samples import build_sample

    prepared, _ = prepare(build_sample("iris"), PreprocessConfig(target="species"))
    result = train_model("random_forest", prepared)["result"]

    cv_train = result["cv_train"]
    assert cv_train["metric"] == "accuracy"
    assert cv_train["n_splits"] == result["cv"]["n_splits"]
    assert len(cv_train["folds"]) == cv_train["n_splits"]
    assert 0 <= cv_train["mean"] <= 100
