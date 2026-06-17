"""Bull and Bear trading agents that debate market direction."""

from typing import Any, Optional

import numpy as np

from app.services.agents.base import BaseTradingAgent, AgentSignal
from app.services.data_service import get_market_snapshot


class BullAgent(BaseTradingAgent):
    """Bullish trader - identifies long opportunities and trend follow signals."""

    def __init__(self, name: str = "Bull-Agent", config: Optional[dict] = None):
        super().__init__(name=name, role="trader", config=config)

    async def analyze(self, context: dict) -> list[AgentSignal]:
        symbols = context.get("symbols", [])
        analyst_signals = context.get("analyst_signals", [])
        signals = []

        # Build a map of analyst signals
        analyst_map = {}
        for sig in analyst_signals:
            if isinstance(sig, AgentSignal):
                analyst_map[sig.symbol] = sig
            elif isinstance(sig, dict):
                analyst_map[sig.get("symbol")] = sig

        for symbol in symbols:
            try:
                snapshot = get_market_snapshot(symbol, as_of_date=context.get("as_of_date"))
                signal = self._bullish_evaluation(symbol, snapshot, analyst_map.get(symbol))
                if signal:
                    signals.append(signal)
            except Exception as e:
                print(f"[BullAgent] Error: {e}")

        self.signals = signals
        self.state["total_signals"] = len(signals)
        return signals

    def _bullish_evaluation(self, symbol: str, snapshot: dict, analyst_signal: Any) -> Optional[AgentSignal]:
        score = 0
        reasons = []
        price = snapshot.get("price", 0)

        # Technical bullish factors
        rsi = snapshot.get("rsi_14")
        if rsi is not None and 30 < rsi < 50:
            score += 2
            reasons.append(f"RSI rising from {rsi:.1f}")

        return_5d = snapshot.get("return_5d")
        return_20d = snapshot.get("return_20d")
        if return_5d is not None and return_5d > 0:
            score += 1
            reasons.append(f"Positive 5d momentum ({return_5d:+.1f}%)")
        if return_20d is not None and return_20d > 3:
            score += 2
            reasons.append(f"Strong 20d trend ({return_20d:+.1f}%)")

        volume_ratio = snapshot.get("volume_ratio")
        if volume_ratio is not None and volume_ratio > 1.2:
            score += 1
            reasons.append(f"Above-average volume ({volume_ratio:.1f}x)")

        # Incorporate analyst signal
        if analyst_signal:
            if isinstance(analyst_signal, AgentSignal):
                if analyst_signal.action == "buy":
                    score += 2
            elif isinstance(analyst_signal, dict):
                if analyst_signal.get("action") == "buy":
                    score += 2

        confidence = min(score / 12, 0.95)
        if score >= 3:
            return AgentSignal(
                agent_name=self.name,
                agent_role="trader",
                symbol=symbol,
                action="buy",
                confidence=round(confidence, 2),
                reason="; ".join(reasons[:3]),
                price_target=round(price * 1.08, 2),
                stop_loss=round(price * 0.92, 2),
            )
        return None


class BearAgent(BaseTradingAgent):
    """Bearish trader - identifies short opportunities and risk signals."""

    def __init__(self, name: str = "Bear-Agent", config: Optional[dict] = None):
        super().__init__(name=name, role="trader", config=config)

    async def analyze(self, context: dict) -> list[AgentSignal]:
        symbols = context.get("symbols", [])
        analyst_signals = context.get("analyst_signals", [])
        signals = []

        analyst_map = {}
        for sig in analyst_signals:
            if isinstance(sig, AgentSignal):
                analyst_map[sig.symbol] = sig
            elif isinstance(sig, dict):
                analyst_map[sig.get("symbol")] = sig

        for symbol in symbols:
            try:
                snapshot = get_market_snapshot(symbol, as_of_date=context.get("as_of_date"))
                signal = self._bearish_evaluation(symbol, snapshot, analyst_map.get(symbol))
                if signal:
                    signals.append(signal)
            except Exception as e:
                print(f"[BearAgent] Error: {e}")

        self.signals = signals
        self.state["total_signals"] = len(signals)
        return signals

    def _bearish_evaluation(self, symbol: str, snapshot: dict, analyst_signal: Any) -> Optional[AgentSignal]:
        score = 0
        reasons = []
        price = snapshot.get("price", 0)

        rsi = snapshot.get("rsi_14")
        if rsi is not None and rsi > 60:
            score += 2
            reasons.append(f"RSI overbought at {rsi:.1f}")

        return_5d = snapshot.get("return_5d")
        if return_5d is not None and return_5d < -2:
            score += 2
            reasons.append(f"Momentum breakdown ({return_5d:+.1f}% 5d)")
        if return_5d is not None and return_5d > 8:
            score += 2
            reasons.append(f"Overextended rally ({return_5d:+.1f}% 5d)")

        volatility = snapshot.get("volatility_20d")
        if volatility is not None and volatility > 5:
            score += 2
            reasons.append(f"High volatility ({volatility:.1f}%)")

        volume_ratio = snapshot.get("volume_ratio")
        if volume_ratio is not None and volume_ratio > 1.5 and return_5d is not None and return_5d < 0:
            score += 2
            reasons.append("High volume sell-off")

        if analyst_signal:
            if isinstance(analyst_signal, AgentSignal):
                if analyst_signal.action == "sell":
                    score += 2
            elif isinstance(analyst_signal, dict):
                if analyst_signal.get("action") == "sell":
                    score += 2

        confidence = min(score / 12, 0.95)
        if score >= 3:
            return AgentSignal(
                agent_name=self.name,
                agent_role="trader",
                symbol=symbol,
                action="sell",
                confidence=round(confidence, 2),
                reason="; ".join(reasons[:3]),
                price_target=round(price * 0.92, 2),
                stop_loss=round(price * 1.08, 2),
            )
        return None
