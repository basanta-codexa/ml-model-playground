"""Deterministic cleaning of new rows, using the decisions made at training time.

The preprocessing pipeline expects *cleaned* columns: numbers parsed out of
text, units converted, spellings folded. Those decisions were inferred from
the training file, so new rows have to be cleaned with the same rules rather
than being inferred again from a handful of new values.
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from infer import ColumnInfo, clean_numeric
from parsing import parse_column, suggest_extra_units
from textnorm import canonical_key, clean_text, display_spellings, is_nullish


def _clean_label(value, display: dict):
    text = clean_text(value)
    if not text or is_nullish(text):
        return np.nan
    return display.get(canonical_key(text), text)


@dataclass
class RawCleaner:
    """Apply the training-time cleaning rules to a frame of new rows."""

    features: list[str]
    numeric: dict = field(default_factory=dict)
    categorical: dict = field(default_factory=dict)

    def transform(self, raw: pd.DataFrame) -> pd.DataFrame:
        out = pd.DataFrame(index=raw.index)
        blank = pd.Series([np.nan] * len(raw), index=raw.index, dtype=object)

        for name, spec in self.numeric.items():
            series = raw[name] if name in raw.columns else blank
            info = ColumnInfo(
                name=name,
                kind="numeric",
                dimension=spec["dimension"],
                mixed=spec["mixed"],
                split_columns=spec["split_columns"],
                unit=spec["unit"],
            )
            pairs, _ = clean_numeric(series, info, extra_units=set(spec["extra_units"]))
            for new_name, values in pairs:
                out[new_name] = values

        for name, display in self.categorical.items():
            series = raw[name] if name in raw.columns else blank
            out[name] = series.map(
                lambda value, display=display: _clean_label(value, display))

        return out.reindex(columns=self.features)


def build_raw_cleaner(source: pd.DataFrame, infos: list, features: list[str]) -> RawCleaner:
    """Freeze the cleaning decisions inferred from the training file."""
    numeric = {}
    categorical = {}

    for info in infos:
        if info.kind == "numeric":
            names = ([split["name"] for split in info.split_columns]
                     if info.mixed else [info.name])
            if not any(name in features for name in names):
                continue
            cells, _ = parse_column(source[info.name].tolist())
            numeric[info.name] = {
                "dimension": info.dimension,
                "mixed": info.mixed,
                "split_columns": info.split_columns,
                "unit": info.unit,
                "extra_units": sorted(suggest_extra_units(cells)),
            }
        elif info.kind == "categorical" and info.name in features:
            categorical[info.name] = display_spellings(source[info.name].tolist())

    return RawCleaner(features=list(features), numeric=numeric, categorical=categorical)
