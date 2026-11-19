"""Mixed currencies must never be collapsed onto one numeric scale."""

import pandas as pd

from infer import infer_column
from preprocessing import PreprocessConfig, prepare


def test_mixed_currencies_are_split_into_separate_columns():
    frame = pd.DataFrame({
        "Spend": ["$100", "$200", "\u20b9300", "400 INR", "500 USD"] * 4,
        "Group": ["a", "b"] * 10,
    })

    info = infer_column(frame["Spend"])
    assert info.kind == "numeric"
    assert info.mixed_currency is True
    assert set(info.currencies) == {"USD", "INR"}
    assert any(n["title"] == "Mixed currencies in one column" for n in info.notes)

    prepared, summary = prepare(frame, PreprocessConfig(target="Group"))
    numeric = summary["numeric_columns"]
    assert "Spend (USD)" in numeric
    assert "Spend (INR)" in numeric
    assert "Spend" not in numeric

    # The two columns hold disjoint rows; nothing was merged into one scale.
    usd = prepared.X_train_raw["Spend (USD)"]
    inr = prepared.X_train_raw["Spend (INR)"]
    assert ((usd.notna()) & (inr.notna())).sum() == 0


def test_one_currency_stays_a_single_column():
    frame = pd.DataFrame({
        "Spend": ["$100", "$200", "$300", "$400"] * 5,
        "Group": ["a", "b"] * 10,
    })

    info = infer_column(frame["Spend"])
    assert info.mixed_currency is False

    _prepared, summary = prepare(frame, PreprocessConfig(target="Group"))
    assert "Spend" in summary["numeric_columns"]
    assert not any("(USD)" in c for c in summary["numeric_columns"])
