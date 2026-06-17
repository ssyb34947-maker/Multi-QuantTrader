import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.portfolio import Portfolio


async def get_portfolio_stats(db: AsyncSession, user_id: int) -> dict:
    # Get the latest portfolio for the user
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user_id).order_by(Portfolio.created_at.desc()).limit(1)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        return {
            "portfolio_value": 0.0,
            "total_pnl": 0.0,
            "win_rate": 0.0,
        }

    return {
        "portfolio_value": portfolio.current_value,
        "total_pnl": portfolio.total_pnl,
        "win_rate": portfolio.win_rate,
    }
