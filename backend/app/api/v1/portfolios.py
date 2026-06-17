from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio
from app.schemas.portfolio import PortfolioCreate, PortfolioOut
from app.api.deps import ok, paginated

router = APIRouter(prefix="/portfolios", tags=["Portfolios"])


@router.get("")
async def list_portfolios(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_q = select(func.count(Portfolio.id)).where(Portfolio.user_id == current_user.id)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Portfolio)
        .where(Portfolio.user_id == current_user.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Portfolio.created_at.desc())
    )
    result = await db.execute(q)
    items = [PortfolioOut.from_orm_model(p).model_dump() for p in result.scalars().all()]
    return paginated(items, total, page, page_size)


@router.get("/{portfolio_id}")
async def get_portfolio(
    portfolio_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == current_user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return ok(PortfolioOut.from_orm_model(p).model_dump())


@router.post("")
async def create_portfolio(
    data: PortfolioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = Portfolio(
        name=data.name,
        description=data.description,
        initial_capital=data.initial_capital,
        current_value=data.initial_capital,
        user_id=current_user.id,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return ok(PortfolioOut.from_orm_model(p).model_dump(), "Portfolio created")
