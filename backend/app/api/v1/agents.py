import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate, AgentOut, AgentConfigOut, AgentMetricsOut
from app.api.deps import ok, paginated

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("")
async def list_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_q = select(func.count(Agent.id)).where(Agent.user_id == current_user.id)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Agent)
        .where(Agent.user_id == current_user.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Agent.created_at.desc())
    )
    result = await db.execute(q)
    items = [AgentOut.from_orm_model(a).model_dump() for a in result.scalars().all()]
    return paginated(items, total, page, page_size)


@router.get("/{agent_id}")
async def get_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return ok(AgentOut.from_orm_model(a).model_dump())


@router.post("")
async def create_agent(
    data: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = Agent(
        name=data.name,
        role=data.role,
        model=data.model,
        strategy_id=data.strategy_id,
        config_json=data.config.model_dump_json(),
        user_id=current_user.id,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return ok(AgentOut.from_orm_model(a).model_dump(), "Agent created")


@router.put("/{agent_id}")
async def update_agent(
    agent_id: int,
    data: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    update_data = data.model_dump(exclude_unset=True)
    if "config" in update_data and update_data["config"] is not None:
        update_data["config_json"] = update_data.pop("config").model_dump_json()
    for key, value in update_data.items():
        setattr(a, key, value)

    await db.commit()
    await db.refresh(a)
    return ok(AgentOut.from_orm_model(a).model_dump(), "Agent updated")


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    await db.delete(a)
    await db.commit()
    return ok(None, "Agent deleted")


@router.post("/{agent_id}/start")
async def start_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    a.status = "running"
    await db.commit()
    return ok(None, "Agent started")


@router.post("/{agent_id}/stop")
async def stop_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    a.status = "stopped"
    await db.commit()
    return ok(None, "Agent stopped")
