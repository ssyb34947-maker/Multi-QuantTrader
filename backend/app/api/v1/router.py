from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.strategies import router as strategies_router
from app.api.v1.backtests import router as backtests_router
from app.api.v1.agents import router as agents_router
from app.api.v1.portfolios import router as portfolios_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.data import router as data_router
from app.api.v1.fund import router as fund_router

router = APIRouter(prefix="/api")
router.include_router(auth_router)
router.include_router(strategies_router)
router.include_router(backtests_router)
router.include_router(agents_router)
router.include_router(portfolios_router)
router.include_router(dashboard_router)
router.include_router(data_router)
router.include_router(fund_router)
