import json
from datetime import datetime

from pydantic import BaseModel, field_validator


class BacktestCreate(BaseModel):
    name: str
    strategy_id: int
    agents: list[int] = []
    symbols: list[str]
    start_date: str
    end_date: str
    initial_capital: float = 100000.0
    slippage: float = 0.0004
    commission: float = 0.0006


class TradeOut(BaseModel):
    id: str
    symbol: str
    side: str  # buy | sell
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    pnl_pct: float
    agent_id: int = 0
    agent_name: str = ""


class EquityPointOut(BaseModel):
    date: str
    equity: float
    drawdown: float = 0.0


class MonthlyReturnOut(BaseModel):
    month: str
    return_pct: float


class BacktestResultOut(BaseModel):
    total_return: float = 0.0
    annualized_return: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    total_trades: int = 0
    total_commission: float = 0.0
    equity_curve: list[EquityPointOut] = []
    trades: list[TradeOut] = []
    monthly_returns: list[MonthlyReturnOut] = []


class BacktestOut(BaseModel):
    id: int
    name: str
    strategy_id: int
    agents: list[int] = []
    symbols: list[str] = []
    start_date: str
    end_date: str
    initial_capital: float
    status: str
    slippage: float = 0.0004
    commission: float = 0.0006
    result: BacktestResultOut | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_model(cls, bt) -> "BacktestOut":
        agents = json.loads(bt.agents) if isinstance(bt.agents, str) and bt.agents else (bt.agents or [])
        symbols = json.loads(bt.symbols) if isinstance(bt.symbols, str) and bt.symbols else (bt.symbols or [])
        result = None
        if bt.result_json:
            try:
                result_data = json.loads(bt.result_json) if isinstance(bt.result_json, str) else bt.result_json
                result = BacktestResultOut(**result_data)
            except (json.JSONDecodeError, TypeError):
                result = None
        return cls(
            id=bt.id, name=bt.name, strategy_id=bt.strategy_id,
            agents=agents, symbols=symbols,
            start_date=bt.start_date, end_date=bt.end_date,
            initial_capital=bt.initial_capital, status=bt.status,
            slippage=bt.slippage, commission=bt.commission,
            result=result, error_message=bt.error_message,
            created_at=bt.created_at, updated_at=bt.updated_at,
        )

    model_config = {"from_attributes": True}
