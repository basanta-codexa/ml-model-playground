# ML Model Playground

A local tool for training models on CSV files. Upload a file, inspect and clean it, choose a target, train a classifier or regressor, and read the scores. The backend does the parsing and modelling; the frontend is a plain interface over the API.

## Features

- Reads CSVs in UTF-8, UTF-16 or Windows-1252; rejects duplicate column names and files over 10 MB.
- Parses numbers out of text (`$1,100`, `963 hp`, `3-5 days`), converts compatible units, splits columns that mix measurements, folds case variants, and treats `-`/`N/A` as missing.
- Detects feature columns that duplicate the target and can drop them. The majority-class baseline is reported with every score.
- Splits train/test before fitting anything. Imputers, encoders, scalers and rare-category grouping are fitted on training rows only and rebuilt inside each cross-validation fold.
- Classification: accuracy, precision, recall, F1 (macro and weighted), ROC AUC, per-class metrics and a confusion matrix.
- Regression: R², MAE and RMSE, compared with a model that always predicts the mean.
- Class weighting for imbalanced targets and an optional randomized parameter search.
- Scoring of new rows through the API. The fitted cleaner and preprocessor are stored with the model, so raw CSV-shaped rows can be sent for prediction.
- Optional Postgres storage for datasets and past runs. The app still works if the database is unavailable; responses then include `persisted: false`.

## Run locally

Backend (Python 3.10+):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on port 5173 and proxies `/api` to `http://localhost:8000`, where uvicorn serves the backend.

Database (optional). Start it with `docker compose up -d db` from the repository root, then set `DATABASE_URL` if you want a different instance:

```
postgresql://ml_playground:ml_playground@127.0.0.1:5433/ml_playground
```

## Tests

```bash
cd backend && python -m pytest tests -q
cd frontend && npm test
cd backend && ruff check .
cd frontend && npm run build
```

CI runs lint, backend tests against a Postgres service, frontend tests and a production build on every pull request. Database-dependent tests skip when no Postgres is reachable.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/upload` | Upload a CSV; returns a column summary and target suggestions |
| GET | `/api/samples` | List built-in sample datasets |
| POST | `/api/samples/{id}` | Load a sample dataset |
| GET | `/api/datasets/{id}/profile` | Per-column profiling and warnings |
| POST | `/api/datasets/{id}/preprocess` | Apply cleaning, splitting and preprocessing settings |
| GET | `/api/models?task=` | List algorithms for a task |
| POST | `/api/datasets/{id}/train` | Train one model; returns scores and verdict |
| POST | `/api/datasets/{id}/predict` | Score new rows with a trained model |
| GET | `/api/history` | List recent saved runs |
| GET | `/api/history/{id}` | Full saved result for one run |
| GET | `/api/health` | API and database status |

Training requires preprocessing to have been run for the dataset first.

## Layout

| Path | Responsibility |
| --- | --- |
| `backend/main.py`, `backend/routers/` | HTTP API |
| `backend/csvio.py`, `backend/textnorm.py`, `backend/parsing.py`, `backend/units.py`, `backend/infer.py` | File decoding and cell/column cleaning |
| `backend/leakage.py`, `backend/target.py` | Leak detection and target suggestions |
| `backend/preprocessing.py`, `backend/transformers.py` | Split and fitted preprocessing pipeline |
| `backend/models.py`, `backend/trainer.py` | Model registry, cross-validation, metrics, scoring |
| `backend/store.py`, `backend/db.py` | In-memory cache and Postgres persistence |
| `backend/tests/` | Backend tests |
| `frontend/src/components/` | UI components |

## Notes on scoring

Every score is compared with a baseline that uses no features: the most frequent class for classification, the mean for regression. Cross-validation runs on the training rows; the held-out split is kept in the response so the two can be compared. Fold scores, their mean and their standard deviation are returned for each reported metric.

Classification cross-validates accuracy, precision, recall, F1 (macro and weighted) and ROC AUC. Regression cross-validates R², MAE and RMSE. Untuned classifiers also get a confusion matrix and per-class metrics computed from out-of-fold predictions across the training rows; those fields are omitted when Quick tune is on, because parameters chosen on all training rows would bias them.

Quick tune reports a nested cross-validation estimate: an inner search selects parameters on each outer fold's training rows, and the outer fold scores the procedure on rows the search never saw. This makes tuned runs slower than untuned ones.

Cleaning that runs before the split (number parsing, unit conversion, spelling folding) is unsupervised and does not use target values. Some of it inspects all rows, including rows that later land in the test set. Everything that learns from data is fitted inside the fold.

The verdict compares a score with a baseline from the same source. The margin around the baseline grows with the fold spread, so a small lead on an unstable score is reported as noise. The overfitting check compares accuracy on the training folds with accuracy on held-out folds, not with a separate single split.

## Not implemented

- Feature importance
- UI for predicting new rows
- Deployment configuration
