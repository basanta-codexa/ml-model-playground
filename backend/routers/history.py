from fastapi import APIRouter, HTTPException

from store import get_run, list_runs

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
def history(limit: int = 10):
    """The most recent training runs, newest first."""
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100.")
    runs = list_runs(limit)
    if runs is None:
        raise HTTPException(
            status_code=503,
            detail="History is unavailable — the database is not reachable.")
    return runs


@router.get("/history/{run_id}")
def run_detail(run_id: int):
    """One saved run, exactly as the UI rendered it the first time."""
    run = get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="No such run.")
    return run
