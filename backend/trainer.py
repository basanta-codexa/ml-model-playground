"""Train one model on the prepared data and measure how well it did.

Two kinds of job live here. A classifier predicts a label, and we measure it
with accuracy plus precision, recall and F1. A regressor predicts a number,
and we measure it with R-squared, mean absolute error and RMSE.

Both are compared against a baseline: a model that knows nothing. For a
classifier that is "always guess the most common class"; for a regressor it
is "always guess the average". A model that cannot beat that has learned
nothing, however good the score looks on its own.

And every model is cross-validated, because a single test split of a few
dozen rows is a noisy way to measure anything. The cross-validated score is
the one we trust; the single split is kept so the two can be compared.
"""

import time

import numpy as np
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_fscore_support,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import KFold, RandomizedSearchCV, StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline

from models import MODELS, build_model, tuning_grid
from preprocessing import build_preprocessor


def _pct(value: float) -> float:
    return round(float(value) * 100, 1)


def _fresh_pipeline(prepared, model):
    """An unfitted pipeline: the preprocessor, then the model.

    Every fold gets its own copy. The imputers, the encoders, the scaler and
    the model are all fitted inside the fold, on that fold's training rows
    only. Reusing a preprocessor that was fitted on every training row would
    let the other folds leak in, which is the one thing cross-validation
    exists to prevent.
    """
    return Pipeline([
        ("prep", build_preprocessor(
            prepared.numeric_cols,
            prepared.categorical_cols,
            prepared.config,
            prepared.group_cols,
        )),
        ("model", model),
    ])


def _usable_folds(prepared, wanted: int) -> int | None:
    """How many folds we can actually use.

    A stratified split needs at least two rows in the smallest class, or
    some folds would be missing a class entirely.
    """
    if wanted < 2:
        return None
    if prepared.task == "classification":
        counts = np.bincount(prepared.y_train)
        counts = counts[counts > 0]
        if counts.size == 0:
            return None
        wanted = min(wanted, int(counts.min()))
    return wanted if wanted >= 2 else None


def _cv_result(values: np.ndarray, metric: str, n_splits: int) -> dict:
    """Package the fold scores for the frontend."""
    if metric == "accuracy":
        scaled = values * 100
    else:
        # R-squared is a ratio, not a percentage, so it is left alone.
        scaled = values
    return {
        "metric": metric,
        "folds": [round(float(v), 3) for v in scaled],
        "mean": round(float(scaled.mean()), 3),
        "std": round(float(scaled.std()), 3),
        "n_splits": int(n_splits),
    }


def _splitter(prepared, n_splits: int):
    if prepared.task == "classification":
        return StratifiedKFold(n_splits=n_splits, shuffle=True,
                               random_state=prepared.config.random_state)
    return KFold(n_splits=n_splits, shuffle=True,
                 random_state=prepared.config.random_state)


def _classification_weight(prepared) -> str | None:
    """Return "balanced" when the target is at least 2:1 imbalanced.

    Balancing the weights matters precisely when accuracy would look good
    for the wrong reason; we only do it when the reader should care, and we
    report it, never silently.
    """
    if prepared.task != "classification":
        return None
    counts = np.bincount(prepared.y_train)
    nonzero = counts[counts > 0]
    if nonzero.size < 2:
        return None
    return "balanced" if nonzero.max() / nonzero.min() >= 2.0 else None


def _auc_scorer(n_classes: int):
    """ROC AUC for binary (plain) and multiclass (one-vs-rest, macro)."""

    def scorer(estimator, X, y):
        proba = estimator.predict_proba(X)
        if n_classes == 2:
            return roc_auc_score(y, proba[:, 1])
        return roc_auc_score(y, proba, multi_class="ovr", average="macro")

    return scorer


