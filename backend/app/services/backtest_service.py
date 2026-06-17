import json

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.backtrader_engine import BacktestEngine
from app.models.backtest import Backtest
from app.schemas.backtest import BacktestResultOut


async def run_backtest(db: AsyncSession, backtest_id: int) -> BacktestResultOut:
    result = await db.execute(select(Backtest).where(Backtest.id == backtest_id))
    backtest = result.scalar_one_or_none()
    if not backtest:
        raise ValueError("Backtest not found")

    backtest.status = "running"
    await db.commit()

    try:
        symbols = json.loads(backtest.symbols) if isinstance(backtest.symbols, str) else backtest.symbols
        engine = BacktestEngine(
            symbols=symbols,
            start_date=backtest.start_date,
            end_date=backtest.end_date,
            initial_capital=backtest.initial_capital,
            slippage=backtest.slippage,
            commission=backtest.commission,
            strategy_code=backtest.strategy_code,
        )
        raw_result = engine.run()

        backtest.result_json = json.dumps(raw_result, default=str)
        backtest.status = "completed"
        await db.commit()

        return BacktestResultOut(**raw_result)

    except Exception as e:
        backtest.status = "failed"
        backtest.error_message = str(e)
        await db.commit()
        raise


async def get_backtest_stats(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(
        select(
            func.count(Backtest.id).label("total"),
        ).where(Backtest.user_id == user_id, Backtest.status == "completed")
    )
    row = result.one()
    return {
        "total_backtests": row.total or 0,
        "total_trades": 0,
    }
