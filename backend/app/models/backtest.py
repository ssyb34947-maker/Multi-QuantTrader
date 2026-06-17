from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Backtest(Base):
    __tablename__ = "backtests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    strategy_id: Mapped[int] = mapped_column(Integer, nullable=False)
    strategy_code: Mapped[str] = mapped_column(Text, default="")
    agents: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of agent ids
    symbols: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    start_date: Mapped[str] = mapped_column(String(20), nullable=False)
    end_date: Mapped[str] = mapped_column(String(20), nullable=False)
    initial_capital: Mapped[float] = mapped_column(Float, default=100000.0)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending | running | completed | failed | cancelled
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    slippage: Mapped[float] = mapped_column(Float, default=0.0004)
    commission: Mapped[float] = mapped_column(Float, default=0.0006)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
