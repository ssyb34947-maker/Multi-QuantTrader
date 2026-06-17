"""Analyst Agent - Analyzes market data and generates trading signals."""

from typing import Any, Optional

import numpy as np

from app.services.agents.base import BaseTradingAgent, AgentSignal
from app.services.data_service import get_market_snapshot, get_stock_data, compute_technical_indicators


class AnalystAgent(BaseTradingAgent):
    """Market analyst that evaluates technical indicators and generates signal recommendations."""

    def __init__(self, name: str = "Factor-Analyst", config: Optional[dict] = None):
        super().__init__(name=name, role="analyst", config=config)

    async def analyze(self, context: dict) -> list[AgentSignal]:
        """Analyze market data and generate trading signals."""
        symbols = context.get("symbols", [])
        signals = []

        for symbol in symbols:
            try:
                snapshot = get_market_snapshot(symbol, as_of_date=context.get("as_of_date"))
                signal = self._evaluate_technicals(symbol, snapshot)
                if signal:
                    signals.append(signal)
            except Exception as e:
                print(f"[AnalystAgent] Error analyzing {symbol}: {e}")

        self.signals = signals
        self.state["total_signals"] = len(signals)
        return signals

    def _evaluate_technicals(self, symbol: str, snapshot: dict) -> Optional[AgentSignal]:
        """Score technical indicators and produce a signal."""
        scores = {"buy": 0, "sell": 0}
        reasons = []

        rsi = snapshot.get("rsi_14")
        sma_5 = snapshot.get("sma_5")
        sma_10 = snapshot.get("sma_10")
        sma_20 = snapshot.get("sma_20")
        price = snapshot.get("price")
        macd = snapshot.get("macd")
        vol_ratio = snapshot.get("volume_ratio")
        return_5d = snapshot.get("return_5d")
        bb_upper = snapshot.get("bb_upper")
        bb_lower = snapshot.get("bb_lower")

        # RSI
        if rsi is not None:
            if rsi < 30:
                scores["buy"] += 3
                reasons.append(f"RSI={rsi:.1f} oversold")
            elif rsi > 70:
                scores["sell"] += 3
                reasons.append(f"RSI={rsi:.1f} overbought")
            elif 40 <= rsi <= 60:
                scores["buy"] += 1
                reasons.append(f"RSI={rsi:.1f} neutral-bullish")
            else:
                scores["sell"] += 1

        # SMA trend
        if price and sma_5 and sma_10 and sma_20:
            if price > sma_5 > sma_10 > sma_20:
                scores["buy"] += 3
                reasons.append("Uptrend (price>SMA5>SMA10>SMA20)")
            elif price < sma_5 < sma_10 < sma_20:
                scores["sell"] += 3
                reasons.append("Downtrend (price<SMA5<SMA10<SMA20)")
            elif price > sma_20:
                scores["buy"] += 1
                reasons.append("Above 20-day SMA")

        # MACD
        if macd is not None:
            if macd > 0:
                scores["buy"] += 1
                reasons.append(f"MACD={macd:.4f}>0")
            else:
                scores["sell"] += 1
                reasons.append(f"MACD={macd:.4f}<0")

        # Bollinger Bands
        if price and bb_upper and bb_lower:
            bb_range = bb_upper - bb_lower
            if bb_range > 0:
                position = (price - bb_lower) / bb_range
                if position < 0.2:
                    scores["buy"] += 2
                    reasons.append("Near lower Bollinger Band")
                elif position > 0.8:
                    scores["sell"] += 2
                    reasons.append("Near upper Bollinger Band")

        # Volume
        if vol_ratio is not None and vol_ratio > 1.5:
            scores["buy"] += 1
            reasons.append(f"Volume surge ({vol_ratio:.1f}x)")

        # Momentum
        if return_5d is not None:
            if return_5d > 5:
                scores["sell"] += 1
                reasons.append(f"5d return={return_5d:.1f}% (overextended)")
            elif return_5d < -5:
                scores["buy"] += 1
                reasons.append(f"5d return={return_5d:.1f}% (bounce potential)")

        # Decision
        net = scores["buy"] - scores["sell"]
        confidence = min(abs(net) / 10, 0.95)
        if net >= 2:
            action = "buy"
        elif net <= -2:
            action = "sell"
        else:
            action = "hold"

        if action == "hold" and confidence < 0.3:
            return None

        return AgentSignal(
            agent_name=self.name,
            agent_role="analyst",
            symbol=symbol,
            action=action,
            confidence=round(confidence, 2),
            reason="; ".join(reasons[:3]),
            price_target=round(price * 1.05, 2) if action == "buy" and price else None,
            stop_loss=round(price * 0.95, 2) if action == "buy" and price else None,
            metadata={
                "scores": scores,
                "net_score": net,
                "snapshot": snapshot,
            },
        )
