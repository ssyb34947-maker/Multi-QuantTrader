import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.strategy import Strategy
from app.schemas.strategy import StrategyCreate, StrategyUpdate, StrategyOut
from app.api.deps import ok, paginated

router = APIRouter(prefix="/strategies", tags=["Strategies"])


@router.get("")
async def list_strategies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_q = select(func.count(Strategy.id)).where(Strategy.user_id == current_user.id)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Strategy)
        .where(Strategy.user_id == current_user.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Strategy.updated_at.desc())
    )
    result = await db.execute(q)
    items = [StrategyOut.model_validate(s).model_dump() for s in result.scalars().all()]
    return paginated(items, total, page, page_size)


@router.get("/{strategy_id}")
async def get_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id, Strategy.user_id == current_user.id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strategy not found")
    return ok(StrategyOut.model_validate(s).model_dump())


@router.post("")
async def create_strategy(
    data: StrategyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = Strategy(
        name=data.name,
        description=data.description,
        code=data.code,
        language=data.language,
        tags=json.dumps(data.tags, ensure_ascii=False),
        user_id=current_user.id,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return ok(StrategyOut.model_validate(s).model_dump(), "Strategy created")


@router.put("/{strategy_id}")
async def update_strategy(
    strategy_id: int,
    data: StrategyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id, Strategy.user_id == current_user.id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strategy not found")

    update_data = data.model_dump(exclude_unset=True)
    if "tags" in update_data and update_data["tags"] is not None:
        update_data["tags"] = json.dumps(update_data["tags"], ensure_ascii=False)
    for key, value in update_data.items():
        setattr(s, key, value)

    await db.commit()
    await db.refresh(s)
    return ok(StrategyOut.model_validate(s).model_dump(), "Strategy updated")


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id, Strategy.user_id == current_user.id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strategy not found")
    await db.delete(s)
    await db.commit()
    return ok(None, "Strategy deleted")
