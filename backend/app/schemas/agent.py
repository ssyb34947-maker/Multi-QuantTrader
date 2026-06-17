import json
from datetime import datetime

from pydantic import BaseModel, field_validator


class AgentConfigOut(BaseModel):
    max_position_size: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    risk_per_trade: float = 0.0
    max_concurrent_trades: int = 1
    allowed_symbols: list[str] = []
    timeframes: list[str] = []
    extra_params: dict = {}


class AgentMetricsOut(BaseModel):
    total_trades: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    total_pnl: float = 0.0


class AgentCreate(BaseModel):
    name: str
    role: str = "analyst"
    model: str = ""
    strategy_id: int = 0
    config: AgentConfigOut = AgentConfigOut()


class AgentUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    model: str | None = None
    strategy_id: int | None = None
    config: AgentConfigOut | None = None
    status: str | None = None


class AgentOut(BaseModel):
    id: int
    name: str
    role: str
    model: str
    strategy_id: int
    config: AgentConfigOut = AgentConfigOut()
    status: str = "idle"
    metrics: AgentMetricsOut = AgentMetricsOut()
    created_at: datetime

    @field_validator("config", mode="before")
    @classmethod
    def parse_config(cls, v):
        if isinstance(v, str):
            return json.loads(v) if v else {}
        return v

    @classmethod
    def from_orm_model(cls, agent) -> "AgentOut":
        config_data = json.loads(agent.config_json) if isinstance(agent.config_json, str) and agent.config_json else {}
        return cls(
            id=agent.id,
            name=agent.name,
            role=agent.role,
            model=agent.model,
            strategy_id=agent.strategy_id,
            config=AgentConfigOut(**config_data),
            status=agent.status,
            metrics=AgentMetricsOut(
                total_trades=agent.total_trades or 0,
                win_rate=agent.win_rate or 0.0,
                profit_factor=agent.profit_factor or 0.0,
                sharpe_ratio=agent.sharpe_ratio or 0.0,
                max_drawdown=agent.max_drawdown or 0.0,
                total_pnl=agent.total_pnl or 0.0,
            ),
            created_at=agent.created_at,
        )

    model_config = {"from_attributes": True}
