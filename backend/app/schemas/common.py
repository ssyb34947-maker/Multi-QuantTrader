from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class ApiResponse(BaseModel, Generic[T]):
    code: int = 200
    message: str = "success"
    data: T


class EquityPoint(BaseModel):
    date: str
    value: float


class DashboardSummary(BaseModel):
    total_strategies: int = 0
    active_strategies: int = 0
    total_backtests: int = 0
    running_backtests: int = 0
    total_agents: int = 0
    active_agents: int = 0
    portfolio_value: float = 0.0
    total_pnl: float = 0.0
    daily_pnl: float = 0.0
    equity_curve: list[EquityPoint] = []
    recent_trades: int = 0
    win_rate: float = 0.0
