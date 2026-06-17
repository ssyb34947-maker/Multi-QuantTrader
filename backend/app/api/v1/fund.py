"""Fund API - Multi-agent fund orchestration endpoints."""

from fastapi import APIRouter, HTTPException, Query, status

from app.services.agents.orchestrator import FundOrchestrator
from app.api.deps import ok

router = APIRouter(prefix="/fund", tags=["Fund"])

# Singleton orchestrator instance
_orchestrator: FundOrchestrator | None = None


def _get_orchestrator() -> FundOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = FundOrchestrator()
    return _orchestrator


@router.post("/run")
async def run_fund_cycle(
    as_of_date: str = Query("2026-05-20", description="Analysis cut-off date"),
    predict_days: int = Query(5, description="Days to predict forward"),
):
    """Run a complete 多智星基金 trading cycle through all agents.

    Analyzes market data up to as_of_date, generates trading signals,
    executes orders, then predicts forward N days and tests performance.
    """
    orchestrator = _get_orchestrator()
    try:
        result = await orchestrator.run_full_cycle(
            as_of_date=as_of_date, predict_days=predict_days
        )
        return ok(result, "Fund cycle completed")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fund cycle failed: {str(e)}",
        )


@router.get("/status")
async def get_fund_status():
    """Get current fund orchestrator status."""
    orchestrator = _get_orchestrator()
    return ok(orchestrator.get_status())


@router.get("/run/{run_id}")
async def get_fund_run(run_id: str):
    """Get result of a specific fund run."""
    orchestrator = _get_orchestrator()
    result = orchestrator.get_run_result(run_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} not found",
        )
    return ok(result)
