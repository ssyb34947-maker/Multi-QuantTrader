"""Fund Orchestrator - Multi-agent orchestration for 多智星基金.

Orchestrates the full agent workflow:
1. Analyst Agent → generates signals
2. Bull Agent & Bear Agent → debate market direction
3. Portfolio consolidation → merge signals
4. Risk Manager → validates all signals
5. Executor → executes approved orders
6. Forward prediction → generate predicted data for N days
7. Forward test → run backtest on predicted data
"""

import json
import math
from datetime import datetime
from typing import Any, Optional

import numpy as np
import pandas as pd

from app.services.data_service import (
    list_symbols, get_stock_data, get_market_snapshot, predict_forward,
)
from app.services.agents.base import AgentSignal
from app.services.agents.analyst import AnalystAgent
from app.services.agents.trader import BullAgent, BearAgent
from app.services.agents.risk_manager import RiskManagerAgent
from app.services.agents.executor import ExecutorAgent, ExecutedOrder


class FundOrchestrator:
    """Orchestrates the multi-agent fund trading workflow."""

    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.analyst = AnalystAgent(name="Factor-Analyst", config=config)
        self.bull = BullAgent(name="Bull-Agent", config=config)
        self.bear = BearAgent(name="Bear-Agent", config=config)
        self.risk_manager = RiskManagerAgent(name="Risk-Manager", config=config)
        self.executor = ExecutorAgent(name="Exec-Guard", config=config)

        self.state: dict[str, Any] = {
            "status": "idle",
            "run_id": None,
            "current_phase": None,
            "phases": {},
            "orders": [],
            "errors": [],
        }

    async def run_full_cycle(
        self,
        symbols: Optional[list[str]] = None,
        portfolio: Optional[dict] = None,
        as_of_date: str = "2026-05-20",
        predict_days: int = 5,
    ) -> dict:
        """Run a complete fund trading cycle through all agents.

        Args:
            symbols: Stock symbols to analyze.
            portfolio: Current portfolio state.
            as_of_date: Analysis cut-off date (YYYY-MM-DD). Agents only see data up to this date.
            predict_days: Number of trading days to predict forward.
        """
        run_id = f"RUN-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.state = {
            "status": "running",
            "run_id": run_id,
            "as_of_date": as_of_date,
            "current_phase": None,
            "phases": {},
            "orders": [],
            "errors": [],
        }

        # Reset agent state for fresh cycle
        self.analyst.signals.clear()
        self.analyst.state.clear()
        self.bull.signals.clear()
        self.bull.state.clear()
        self.bear.signals.clear()
        self.bear.state.clear()
        self.risk_manager.signals.clear()
        self.risk_manager.state.clear()
        self.executor.orders.clear()
        self.executor.state.clear()

        if not symbols:
            catalog = list_symbols()
            symbols = [item["symbol"] for item in catalog[:10]]
        if not portfolio:
            portfolio = {"current_value": 1500000, "daily_pnl": 0, "total_pnl": 0}

        context = {
            "symbols": symbols,
            "portfolio": portfolio,
            "positions": portfolio.get("positions", []),
            "as_of_date": as_of_date,
        }

        try:
            # Phase 1: Analyst
            self.state["current_phase"] = "analyst"
            analyst_signals = await self.analyst.analyze(context)
            context["analyst_signals"] = [s.to_dict() for s in analyst_signals]
            self.state["phases"]["analyst"] = {
                "status": "completed",
                "signals": [s.to_dict() for s in analyst_signals],
            }

            # Phase 2: Bull & Bear debate
            self.state["current_phase"] = "debate"
            bull_signals = await self.bull.analyze(context)
            bear_signals = await self.bear.analyze(context)
            context["bull_signals"] = [s.to_dict() for s in bull_signals]
            context["bear_signals"] = [s.to_dict() for s in bear_signals]
            self.state["phases"]["debate"] = {
                "status": "completed",
                "bull_signals": [s.to_dict() for s in bull_signals],
                "bear_signals": [s.to_dict() for s in bear_signals],
            }

            # Phase 3: Consolidate signals → proposed trades
            self.state["current_phase"] = "consolidation"
            proposed_signals = self._consolidate_signals(
                analyst_signals, bull_signals, bear_signals, context
            )
            context["proposed_signals"] = proposed_signals
            self.state["phases"]["consolidation"] = {
                "status": "completed",
                "proposed": [s.to_dict() if isinstance(s, AgentSignal) else s for s in proposed_signals],
            }

            # Phase 4: Risk Manager
            self.state["current_phase"] = "risk_check"
            validated_signals = await self.risk_manager.analyze(context)
            context["approved_signals"] = [s.to_dict() for s in validated_signals if s.action != "hold"]
            self.state["phases"]["risk_check"] = {
                "status": "completed",
                "validated": len(validated_signals),
                "approved": len(context["approved_signals"]),
                "rejected": sum(1 for s in validated_signals if s.action == "hold"),
            }

            # Phase 5: Executor
            self.state["current_phase"] = "execution"
            executed = await self.executor.analyze(context)
            self.state["phases"]["execution"] = {
                "status": "completed",
                "orders": [o.to_dict() for o in self.executor.orders],
            }
            self.state["orders"] = [o.to_dict() for o in self.executor.orders]

            # Phase 6: Forward prediction & test
            self.state["current_phase"] = "forward_test"
            forward_result = self._run_forward_test(symbols, as_of_date, predict_days, self.executor.orders)
            self.state["phases"]["forward_test"] = forward_result["summary"]
            self.state["prediction"] = forward_result["prediction"]
            self.state["forward_test"] = forward_result["test"]

            self.state["status"] = "completed"
            self.state["current_phase"] = None

        except Exception as e:
            self.state["status"] = "error"
            self.state["errors"].append(str(e))

        return self.state

    def _run_forward_test(
        self, symbols: list[str], as_of_date: str, predict_days: int, orders: list[ExecutedOrder]
    ) -> dict:
        """Generate predictions and run a forward test on predicted data."""
        # Generate predictions for each symbol
        predictions = {}
        pred_data = {}
        for sym in symbols:
            try:
                df = predict_forward(sym, as_of_date, days=predict_days)
                predictions[sym] = {
                    "dates": [str(d.date()) for d in df.index],
                    "prices": [round(float(c), 2) for c in df["close"]],
                    "returns": [
                        round(float(r), 4) for r in df["close"].pct_change().fillna(0)
                    ],
                }
                pred_data[sym] = df
            except (ValueError, FileNotFoundError) as e:
                predictions[sym] = {"error": str(e)}

        # Run a simple forward test
        test_result = self._simulate_forward(pred_data, orders, as_of_date)

        return {
            "prediction": {
                "as_of_date": as_of_date,
                "predict_dates": predictions[symbols[0]]["dates"] if symbols and symbols[0] in predictions else [],
                "symbols": predictions,
            },
            "test": test_result,
            "summary": {
                "status": "completed",
                "predict_days": predict_days,
                "symbols_analyzed": len(symbols),
                "orders_tested": len(orders),
            },
        }

    def _simulate_forward(self, pred_data: dict, orders: list[ExecutedOrder], as_of_date: str) -> dict:
        """Simulate how the executed orders would have performed on predicted data."""
        if not orders or not pred_data:
            return {
                "total_return": 0.0,
                "total_pnl": 0.0,
                "win_rate": 0.0,
                "max_drawdown": 0.0,
                "equity_curve": [],
                "trades": [],
            }

        portfolio_value = 1_500_000.0
        cash = portfolio_value
        positions: dict[str, float] = {}  # symbol -> quantity
        equity_curve = []
        trades = []

        # Get all dates from predictions
        all_dates = set()
        for sym, df in pred_data.items():
            for d in df.index:
                all_dates.add(d)
        all_dates = sorted(all_dates)

        # Build a map: date -> {symbol -> price}
        price_map: dict[str, dict[str, float]] = {}
        for d in all_dates:
            price_map[str(d.date())] = {}
            for sym, df in pred_data.items():
                if d in df.index:
                    price_map[str(d.date())][sym] = float(df.loc[d, "close"])

        entry_prices: dict[str, float] = {}

        for order in orders:
            sym = order.symbol
            if sym not in pred_data:
                continue
            df = pred_data[sym]
            if df.empty:
                continue

            first_price = float(df.iloc[0]["close"])
            last_price = float(df.iloc[-1]["close"])
            qty = order.quantity

            if order.side == "buy":
                positions[sym] = positions.get(sym, 0) + qty
                cost = qty * first_price
                cash -= cost
                entry_prices[sym] = first_price
            else:  # sell
                positions[sym] = positions.get(sym, 0) - qty
                revenue = qty * first_price
                cash += revenue
                entry_prices[sym] = first_price

        # Compute equity curve over predicted dates
        peak = portfolio_value
        max_dd = 0.0
        for date_str in sorted(price_map.keys()):
            total_value = cash
            for sym, qty in positions.items():
                price = price_map[date_str].get(sym, 0)
                total_value += qty * price

            if total_value > peak:
                peak = total_value
            dd = ((peak - total_value) / peak) * 100 if peak > 0 else 0
            max_dd = max(max_dd, dd)

            equity_curve.append({
                "date": date_str,
                "equity": round(total_value, 2),
                "drawdown": round(dd, 4),
            })

        # Compute final P&L per position
        for order in orders:
            sym = order.symbol
            if sym not in pred_data:
                continue
            df = pred_data[sym]
            if df.empty:
                continue
            entry_price_val = entry_prices.get(sym, 0)
            exit_price_val = float(df.iloc[-1]["close"])
            qty = order.quantity
            pnl = qty * (exit_price_val - entry_price_val) * (1 if order.side == "buy" else -1)
            pnl_pct = ((exit_price_val - entry_price_val) / entry_price_val * 100) if entry_price_val > 0 else 0

            trades.append({
                "symbol": sym,
                "side": order.side,
                "entry_price": round(entry_price_val, 2),
                "exit_price": round(exit_price_val, 2),
                "quantity": qty,
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl_pct, 4),
            })

        final_value = equity_curve[-1]["equity"] if equity_curve else portfolio_value
        total_return = ((final_value - portfolio_value) / portfolio_value) * 100
        winning_trades = sum(1 for t in trades if t["pnl"] > 0)
        win_rate = (winning_trades / len(trades) * 100) if trades else 0

        return {
            "total_return": round(total_return, 4),
            "total_pnl": round(final_value - portfolio_value, 2),
            "win_rate": round(win_rate, 2),
            "max_drawdown": round(max_dd, 4),
            "equity_curve": equity_curve,
            "trades": trades,
        }

    def _consolidate_signals(
        self, analyst_signals: list, bull_signals: list, bear_signals: list, context: dict
    ) -> list[AgentSignal]:
        """Consolidate signals from all analysis agents into proposed trades."""
        signal_map: dict[str, dict] = {}

        def to_dict(s):
            return s.to_dict() if isinstance(s, AgentSignal) else s

        for sig in analyst_signals:
            d = to_dict(sig)
            sym = d["symbol"]
            if sym not in signal_map:
                signal_map[sym] = {"buy_score": 0, "sell_score": 0, "reasons": [], "sources": []}
            if d["action"] == "buy":
                signal_map[sym]["buy_score"] += d["confidence"] * 2
            elif d["action"] == "sell":
                signal_map[sym]["sell_score"] += d["confidence"] * 2
            signal_map[sym]["reasons"].append(f"[Analyst] {d['reason']}")
            signal_map[sym]["sources"].append("analyst")

        for sig in bull_signals:
            d = to_dict(sig)
            sym = d["symbol"]
            if sym not in signal_map:
                signal_map[sym] = {"buy_score": 0, "sell_score": 0, "reasons": [], "sources": []}
            signal_map[sym]["buy_score"] += d["confidence"] * 1.5
            signal_map[sym]["reasons"].append(f"[Bull] {d['reason']}")
            signal_map[sym]["sources"].append("bull")

        for sig in bear_signals:
            d = to_dict(sig)
            sym = d["symbol"]
            if sym not in signal_map:
                signal_map[sym] = {"buy_score": 0, "sell_score": 0, "reasons": [], "sources": []}
            signal_map[sym]["sell_score"] += d["confidence"] * 1.5
            signal_map[sym]["reasons"].append(f"[Bear] {d['reason']}")
            signal_map[sym]["sources"].append("bear")

        portfolio_value = context.get("portfolio", {}).get("current_value", 1500000)
        results = []
        for sym, info in signal_map.items():
            net = info["buy_score"] - info["sell_score"]
            confidence = min(abs(net) / (abs(net) + 0.5), 0.95)

            if net >= 0.5:
                action = "buy"
                qty = int(portfolio_value * 0.08 / 10)
            elif net <= -0.5:
                action = "sell"
                qty = int(portfolio_value * 0.05 / 10)
            else:
                continue

            results.append(AgentSignal(
                agent_name="Portfolio-Manager",
                agent_role="executor",
                symbol=sym,
                action=action,
                confidence=round(confidence, 2),
                reason=" | ".join(info["reasons"][:3]),
                quantity=qty,
            ))

        return results

    def get_run_result(self, run_id: str) -> Optional[dict]:
        if self.state.get("run_id") == run_id:
            return self.state
        return None

    def get_status(self) -> dict:
        return {
            "run_id": self.state.get("run_id"),
            "status": self.state.get("status"),
            "current_phase": self.state.get("current_phase"),
            "phases_completed": list(self.state.get("phases", {}).keys()),
            "total_orders": len(self.state.get("orders", [])),
            "errors": self.state.get("errors", []),
        }