def _cross_validate(prepared, build) -> dict | None:
    """Cross-validate a freshly built model inside every fold.

    Returns {"accuracy", "auc"} for classifiers, {"r2"} for regressors.
    Every fold rebuilds the preprocessor and the model from scratch.
    """
    n_splits = _usable_folds(prepared, prepared.config.cv_folds)
    if n_splits is None:
        return None
    splitter = _splitter(prepared, n_splits)

    if prepared.task == "classification":
        scoring = {"accuracy": "accuracy",
                   "auc": _auc_scorer(len(prepared.class_names))}
        try:
            raw = cross_validate(
                _fresh_pipeline(prepared, build()),
                prepared.X_train_raw,
                prepared.y_train,
                cv=splitter,
                scoring=scoring,
                error_score="raise",
            )
        except ValueError:
            return None
        return {
            "accuracy": _cv_result(np.asarray(raw["test_accuracy"]), "accuracy", n_splits),
            "auc": _cv_result(np.asarray(raw["test_auc"]), "auc", n_splits),
        }

    try:
        raw = cross_validate(
            _fresh_pipeline(prepared, build()),
            prepared.X_train_raw,
            prepared.y_train,
            cv=splitter,
            scoring="r2",
            error_score="raise",
        )
    except ValueError:
        # A fold where the model cannot be fitted (one class missing, say).
        return None
    return {"r2": _cv_result(np.asarray(raw["test_score"]), "r2", n_splits)}


def _baseline_bundle(prepared) -> dict | None:
    """The cross-validated baseline, worked out once and reused."""
    cached = getattr(prepared, "cv_baseline_cache", None)
    if cached is not None:
        return cached
    if prepared.task == "classification":
        def build():
            return DummyClassifier(strategy="most_frequent")
    else:
        def build():
            return DummyRegressor(strategy="mean")
    result = _cross_validate(prepared, build)
    try:
        prepared.cv_baseline_cache = result
    except AttributeError:
        pass
    return result


def _verdict(train_acc: float, test_acc: float, baseline_acc: float,
             cv: dict | None = None, cv_baseline: dict | None = None) -> dict:
    """Explain the score in plain language.

    When we have cross-validation we judge the model on that, not on the
    single split. A split of a few dozen rows can be several points lucky
    or unlucky, and the cross-validated mean is the number worth trusting.
    """
    train = _pct(train_acc)
    test = _pct(test_acc)

    if cv:
        score = cv["mean"]
        base = cv_baseline["mean"] if cv_baseline else _pct(baseline_acc)
        spread = cv["std"]
        source = (f"Cross-validated over {cv['n_splits']} folds, it scores "
                  f"{score:g}%, plus or minus {spread:g} points.")
    else:
        score = test
        base = _pct(baseline_acc)
        spread = 0.0
        source = f"On the held-out test rows it scores {score:g}%."

    if score < base - 2:
        return {
            "tone": "bad",
            "title": "Worse than guessing",
            "text": f"Always guessing the most common class scores {base:g}%, and this "
                    f"model scores {score:g}%. {source} It did not just fail to learn, it "
                    f"picked up patterns that do not hold on new rows. That usually means "
                    f"the columns are not what the model needs, or there is too little "
                    f"data for the pattern to be real.",
        }
    if score <= base + 1:
        return {
            "tone": "bad",
            "title": "No better than guessing",
            "text": f"Always guessing the most common class scores {base:g}% and this model "
                    f"scores {score:g}%. {source} It hasn't learned much. Check your target "
                    f"and features.",
        }
    if train - score > 15:
        return {
            "tone": "mid",
            "title": "Possible overfitting",
            "text": f"{train:g}% on rows it studied but only {score:g}% on rows it had not "
                    f"seen. {source} It may have memorised the training data instead of "
                    f"learning patterns that carry over.",
        }
    if score < 70:
        return {
            "tone": "mid",
            "title": "Weak signal",
            "text": f"{score:g}%, against {base:g}% for guessing. {source} The model is "
                    f"beating the baseline, but not by much. There may simply not be much "
                    f"in these columns to predict the target with.",
        }
    return {
        "tone": "good",
        "title": "Learned something real",
        "text": f"{score:g}%, well above the {base:g}% you'd get by guessing. {source} "
                f"The gap between the training rows and the new rows is small, so the "
                f"pattern is real and not memorised.",
    }


