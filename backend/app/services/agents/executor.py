"""Executor Agent - Executes approved trading signals as orders."""

from typing import Any, Optional
from datetime import datetime

from app.services.agents.base import BaseTradingAgent, AgentSignal


class ExecutedOrder:
    """A completed order with execution details."""

    def __init__(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        order_type: str = "market",
        agent_name: str = "",
        signal_reason: str = "",
        order_id: Optional[str] = None,
        status: str = "filled",
    ):
        self.order_id = order_id or f"ORD-{datetime.now().strftime('%H%M%S')}-{symbol}"
        self.symbol = symbol
        self.side = side
        self.quantity = quantity
        self.price = price
        self.value = quantity * price
        self.order_type = order_type
        self.agent_name = agent_name
        self.signal_reason = signal_reason
        self.status = status
        self.executed_at = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "order_id": self.order_id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "price": self.price,
            "value": self.value,
            "order_type": self.order_type,
            "agent_name": self.agent_name,
            "signal_reason": self.signal_reason,
            "status": self.status,
            "executed_at": self.executed_at,
        }


class ExecutorAgent(BaseTradingAgent):
    """Executes validated trading signals as orders."""

    def __init__(self, name: str = "Exec-Guard", config: Optional[dict] = None):
        super().__init__(name=name, role="executor", config=config)
        self.orders: list[ExecutedOrder] = []

    async def analyze(self, context: dict) -> list[AgentSignal]:
        """Execute approved signals as orders."""
        approved_signals = context.get("approved_signals", [])
        portfolio = context.get("portfolio", {})
        max_capital_per_trade = portfolio.get("current_value", 100000) * 0.15

        executed_orders = []
        for signal in approved_signals:
            if isinstance(signal, dict):
                signal = AgentSignal(**{k: v for k, v in signal.items() if k in [
                    "agent_name", "agent_role", "symbol", "action",
                    "confidence", "reason", "price_target", "stop_loss",
                    "quantity", "metadata",
                ]})

            if signal.action == "hold":
                continue

            order = self._execute(signal, max_capital_per_trade)
            executed_orders.append(order)

        self.orders.extend(executed_orders)
        self.state["total_trades"] = len(self.orders)
        return [s for s in approved_signals if isinstance(s, (AgentSignal, dict)) and (isinstance(s, dict) or s.action != "hold")]

    def _execute(self, signal: AgentSignal, max_capital: float) -> ExecutedOrder:
        price = signal.price_target or 10.0
        quantity = signal.quantity or int(max_capital / price)

        side = "buy" if signal.action == "buy" else "sell"
        if side == "sell":
            quantity = -quantity

        return ExecutedOrder(
            symbol=signal.symbol,
            side=side,
            quantity=abs(quantity),
            price=price,
            agent_name=signal.agent_name,
            signal_reason=signal.reason,
        )

    def get_recent_orders(self, limit: int = 10) -> list[dict]:
        return [o.to_dict() for o in self.orders[-limit:]]
