import codecs
import io
from collections import Counter

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from profiling import build_profile
from samples import SAMPLES, build_sample, list_samples
from showcase import get_showcase
from store import get_dataset, save_dataset
from summary import build_summary

router = APIRouter(prefix="/api", tags=["datasets"])

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
MIN_ROWS = 10
MIN_COLUMNS = 2


@router.get("/showcase")
def showcase():
    """The numbers on the landing page, from a real run on a real dataset."""
    return get_showcase()


def parse_csv(raw: bytes) -> tuple[pd.DataFrame, str | None]:
    """Decode and parse the file.

    Returns the frame and a note when we had to guess the encoding. A file
    that is not valid UTF-8 must not turn into silent mojibake, so we try
    UTF-16 (BOM or NULs), then UTF-8, then Windows-1252, and we say which
    one we used. Anything else raises a clean 400.
    """
    def read(encoding: str) -> pd.DataFrame:
        return pd.read_csv(io.BytesIO(raw), encoding=encoding)

    # UTF-16 almost always carries a byte-order mark; a file full of NUL
    # bytes is almost always UTF-16 without one.
    if raw.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        try:
            return read("utf-16"), "Read as UTF-16 (byte-order mark found)."
        except Exception as err:
            raise HTTPException(
                status_code=400, detail="Could not parse the file as a UTF-16 CSV.") from err
    if raw[:4096].count(b"\x00") > 64:
        try:
            return read("utf-16"), "Read as UTF-16 (the file contains NUL bytes)."
        except Exception:
            pass  # fall through to the single-byte encodings

    decoders = (("utf-8-sig", None), ("cp1252", "The file was not valid UTF-8, so it was read as Windows-1252. Check any special characters."))
    for encoding, fallback_note in decoders:
        try:
            df = read(encoding)
        except UnicodeDecodeError:
            continue
        except pd.errors.EmptyDataError as err:
            raise HTTPException(status_code=400, detail="The file is empty.") from err
        except pd.errors.ParserError as err:
            raise HTTPException(
                status_code=400, detail="Could not parse the file as a CSV.") from err
        return df, fallback_note

    raise HTTPException(
        status_code=400, detail="Could not read the file's text encoding.")


def _reject_duplicate_columns(df: pd.DataFrame) -> None:
    counts = Counter(df.columns)
    dups = sorted(name for name, n in counts.items() if n > 1)
    if dups:
        shown = ", ".join(repr(d) for d in dups[:5])
        raise HTTPException(
            status_code=400,
            detail=(f"Two columns share the same name after trimming spaces: {shown}. "
                    f"Rename them and upload again."),
        )


@router.get("/samples")
def get_samples():
    return list_samples()


@router.post("/samples/{sample_id}")
def load_sample(sample_id: str):
    if sample_id not in SAMPLES:
        raise HTTPException(
            status_code=404, detail=f"Unknown sample dataset: {sample_id}")
    meta = SAMPLES[sample_id]
    df = build_sample(sample_id)
    dataset_id = save_dataset(df, meta["label"])
    return build_summary(dataset_id, meta["label"], df, suggested_target=meta["target"])


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(
            status_code=400, detail="Please upload a .csv file.")

    # Read one byte past the limit so we can tell "too big" without loading everything
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=413, detail="File is too large (max 10 MB).")

    df, encoding_note = parse_csv(raw)
    df.columns = [str(c).strip() for c in df.columns]
    _reject_duplicate_columns(df)
    # Drop fully empty rows/columns (common leftovers from spreadsheet exports)
    df = df.dropna(how="all").dropna(axis=1, how="all")

    if df.shape[1] < MIN_COLUMNS:
        raise HTTPException(
            status_code=400, detail=f"Need at least {MIN_COLUMNS} columns.")
    if df.shape[0] < MIN_ROWS:
        raise HTTPException(
            status_code=400, detail=f"Need at least {MIN_ROWS} rows to train a model.")

    dataset_id = save_dataset(df, file.filename)
    summary = build_summary(dataset_id, file.filename, df)
    if encoding_note:
        summary["encoding_note"] = encoding_note
    return summary


@router.get("/datasets/{dataset_id}/profile")
def get_profile(dataset_id: str):
    entry = get_dataset(dataset_id)
    return build_profile(entry["df"])
