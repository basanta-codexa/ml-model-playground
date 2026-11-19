"""A small transformer that folds rare categories into one bucket.

The rule "values seen fewer than 20 times become 'other'" has to be learned
from the data, and learning it from all the data before splitting would leak
information from the test rows into training. Putting it inside the
scikit-learn pipeline means it is fitted on the training rows only, exactly
like the imputers and the scaler.
"""

from collections import Counter

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin


class RareCategoryGrouper(BaseEstimator, TransformerMixin):
    """Replace infrequent category values with a single label.

    A file with 1,201 different model names should not become 1,201
    almost-empty columns. The names that appear often (the popular models)
    are real signal, so we keep those and roll the rest into one "other"
    bucket.

    On small datasets the threshold is lowered automatically: a fixed count
    of 20 would throw away perfectly good categories in a 300-row file. The
    effective count is the smaller of the configured threshold and 1% of the
    rows, with a floor of 2. On large files the configured threshold remains
    the limit; raise ``rare_threshold`` in the preparation settings if a
    high-cardinality column still produces too many near-empty columns.
    """

    def __init__(self, threshold: int = 20, other_label: str = "other",
                 min_share: float = 0.01):
        self.threshold = threshold
        self.other_label = other_label
        self.min_share = min_share

    def fit(self, X, y=None):
        values = [str(v) for v in np.asarray(X, dtype=object).ravel()]
        counts = Counter(values)
        n = len(values)
        # Never ask for more than the data can support, and never throw away
        # a category that a meaningful share of the rows actually have.
        effective = max(2, min(self.threshold, int(round(self.min_share * n))))
        self.effective_threshold_ = effective
        self.keep_ = {value for value, count in counts.items() if count >= effective}
        self.frequencies_ = counts
        return self

    def transform(self, X):
        array = np.asarray(X, dtype=object)
        flat = array.ravel()
        out = np.array(
            [value if value in self.keep_ else self.other_label for value in flat],
            dtype=object,
        )
        # Keep the shape the input had, so the next step in the pipeline
        # (the one-hot encoder) still sees a 2D array.
        if array.ndim == 1:
            return out.reshape(-1, 1)
        return out.reshape(array.shape)

    def get_feature_names_out(self, input_features=None):
        if input_features is not None:
            return np.asarray(input_features, dtype=object)
        return np.array([self.other_label], dtype=object)
