import json

from pydantic import BaseModel


class PositionOut(BaseModel):
    symbol: str
    quantity: float = 0.0
    avg_entry_price: float = 0.0
    current_price: float = 0.0
    market_value: float = 0.0
    unrealized_pnl: float = 0.0
    unrealized_pnl_pct: float = 0.0
    weight_pct: float = 0.0


class PortfolioPerformanceOut(BaseModel):
    total_return: float = 0.0
    annualized_return: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    volatility: float = 0.0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    total_trades: int = 0


class PortfolioCreate(BaseModel):
    name: str
    description: str = ""
    initial_capital: float = 100000.0


class PortfolioOut(BaseModel):
    id: int
    name: str
    description: str
    initial_capital: float
    current_value: float
    total_pnl: float
    total_return_pct: float
    positions: list[PositionOut] = []
    performance: PortfolioPerformanceOut = PortfolioPerformanceOut()

    @classmethod
    def from_orm_model(cls, portfolio) -> "PortfolioOut":
        positions_data = json.loads(portfolio.positions_json) if isinstance(portfolio.positions_json, str) and portfolio.positions_json else []
        return cls(
            id=portfolio.id,
            name=portfolio.name,
            description=portfolio.description,
            initial_capital=portfolio.initial_capital,
            current_value=portfolio.current_value,
            total_pnl=portfolio.total_pnl,
            total_return_pct=portfolio.total_return_pct,
            positions=[PositionOut(**p) for p in positions_data],
            performance=PortfolioPerformanceOut(
                total_return=portfolio.total_return,
                annualized_return=portfolio.annualized_return,
                sharpe_ratio=portfolio.sharpe_ratio,
                max_drawdown=portfolio.max_drawdown,
                volatility=portfolio.volatility,
                win_rate=portfolio.win_rate,
                profit_factor=portfolio.profit_factor,
                total_trades=portfolio.total_trades,
            ),
        )

    model_config = {"from_attributes": True}
