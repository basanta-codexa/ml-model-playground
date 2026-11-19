"""Reading and pre-cleaning CSVs.

Both the upload route and the database rehydrate path need the exact same
decoding and cleanup, so it lives here instead of being copy-pasted.
"""

import codecs
import io
from collections import Counter

import pandas as pd


def parse_csv(raw: bytes) -> tuple[pd.DataFrame, str | None]:
    """Decode and parse the file.

    Returns the frame and a note when we had to guess the encoding. A file
    that is not valid UTF-8 must not turn into silent mojibake, so we try
    UTF-16 (BOM or NULs), then UTF-8, then Windows-1252, and we say which
    one we used. Raises ValueError otherwise.
    """
    def read(encoding: str) -> pd.DataFrame:
        return pd.read_csv(io.BytesIO(raw), encoding=encoding)

    # UTF-16 almost always carries a byte-order mark; a file full of NUL
    # bytes is almost always UTF-16 without one.
    if raw.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        try:
            return read("utf-16"), "Read as UTF-16 (byte-order mark found)."
        except Exception as err:
            raise ValueError("Could not parse the file as a UTF-16 CSV.") from err
    if raw[:4096].count(b"\x00") > 64:
        try:
            return read("utf-16"), "Read as UTF-16 (the file contains NUL bytes)."
        except Exception:
            pass  # fall through to the single-byte encodings

    decoders = (
        ("utf-8-sig", None),
        ("cp1252", "The file was not valid UTF-8, so it was read as Windows-1252. "
                   "Check any special characters."),
    )
    for encoding, fallback_note in decoders:
        try:
            df = read(encoding)
        except UnicodeDecodeError:
            continue
        except pd.errors.EmptyDataError as err:
            raise ValueError("The file is empty.") from err
        except pd.errors.ParserError as err:
            raise ValueError("Could not parse the file as a CSV.") from err
        return df, fallback_note

    raise ValueError("Could not read the file's text encoding.")


def clean_frame(df: pd.DataFrame) -> pd.DataFrame:
    """The cleanup every uploaded frame gets before anything looks at it."""
    df.columns = [str(c).strip() for c in df.columns]
    _reject_duplicate_columns(df)
    # Drop fully empty rows/columns (common leftovers from spreadsheet exports)
    return df.dropna(how="all").dropna(axis=1, how="all")


def _reject_duplicate_columns(df: pd.DataFrame) -> None:
    counts = Counter(df.columns)
    dups = sorted(name for name, n in counts.items() if n > 1)
    if dups:
        shown = ", ".join(repr(d) for d in dups[:5])
        raise ValueError(
            f"Two columns share the same name after trimming spaces: {shown}. "
            f"Rename them and upload again.")
