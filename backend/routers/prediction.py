"""Score new rows with a trained model and its fitted preprocessor."""

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from store import get_dataset, get_model

router = APIRouter(prefix="/api", tags=["prediction"])

MAX_ROWS = 1000


class PredictRequest(BaseModel):
    model_id: str
    rows: list[dict[str, Any]] = Field(..., min_length=1, max_length=MAX_ROWS)


@router.post("/datasets/{dataset_id}/predict")
def predict(dataset_id: str, request: PredictRequest):
    get_dataset(dataset_id)                  # 404 if the dataset is gone
    bundle = get_model(dataset_id, request.model_id)  # 409 if not trained
    predictor = bundle.get("predictor")
    if predictor is None:
        raise HTTPException(
            status_code=409,
            detail="This model was trained before predictions were supported. "
                   "Train it again.",
        )

    # Apply the training-time cleaning rules first, then the fitted
    # preprocessing pipeline. Missing columns become NaN and are imputed;
    # extra columns are ignored.
    raw_frame = pd.DataFrame(request.rows)
    frame = predictor["cleaner"].transform(raw_frame)
    pipeline = predictor["pipeline"]

    try:
        raw = pipeline.predict(frame)
    except Exception as err:
        raise HTTPException(
            status_code=400,
            detail=f"Could not score these rows: {err}",
        ) from err

    names = predictor.get("class_names") or []
    if predictor["task"] == "classification" and names:
        predictions = [names[int(value)] for value in raw]
    else:
        predictions = [float(value) for value in raw]

    probabilities = None
    if hasattr(pipeline, "predict_proba") and names:
        proba = pipeline.predict_proba(frame)
        probabilities = [
            {name: round(float(value), 4) for name, value in zip(names, row, strict=True)}
            for row in proba
        ]

    return {
        "model_id": request.model_id,
        "task": predictor["task"],
        "predictions": predictions,
        "probabilities": probabilities,
    }