def _regression_verdict(r2: float, mae: float, baseline_mae: float,
                        cv: dict | None = None,
                        cv_baseline: dict | None = None) -> dict:
    if cv:
        score = cv["mean"]
        spread = cv["std"]
        source = (f"Cross-validated over {cv['n_splits']} folds, it reaches an "
                  f"R-squared of {score:.2f}, plus or minus {spread:.2f}.")
    else:
        score = r2
        spread = 0.0
        source = f"On the held-out test rows it reaches an R-squared of {score:.2f}."

    if baseline_mae <= 0:
        return {
            "tone": "bad",
            "title": "Nothing to compare against",
            "text": "The target has no variation to predict, so there is no way to "
                    "tell a good model from a bad one here.",
        }
    if mae > baseline_mae * 1.02:
        return {
            "tone": "bad",
            "title": "Worse than guessing the average",
            "text": f"Always predicting the average is off by {baseline_mae:,.0f} on "
                    f"average. This model is off by {mae:,.0f}, so it did not just fail "
                    f"to find the pattern, it found one that does not hold on new rows.",
        }
    if score < 0:
        return {
            "tone": "bad",
            "title": "Worse than predicting the average",
            "text": f"An R-squared of {score:.2f} means the model is doing worse than "
                    f"simply guessing the average for every row. {source} It found a "
                    f"pattern that does not hold on new rows.",
        }
    if score < 0.5:
        return {
            "tone": "mid",
            "title": "Explains only some of it",
            "text": f"R-squared {score:.2f}: the model catches {score:.0%} of the "
                    f"variation in the target, and is off by {mae:,.0f} on a typical "
                    f"row. {source} There is probably more signal in the data.",
        }
    return {
        "tone": "good",
        "title": "Learned something real",
        "text": f"R-squared {score:.2f}: the model explains {score:.0%} of the variation "
                f"in the target, and beats the average by "
                f"{100 * (1 - mae / baseline_mae):.0%}. {source}",
    }


def _per_class(y_test, y_pred, class_names) -> list[dict]:
    """Precision, recall and F1 for every class, with how many rows it has."""
    precisions, recalls, f1s, supports = precision_recall_fscore_support(
        y_test, y_pred, zero_division=0)
    return [{
        "label": class_names[i] if i < len(class_names) else str(i),
        "precision": _pct(p),
        "recall": _pct(r),
        "f1": _pct(f),
        "support": int(s),
    } for i, (p, r, f, s) in enumerate(zip(precisions, recalls, f1s, supports, strict=True))]


def _classification_result(model_id, model, prepared, fit_ms, y_pred,
                            cv=None, cv_baseline=None, cv_auc=None,
                            cv_baseline_auc=None, class_weight=None,
                            tuned_params=None) -> dict:
    y_train = prepared.y_train
    y_test = prepared.y_test

    train_acc = accuracy_score(y_train, model.predict(prepared.X_train))
    test_acc = accuracy_score(y_test, y_pred)

    # The "dumbest possible model": always predict the most common training class.
    # Any real model must beat this to be worth anything.
    dummy = DummyClassifier(strategy="most_frequent").fit(
        prepared.X_train, prepared.y_train)
    baseline_acc = accuracy_score(y_test, dummy.predict(prepared.X_test))

    n_test = len(y_test)
    labels = list(range(len(prepared.class_names)))
    matrix = confusion_matrix(y_test, y_pred, labels=labels).tolist()

    precision = precision_score(y_test, y_pred, average="macro",
                                zero_division=0)
    recall = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)

    return {
        "model_id": model_id,
        "label": MODELS[model_id]["label"],
        "task": "classification",
        "train_accuracy": _pct(train_acc),
        "test_accuracy": _pct(test_acc),
        "baseline_accuracy": _pct(baseline_acc),
        "precision": _pct(precision),
        "recall": _pct(recall),
        "f1": _pct(f1),
        "correct": int((y_pred == y_test).sum()),
        "test_rows": int(n_test),
        "fit_ms": round(fit_ms, 1),
        "points_per_row": round(100 / n_test, 1),
        "confusion_matrix": matrix,
        "class_names": prepared.class_names,
        "per_class": _per_class(y_test, y_pred, prepared.class_names),
        "class_weight": class_weight,
        "tuned": {"params": tuned_params} if tuned_params else None,
        "cv": cv,
        "cv_auc": cv_auc,
        "cv_baseline": cv_baseline,
        "cv_baseline_auc": cv_baseline_auc,
        "verdict": _verdict(train_acc, test_acc, baseline_acc, cv, cv_baseline),
    }


