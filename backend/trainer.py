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
the one we trust; the single split is kept so the two can be compared. For
tuned models the cross-validation is nested: an inner search picks the
parameters, and the outer folds score the *procedure* on rows the search
never saw. Reporting the chosen parameters' score on the rows that chose
them would be selection bias, not an estimate.
"""

import time

import numpy as np
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    make_scorer,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_fscore_support,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    KFold,
    RandomizedSearchCV,
    StratifiedKFold,
    cross_val_predict,
    cross_validate,
)
from sklearn.pipeline import Pipeline

from models import MODELS, build_model, tuning_grid
from preprocessing import build_preprocessor

# CV bundles that readers expect as percentages (0-100). AUC and R-squared
# stay as ratios; sklearn's loss scorers come back negative and are flipped.
_PERCENT_METRICS = {"accuracy", "precision", "recall", "f1", "f1_weighted"}
_LOSS_METRICS = {"mae", "rmse"}
_CLASSIFICATION_METRICS = ("accuracy", "auc", "precision", "recall", "f1", "f1_weighted")
_REGRESSION_METRICS = ("r2", "mae", "rmse")


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
    values = np.asarray(values, dtype=float)
    if metric in _PERCENT_METRICS:
        values = values * 100
    elif metric in _LOSS_METRICS:
        # sklearn exposes MAE/RMSE as *negative* scores (higher is better).
        # Flip them so the reader sees a real error in the target's units.
        values = -values
    return {
        "metric": metric,
        "folds": [round(float(v), 3) for v in values],
        "mean": round(float(values.mean()), 3),
        "std": round(float(values.std()), 3),
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


def _classification_scoring(n_classes: int) -> dict:
    """Every classification metric we report, cross-validated per fold."""
    return {
        "accuracy": "accuracy",
        "auc": _auc_scorer(n_classes),
        "precision": make_scorer(precision_score, average="macro", zero_division=0),
        "recall": make_scorer(recall_score, average="macro", zero_division=0),
        "f1": make_scorer(f1_score, average="macro", zero_division=0),
        "f1_weighted": make_scorer(f1_score, average="weighted", zero_division=0),
    }


def _regression_scoring() -> dict:
    """R2 plus the two error metrics, cross-validated per fold."""
    return {
        "r2": "r2",
        "mae": "neg_mean_absolute_error",
        "rmse": "neg_root_mean_squared_error",
    }


def _cross_validate(prepared, build, tune_spec: dict | None = None) -> dict | None:
    """Cross-validate a freshly built model inside every fold.

    Returns accuracy/AUC/precision/recall/F1 (macro and weighted) bundles for
    classifiers and R2/MAE/RMSE bundles for regressors. Every fold rebuilds
    the preprocessor and the model from scratch.

    When ``tune_spec`` is given the folds are *nested*: an inner
    RandomizedSearchCV chooses hyperparameters on the outer fold's training
    rows, and the score is measured on that outer fold's held-out rows. That
    is the only honest estimate for a tuned model — scoring the chosen
    parameters on the very rows that chose them is selection bias.
    """
    n_splits = _usable_folds(prepared, prepared.config.cv_folds)
    if n_splits is None:
        return None
    splitter = _splitter(prepared, n_splits)

    estimator = _fresh_pipeline(prepared, build())
    if tune_spec is not None:
        # The pipeline's estimator step is named "model", so the grid keys
        # need that prefix when the search wraps the whole pipeline.
        grid = {f"model__{name}": values for name, values in tune_spec["grid"].items()}
        estimator = RandomizedSearchCV(
            estimator,
            grid,
            n_iter=tune_spec["n_iter"],
            cv=_splitter(prepared, tune_spec["inner_folds"]),
            scoring=tune_spec["scoring"],
            random_state=tune_spec["seed"],
            error_score="raise",
        )

    if prepared.task == "classification":
        scoring = _classification_scoring(len(prepared.class_names))
        names = _CLASSIFICATION_METRICS
    else:
        scoring = _regression_scoring()
        names = _REGRESSION_METRICS

    try:
        raw = cross_validate(
            estimator,
            prepared.X_train_raw,
            prepared.y_train,
            cv=splitter,
            scoring=scoring,
            error_score="raise",
            return_train_score=True,
        )
    except ValueError:
        # A fold where the model cannot be fitted (one class missing, say).
        return None

    result = {
        name: _cv_result(raw[f"test_{name}"], name, n_splits)
        for name in names
    }
    if prepared.task == "classification":
        # Training-fold accuracy comes from the same folds as the headline
        # score, so the two can be compared without mixing data sources.
        result["train_accuracy"] = _cv_result(
            raw["train_accuracy"], "accuracy", n_splits)
    return result


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
             cv: dict | None = None, cv_baseline: dict | None = None,
             cv_train: dict | None = None) -> dict:
    """Explain the score in plain language.

    Score, baseline and training score all come from the same source: either
    every value is cross-validated, or every value comes from the single
    held-out split. The margin around the baseline grows with the fold spread,
    so a small lead on an unstable score is not reported as a real finding.
    """
    if cv and cv_baseline:
        score = cv["mean"]
        base = cv_baseline["mean"]
        spread = cv["std"]
        train = cv_train["mean"] if cv_train else _pct(train_acc)
        margin = max(2.0, spread)
        source = (f"Cross-validated over {cv['n_splits']} folds, it scores "
                  f"{score:g}%, plus or minus {spread:g} points.")
        train_source = "the training folds" if cv_train else "the training rows"
    else:
        score = _pct(test_acc)
        base = _pct(baseline_acc)
        spread = 0.0
        train = _pct(train_acc)
        margin = 2.0
        source = f"On the held-out test rows it scores {score:g}%."
        train_source = "the training rows"

    if score < base - margin:
        return {
            "tone": "bad",
            "title": "Worse than guessing",
            "text": f"Always guessing the most common class scores {base:g}%, and this "
                    f"model scores {score:g}%. {source} It did not just fail to learn, it "
                    f"picked up patterns that do not hold on new rows. That usually means "
                    f"the columns are not what the model needs, or there is too little "
                    f"data for the pattern to be real.",
        }
    if score <= base + margin:
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
            "text": f"{train:g}% on {train_source} but only {score:g}% on rows it had not "
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
                f"The model is finding a pattern that holds on rows it was not fitted on.",
    }


def _regression_verdict(r2: float, mae: float, baseline_mae: float,
                        cv: dict | None = None,
                        cv_baseline: dict | None = None,
                        cv_mae: dict | None = None,
                        cv_baseline_mae: dict | None = None) -> dict:
    """Explain a regression score, comparing like with like.

    When cross-validation is available both the R-squared and the MAE (and
    its baseline) come from the CV bundles. Otherwise all three come from
    the single held-out split. Comparing a CV R-squared with a single-split
    MAE would be mixing sources and could tell the user the wrong story.
    """
    if cv and cv_mae is not None and cv_baseline_mae is not None:
        score = cv["mean"]
        spread = cv["std"]
        effective_mae = cv_mae["mean"]
        effective_base_mae = cv_baseline_mae["mean"]
        source = (f"Cross-validated over {cv['n_splits']} folds, it reaches an "
                  f"R-squared of {score:.2f}, plus or minus {spread:.2f}, with a typical "
                  f"error of {effective_mae:,.0f}.")
    else:
        score = r2
        spread = 0.0
        effective_mae = mae
        effective_base_mae = baseline_mae
        source = f"On the held-out test rows it reaches an R-squared of {score:.2f}."

    if effective_base_mae <= 0:
        return {
            "tone": "bad",
            "title": "Nothing to compare against",
            "text": "The target has no variation to predict, so there is no way to "
                    "tell a good model from a bad one here.",
        }
    if effective_mae > effective_base_mae * 1.02:
        return {
            "tone": "bad",
            "title": "Worse than guessing the average",
            "text": f"Always predicting the average is off by {effective_base_mae:,.0f} on "
                    f"average. This model is off by {effective_mae:,.0f}, so it did not just "
                    f"fail to find the pattern, it found one that does not hold on new rows.",
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
                    f"variation in the target, and is off by {effective_mae:,.0f} on a typical "
                    f"row. {source} There is probably more signal in the data.",
        }
    return {
        "tone": "good",
        "title": "Learned something real",
        "text": f"R-squared {score:.2f}: the model explains {score:.0%} of the variation "
                f"in the target, and beats the average by "
                f"{100 * (1 - effective_mae / effective_base_mae):.0%}. {source}",
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
                            tuned_params=None, cv_precision=None,
                            cv_recall=None, cv_f1=None, cv_f1_weighted=None,
                            cv_train=None, oof_confusion_matrix=None, oof_per_class=None) -> dict:
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
        # Out-of-fold metrics over the TRAINING rows. Support here sums to
        # the number of training rows, which makes per-class support a
        # meaningful count rather than a handful of holdout rows.
        "oof_confusion_matrix": oof_confusion_matrix,
        "oof_per_class": oof_per_class,
        "class_weight": class_weight,
        "tuned": {"params": tuned_params} if tuned_params else None,
        "cv": cv,
        "cv_auc": cv_auc,
        "cv_baseline": cv_baseline,
        "cv_baseline_auc": cv_baseline_auc,
        "cv_precision": cv_precision,
        "cv_recall": cv_recall,
        "cv_f1": cv_f1,
        "cv_f1_weighted": cv_f1_weighted,
        "cv_train": cv_train,
        "verdict": _verdict(train_acc, test_acc, baseline_acc, cv, cv_baseline,
                            cv_train),
    }


def _regression_result(model_id, model, prepared, fit_ms, y_pred,
                       cv=None, cv_baseline=None, tuned_params=None,
                       cv_mae=None, cv_rmse=None, cv_baseline_mae=None) -> dict:
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
        "cv_mae": cv_mae,
        "cv_rmse": cv_rmse,
        "cv_baseline_mae": cv_baseline_mae,
        "tuned": {"params": tuned_params} if tuned_params else None,
        "verdict": _regression_verdict(test_r2, mae, baseline_mae, cv, cv_baseline,
                                       cv_mae, cv_baseline_mae),
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

    For tuned models the reported cross-validation is *nested*: outer folds
    give the estimate, inner folds run the search. The final model the user
    keeps is still fitted with the best parameters found on the full
    training rows.
    """
    seed = prepared.config.random_state
    task = prepared.task
    class_weight = _classification_weight(prepared)
    tuned_params = None

    grid = tuning_grid(model_id) if tune else {}
    tune_spec = None
    # A stratified search needs at least two rows in the smallest class.
    # When a split leaves a class with a single row, no stratified fold can
    # be built and StratifiedKFold would raise (surfacing as a 500). Train
    # with the model's defaults instead of pretending to tune.
    inner_folds = _usable_folds(prepared, 3) if grid else None
    if grid and inner_folds is not None:
        n_iter = min(12, int(np.prod([len(v) for v in grid.values()])))
        inner_scoring = "accuracy" if task == "classification" else "r2"
        model = build_model(model_id, seed, class_weight)
        search = RandomizedSearchCV(
            model,
            grid,
            n_iter=n_iter,
            cv=_splitter(prepared, inner_folds),
            scoring=inner_scoring,
            random_state=seed,
            error_score="raise",
        )
        start = time.perf_counter()
        search.fit(prepared.X_train, prepared.y_train)
        fit_ms = (time.perf_counter() - start) * 1000
        tuned_params = dict(search.best_params_)
        model = search.best_estimator_
        # The reported estimate must not reuse the rows that picked these
        # parameters, so the outer cross-validation re-runs the search.
        tune_spec = {
            "grid": grid,
            "n_iter": n_iter,
            "inner_folds": inner_folds,
            "scoring": inner_scoring,
            "seed": seed,
        }
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

    cv_bundle = _cross_validate(prepared, model_factory, tune_spec=tune_spec)
    cv_baseline_bundle = _baseline_bundle(prepared) if cv_bundle else None

    def pick(bundle, key):
        return bundle[key] if bundle else None

    # Out-of-fold predictions over the training rows give per-class support
    # that actually means something (one row per training example), and a
    # confusion matrix free of the tiny holdout's noise. The original
    # holdout-based fields stay untouched for backward compatibility.
    # For tuned runs the parameters were chosen on all training rows, so OOF
    # predictions made with them would carry the same selection bias the
    # nested CV was introduced to remove. Withhold the fields in that case
    # rather than publish a flattering number.
    oof_confusion = None
    oof_per_class = None
    if task == "classification" and cv_bundle is not None and tune_spec is None:
        oof_pred = cross_val_predict(
            _fresh_pipeline(prepared, model_factory()),
            prepared.X_train_raw,
            prepared.y_train,
            cv=_splitter(prepared, cv_bundle["accuracy"]["n_splits"]),
        )
        labels = list(range(len(prepared.class_names)))
        oof_confusion = confusion_matrix(
            prepared.y_train, oof_pred, labels=labels).tolist()
        oof_per_class = _per_class(
            prepared.y_train, oof_pred, prepared.class_names)

    if task == "regression":
        result = _regression_result(
            model_id, model, prepared, fit_ms, y_pred,
            cv=pick(cv_bundle, "r2"),
            cv_baseline=pick(cv_baseline_bundle, "r2"),
            cv_mae=pick(cv_bundle, "mae"),
            cv_rmse=pick(cv_bundle, "rmse"),
            cv_baseline_mae=pick(cv_baseline_bundle, "mae"),
            tuned_params=tuned_params,
        )
    else:
        result = _classification_result(
            model_id, model, prepared, fit_ms, y_pred,
            cv=pick(cv_bundle, "accuracy"),
            cv_baseline=pick(cv_baseline_bundle, "accuracy"),
            cv_auc=pick(cv_bundle, "auc"),
            cv_baseline_auc=pick(cv_baseline_bundle, "auc"),
            cv_precision=pick(cv_bundle, "precision"),
            cv_recall=pick(cv_bundle, "recall"),
            cv_f1=pick(cv_bundle, "f1"),
            cv_f1_weighted=pick(cv_bundle, "f1_weighted"),
            cv_train=pick(cv_bundle, "train_accuracy"),
            oof_confusion_matrix=oof_confusion,
            oof_per_class=oof_per_class,
            class_weight=class_weight,
            tuned_params=tuned_params,
        )

    result = _add_leak_note(result, prepared)

    # Keep the fitted model and its predictions: later steps build the
    # confusion matrix from them and use them for the prediction demo.
    return {"model": model, "y_pred": y_pred, "result": result}
