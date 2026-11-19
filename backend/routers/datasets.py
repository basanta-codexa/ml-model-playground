from fastapi import APIRouter, File, HTTPException, UploadFile

from csvio import clean_frame, parse_csv
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
    raw = df.to_csv(index=False).encode("utf-8")
    dataset_id, persisted = save_dataset(raw, meta["label"],
                                         df.shape[0], df.shape[1])
    summary = build_summary(dataset_id, meta["label"], df,
                            suggested_target=meta["target"])
    summary["persisted"] = persisted
    return summary


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

    try:
        df, encoding_note = parse_csv(raw)
        df = clean_frame(df)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    if df.shape[1] < MIN_COLUMNS:
        raise HTTPException(
            status_code=400, detail=f"Need at least {MIN_COLUMNS} columns.")
    if df.shape[0] < MIN_ROWS:
        raise HTTPException(
            status_code=400, detail=f"Need at least {MIN_ROWS} rows to train a model.")

    dataset_id, persisted = save_dataset(raw, file.filename or "upload.csv",
                                         df.shape[0], df.shape[1])
    summary = build_summary(dataset_id, file.filename or "upload.csv", df)
    summary["persisted"] = persisted
    if encoding_note:
        summary["encoding_note"] = encoding_note
    return summary


@router.get("/datasets/{dataset_id}/profile")
def get_profile(dataset_id: str):
    entry = get_dataset(dataset_id)
    return build_profile(entry["df"])
