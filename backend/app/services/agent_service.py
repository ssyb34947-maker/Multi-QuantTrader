from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.agent import Agent


async def get_agent_stats(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(
        select(
            func.count(Agent.id).label("total"),
            func.sum(func.cast(Agent.status == "running", int)).label("active"),
            func.coalesce(func.avg(Agent.win_rate), 0).label("avg_win_rate"),
            func.coalesce(func.sum(Agent.total_pnl), 0).label("total_pnl"),
        ).where(Agent.user_id == user_id)
    )
    row = result.one()
    return {
        "total_agents": row.total or 0,
        "active_agents": row.active or 0,
        "avg_win_rate": float(row.avg_win_rate or 0),
        "total_pnl": float(row.total_pnl or 0),
    }
