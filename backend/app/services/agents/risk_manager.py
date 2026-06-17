"""Risk Manager Agent - Validates trading decisions against risk constraints."""

from typing import Any, Optional

from app.services.agents.base import BaseTradingAgent, AgentSignal


class RiskManagerAgent(BaseTradingAgent):
    """Validates all trading signals against portfolio risk constraints."""

    def __init__(
        self,
        name: str = "Risk-Manager",
        config: Optional[dict] = None,
        max_drawdown_limit: float = 10.0,
        max_position_size: float = 0.25,
        max_correlation: float = 0.7,
        max_daily_loss: float = 3.0,
    ):
        super().__init__(name=name, role="risk_manager", config=config)
        self.max_drawdown_limit = max_drawdown_limit
        self.max_position_size = max_position_size
        self.max_correlation = max_correlation
        self.max_daily_loss = max_daily_loss

    async def analyze(self, context: dict) -> list[AgentSignal]:
        """Validate signals from previous agents. Returns approved/rejected signals."""
        proposed_signals = context.get("proposed_signals", [])
        portfolio = context.get("portfolio", {})
        current_positions = context.get("positions", [])

        validated = []
        for signal in proposed_signals:
            if isinstance(signal, dict):
                signal = AgentSignal(**{k: v for k, v in signal.items() if k in [
                    "agent_name", "agent_role", "symbol", "action",
                    "confidence", "reason", "price_target", "stop_loss",
                    "quantity", "metadata",
                ]})

            result = self._validate_signal(signal, portfolio, current_positions)
            validated.append(result)

        self.signals = validated
        self.state["total_signals"] = len(validated)
        return validated

    def _validate_signal(self, signal: AgentSignal, portfolio: dict, positions: list) -> AgentSignal:
        """Run signal through all risk checks."""
        checks = []

        # 1. Position size limit
        max_pos = self.config.get("max_position_size", self.max_position_size)
        suggested_qty = signal.quantity or 1000
        portfolio_value = portfolio.get("current_value", 100000)
        position_value = suggested_qty * (signal.metadata.get("snapshot", {}).get("price", 1) if isinstance(signal.metadata, dict) else 1)
        position_weight = position_value / portfolio_value if portfolio_value > 0 else 1

        if position_weight > max_pos:
            checks.append(f"FAIL: position weight {position_weight:.1%} > {max_pos:.1%} limit")
        else:
            checks.append(f"PASS: position weight {position_weight:.1%} ≤ {max_pos:.1%}")

        # 2. Confidence check
        if signal.confidence < 0.3:
            checks.append(f"FAIL: confidence {signal.confidence:.2f} < 0.3")
        else:
            checks.append(f"PASS: confidence {signal.confidence:.2f}")

        # 3. Daily loss limit
        daily_pnl = portfolio.get("daily_pnl", 0)
        if daily_pnl < 0 and abs(daily_pnl) / max(portfolio_value, 1) * 100 > self.max_daily_loss:
            checks.append(f"FAIL: daily loss {daily_pnl:.0f} exceeds {self.max_daily_loss}% limit")
        else:
            checks.append(f"PASS: daily loss within limit")

        # 4. Symbol exposure check
        for pos in positions:
            if isinstance(pos, dict) and pos.get("symbol") == signal.symbol:
                pos_weight = pos.get("weight_pct", 0) / 100
                if signal.action == "buy" and pos_weight > max_pos * 0.5:
                    checks.append(f"WARN: {signal.symbol} already {pos_weight:.1%} of portfolio")
                break

        # Decision: all checks must PASS
        all_pass = all(c.startswith("PASS") for c in checks)
        checks_str = "; ".join(checks)

        if all_pass:
            signal.reason = f"[Risk Approved] {signal.reason} | {checks_str}"
            signal.metadata["risk_checks"] = checks
            return signal
        else:
            return AgentSignal(
                agent_name=self.name,
                agent_role="risk_manager",
                symbol=signal.symbol,
                action="hold",
                confidence=0.0,
                reason=f"[Risk Rejected] {checks_str}",
                metadata={"original_signal": signal.to_dict(), "risk_checks": checks},
            )
