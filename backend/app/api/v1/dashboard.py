import json

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.strategy import Strategy
from app.models.backtest import Backtest
from app.models.agent import Agent
from app.models.portfolio import Portfolio
from app.schemas.common import DashboardSummary, EquityPoint
from app.api.deps import ok

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _make_equity_point(date: str, value: float) -> EquityPoint:
    return EquityPoint(date=date, value=value)


@router.get("/summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id

    # Strategies
    strat_count = (await db.execute(
        select(func.count(Strategy.id)).where(Strategy.user_id == uid)
    )).scalar() or 0
    active_strat = (await db.execute(
        select(func.count(Strategy.id)).where(Strategy.user_id == uid, Strategy.status == "active")
    )).scalar() or 0

    # Backtests
    bt_total = (await db.execute(
        select(func.count(Backtest.id)).where(Backtest.user_id == uid)
    )).scalar() or 0
    bt_running = (await db.execute(
        select(func.count(Backtest.id)).where(Backtest.user_id == uid, Backtest.status == "running")
    )).scalar() or 0

    # Agent
    agent_total = (await db.execute(
        select(func.count(Agent.id)).where(Agent.user_id == uid)
    )).scalar() or 0
    agent_active = (await db.execute(
        select(func.count(Agent.id)).where(Agent.user_id == uid, Agent.status == "running")
    )).scalar() or 0

    # Portfolio
    port_result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == uid).order_by(Portfolio.created_at.desc()).limit(1)
    )
    portfolio = port_result.scalar_one_or_none()

    portfolio_value = portfolio.current_value if portfolio else 0.0
    total_pnl = portfolio.total_pnl if portfolio else 0.0
    win_rate = portfolio.win_rate if portfolio else 0.0

    # Equity curve from portfolio
    equity_curve = []
    if portfolio and portfolio.equity_curve_json:
        try:
            raw = json.loads(portfolio.equity_curve_json)
            equity_curve = [_make_equity_point(e.get("date", ""), e.get("value", e.get("equity", 0))) for e in raw]
        except (json.JSONDecodeError, TypeError):
            equity_curve = []

    # Or get from latest completed backtest
    if not equity_curve:
        bt_result = await db.execute(
            select(Backtest).where(
                Backtest.user_id == uid,
                Backtest.status == "completed",
                Backtest.result_json.isnot(None),
            ).order_by(Backtest.created_at.desc()).limit(1)
        )
        latest_bt = bt_result.scalar_one_or_none()
        if latest_bt and latest_bt.result_json:
            try:
                result_data = json.loads(latest_bt.result_json)
                for pt in result_data.get("equity_curve", []):
                    equity_curve.append(_make_equity_point(pt["date"], pt["equity"]))
            except (json.JSONDecodeError, TypeError, KeyError):
                pass

    summary = DashboardSummary(
        total_strategies=strat_count,
        active_strategies=active_strat,
        total_backtests=bt_total,
        running_backtests=bt_running,
        total_agents=agent_total,
        active_agents=agent_active,
        portfolio_value=portfolio_value,
        total_pnl=total_pnl,
        daily_pnl=total_pnl * 0.01,  # rough estimate
        equity_curve=equity_curve,
        recent_trades=portfolio.total_trades if portfolio else 0,
        win_rate=win_rate,
    )

    return ok(summary.model_dump())
