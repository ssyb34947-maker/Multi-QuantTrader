import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.backtest import Backtest
from app.models.strategy import Strategy
from app.schemas.backtest import BacktestCreate, BacktestOut, BacktestResultOut
from app.services.backtest_service import run_backtest
from app.api.deps import ok, paginated

router = APIRouter(prefix="/backtests", tags=["Backtests"])


@router.get("")
async def list_backtests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_q = select(func.count(Backtest.id)).where(Backtest.user_id == current_user.id)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Backtest)
        .where(Backtest.user_id == current_user.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Backtest.created_at.desc())
    )
    result = await db.execute(q)
    items = [BacktestOut.from_orm_model(b).model_dump() for b in result.scalars().all()]
    return paginated(items, total, page, page_size)


@router.get("/{backtest_id}")
async def get_backtest(
    backtest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Backtest).where(Backtest.id == backtest_id, Backtest.user_id == current_user.id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found")
    return ok(BacktestOut.from_orm_model(b).model_dump())


@router.post("")
async def create_backtest(
    data: BacktestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy_code = ""
    strat_result = await db.execute(
        select(Strategy).where(Strategy.id == data.strategy_id)
    )
    strategy = strat_result.scalar_one_or_none()
    if strategy:
        strategy_code = strategy.code

    b = Backtest(
        name=data.name,
        strategy_id=data.strategy_id,
        strategy_code=strategy_code,
        agents=json.dumps(data.agents, ensure_ascii=False),
        symbols=json.dumps(data.symbols, ensure_ascii=False),
        start_date=data.start_date,
        end_date=data.end_date,
        initial_capital=data.initial_capital,
        slippage=data.slippage,
        commission=data.commission,
        user_id=current_user.id,
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return ok(BacktestOut.from_orm_model(b).model_dump(), "Backtest created")


@router.post("/{backtest_id}/run")
async def execute_backtest(
    backtest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Backtest).where(Backtest.id == backtest_id, Backtest.user_id == current_user.id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found")

    try:
        result_data = await run_backtest(db, backtest_id)
        # Re-fetch to get updated result_json
        await db.refresh(b)
        return ok(BacktestOut.from_orm_model(b).model_dump(), "Backtest completed")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{backtest_id}/cancel")
async def cancel_backtest(
    backtest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Backtest).where(Backtest.id == backtest_id, Backtest.user_id == current_user.id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found")
    if b.status == "running":
        b.status = "cancelled"
        await db.commit()
    return ok(None, "Backtest cancelled")


@router.delete("/{backtest_id}")
async def delete_backtest(
    backtest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Backtest).where(Backtest.id == backtest_id, Backtest.user_id == current_user.id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found")
    await db.delete(b)
    await db.commit()
    return ok(None, "Backtest deleted")
