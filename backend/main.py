import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import datasets, preprocess, training

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("ml_playground")

app = FastAPI(
    title="ML Model Playground API",
    description="Upload a dataset, train models, and get results as JSON."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(preprocess.router)
app.include_router(training.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Expected problems (bad upload, unknown dataset, ...) are raised as
    # HTTPException and handled by FastAPI. Anything that reaches here is a
    # bug: log the traceback, answer with a clean 500, never a stack trace.
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on the server. The error was logged."},
    )


@app.get("/")
def root():
    return {"app": "ML Model Playground", "status": "alive"}


@app.get("/api/health")
def health():
    """The frontend pings this to show a live 'API connected' badge."""
    return {"status": "ok", "version": app.version}