def _regression_result(model_id, model, prepared, fit_ms, y_pred,
                       cv=None, cv_baseline=None, tuned_params=None) -> dict:
    y_train = prepared.y_train
    y_test = prepared.y_test

    train_r2 = r2_score(y_train, model.predict(prepared.X_train))
    test_r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

    # The baseline: always guess the average of the training rows.
    dummy = DummyRegressor(strategy="mean").fit(
        prepared.X_train, prepared.y_train)
    baseline_pred = dummy.predict(prepared.X_test)
    baseline_mae = mean_absolute_error(y_test, baseline_pred)
    baseline_r2 = r2_score(y_test, baseline_pred)

    return {
        "model_id": model_id,
        "label": MODELS[model_id]["label"],
        "task": "regression",
        "train_r2": round(float(train_r2), 3),
        "test_r2": round(float(test_r2), 3),
        "mae": round(float(mae), 2),
        "rmse": round(float(rmse), 2),
        "baseline_mae": round(float(baseline_mae), 2),
        "baseline_r2": round(float(baseline_r2), 3),
        "test_rows": int(len(y_test)),
        "fit_ms": round(fit_ms, 1),
        "target_mean": round(float(np.mean(y_test)), 2),
        "cv": cv,
        "cv_baseline": cv_baseline,
        "tuned": {"params": tuned_params} if tuned_params else None,
        "verdict": _regression_verdict(test_r2, mae, baseline_mae, cv, cv_baseline),
    }


def _add_leak_note(result: dict, prepared) -> dict:
    """Mention any columns we left out because they gave the target away.

    A low score is often the doing of the columns we removed, and the user
    deserves to know that rather than to wonder what they did wrong.
    """
    leaked = getattr(prepared, "dropped_leaks", None)
    if not leaked:
        return result
    names = ", ".join(f"'{name}'" for name in leaked[:3])
    result["verdict"] = dict(result["verdict"])
    result["verdict"]["text"] += (
        f" Note: {names} {'were' if len(leaked) > 1 else 'was'} left out because it "
        f"gave the answer away, so the model had less to learn from. Turn off "
        f"'Drop columns that give the answer away' in the preparation step to see "
        f"the difference."
    )
    return result


def train_model(model_id: str, prepared, tune: bool = False) -> dict:
    """Train one model and measure it honestly.

    Balances class weights when the target is at least 2:1 imbalanced
    (and says so), optionally runs a small randomized search over the
    model's few meaningful knobs, and cross-validates the exact model the
    user trains — same class weights, same tuned parameters — fold by fold.
    """
    seed = prepared.config.random_state
    task = prepared.task
    class_weight = _classification_weight(prepared)
    tuned_params = None

    folds = _usable_folds(prepared, 3) or 2

    grid = tuning_grid(model_id) if tune else {}
    if grid:
        model = build_model(model_id, seed, class_weight)
        search = RandomizedSearchCV(
            model,
            grid,
            n_iter=min(12, int(np.prod([len(v) for v in grid.values()]))),
            cv=_splitter(prepared, folds),
            scoring="accuracy" if task == "classification" else "r2",
            random_state=seed,
            error_score="raise",
        )
        start = time.perf_counter()
        search.fit(prepared.X_train, prepared.y_train)
        fit_ms = (time.perf_counter() - start) * 1000
        tuned_params = dict(search.best_params_)
        model = search.best_estimator_
    else:
        model = build_model(model_id, seed, class_weight)
        start = time.perf_counter()
        model.fit(prepared.X_train, prepared.y_train)
        fit_ms = (time.perf_counter() - start) * 1000

    y_pred = model.predict(prepared.X_test)

    def model_factory():
        fresh = build_model(model_id, seed, class_weight)
        if tuned_params:
            fresh.set_params(**tuned_params)
        return fresh

    # Cross-validation on the training rows. This is the number we trust:
    # a single test split of a few dozen rows swings by several points
    # depending on which rows it happened to hold back.
    cv_bundle = _cross_validate(prepared, model_factory)
    cv_baseline_bundle = _baseline_bundle(prepared) if cv_bundle else None

    def pick(bundle, key):
        return bundle[key] if bundle else None

    if task == "regression":
        result = _regression_result(model_id, model, prepared, fit_ms, y_pred,
                                    cv=pick(cv_bundle, "r2"),
                                    cv_baseline=pick(cv_baseline_bundle, "r2"),
                                    tuned_params=tuned_params)
    else:
        result = _classification_result(
            model_id, model, prepared, fit_ms, y_pred,
            cv=pick(cv_bundle, "accuracy"),
            cv_baseline=pick(cv_baseline_bundle, "accuracy"),
            cv_auc=pick(cv_bundle, "auc"),
            cv_baseline_auc=pick(cv_baseline_bundle, "auc"),
            class_weight=class_weight,
            tuned_params=tuned_params)

    result = _add_leak_note(result, prepared)

    # Keep the fitted model and its predictions: later steps build the
    # confusion matrix from them and use them for the prediction demo.
    return {"model": model, "y_pred": y_pred, "result": result}
