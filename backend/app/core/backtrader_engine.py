import importlib.util
import math
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

import backtrader as bt
import pandas as pd

from app.config import settings


# ----------- Analyzers -----------

class TradeRecorder(bt.Analyzer):
    """Records every completed trade with entry/exit details."""

    def __init__(self):
        self.trades: list[dict] = []

    def notify_trade(self, trade):
        if trade.isclosed:
            self.trades.append({
                "id": str(uuid.uuid4())[:8],
                "symbol": trade.data._name or "unknown",
                "side": "buy" if trade.long else "sell",
                "entry_time": str(trade.dtopen),
                "exit_time": str(trade.dtclose),
                "entry_price": round(float(trade.price), 4) if trade.price else 0.0,
                "exit_price": round(float(trade.price), 4) if trade.price else 0.0,
                "quantity": float(trade.size),
                "pnl": round(float(trade.pnlcomm), 2),
                "pnl_pct": round(float(trade.pnlcomm / (trade.price * trade.size) * 100), 4)
                if trade.price and trade.size else 0.0,
                "agent_id": 0,
                "agent_name": "",
            })

    def get_analysis(self):
        return {"trades": self.trades}


class EquityCurveRecorder(bt.Analyzer):
    """Records portfolio value over time for equity curves."""

    def __init__(self):
        self.equity_curve: list[dict] = []

    def notify_cashvalue(self, cash, value):
        self.equity_curve.append({
            "date": str(self.datas[0].datetime.date(0)),
            "equity": round(float(value), 2),
        })

    def get_analysis(self):
        return {"equity_curve": self.equity_curve}


# ----------- Dynamic Strategy -----------

class DynamicStrategy(bt.Strategy):
    """Strategy built dynamically from user-defined Python code."""

    params = (
        ("code", ""),
        ("slippage", 0.0004),
    )

    def __init__(self):
        self._user_strategy = None
        if self.params.code:
            self._user_strategy = self._compile_code(self.params.code)
        else:
            # Default SMA indicators — init here so backtrader preloads them
            self.sma_fast = bt.indicators.SMA(self.datas[0].close, period=10)
            self.sma_slow = bt.indicators.SMA(self.datas[0].close, period=30)

    def _compile_code(self, code: str):
        """Compile and execute user-provided strategy code, returning a callable hook."""
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
                f.write(code)
                f.flush()
                spec = importlib.util.spec_from_file_location("user_strategy", f.name)
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
            os.unlink(f.name)
            return mod
        except Exception:
            return None

    def log(self, txt):
        dt = self.datas[0].datetime.date(0)
        print(f"[{dt}] {txt}")

    def next(self):
        if self._user_strategy and hasattr(self._user_strategy, "next"):
            self._user_strategy.next(self, self.datas[0])
        else:
            # Default: SMA crossover
            if self.sma_fast[0] > self.sma_slow[0] and not self.position:
                self.buy()
            elif self.sma_fast[0] < self.sma_slow[0] and self.position:
                self.sell()


# ----------- Data Feeds -----------

DATA_ROOT = Path(__file__).parent.parent.parent / "data"
PROJECT_DATA_ROOT = Path(__file__).resolve().parents[3] / "data"


class DataSource:
    """Fetch market data from local files or remote sources."""

    @staticmethod
    def get_data(symbol: str, start_date: str, end_date: str, source: str = "local"):
        if source == "local":
            return DataSource._local(symbol, start_date, end_date)
        elif source == "yahoo":
            return DataSource._yahoo(symbol, start_date, end_date)
        else:
            return DataSource._local(symbol, start_date, end_date)

    @staticmethod
    def _local(symbol: str, start: str, end: str) -> pd.DataFrame:
        """Read local OHLCV data, preferring real CSI 2000 processed data when present."""
        path = DATA_ROOT / "stock_daily" / f"{symbol}.csv"
        if path.exists():
            df = pd.read_csv(path, parse_dates=True, index_col=0)
            df = df.loc[start:end]
            for col in ("open", "high", "low", "close", "volume"):
                if col not in df.columns and col != "volume":
                    df[col] = df["close"] if "close" in df else df.iloc[:, 0]
            return df

        processed_path = PROJECT_DATA_ROOT / "processed" / "stock_daily_csi2000_qfq_20260101_20260531.csv"
        if processed_path.exists():
            df = pd.read_csv(processed_path, dtype={"stock_code": str}, encoding="utf-8-sig")
            df = df[df["stock_code"].str.zfill(6) == str(symbol).zfill(6)].copy()
            if not df.empty:
                df["date"] = pd.to_datetime(df["date"])
                df = df.set_index("date").sort_index().loc[start:end]
                df = df.rename(columns={"turnover_rate": "turnover"})
                keep = [col for col in ("open", "high", "low", "close", "volume", "amount", "turnover") if col in df.columns]
                return df[keep]

        return DataSource._sample_data(symbol, start, end)

    @staticmethod
    def _yahoo(symbol: str, start: str, end: str) -> pd.DataFrame:
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start, end=end, auto_adjust=False)
            if df.empty:
                return DataSource._sample_data(symbol, start, end)
            df.rename(columns={
                "Open": "open", "High": "high", "Low": "low",
                "Close": "close", "Volume": "volume",
            }, inplace=True)
            keep = {"open", "high", "low", "close", "volume"}
            df = df[[c for c in df.columns if c in keep]]
            df.index.name = "datetime"
            return df
        except Exception:
            return DataSource._sample_data(symbol, start, end)

    @staticmethod
    def _sample_data(symbol: str, start: str, end: str) -> pd.DataFrame:
        """Generate synthetic OHLCV data for testing when no data source is available."""
        import numpy as np
        dates = pd.date_range(start=start, end=end, freq="D")
        n = len(dates)
        price = 100.0
        prices = []
        for i in range(n):
            change = np.random.normal(0.0005, 0.015)
            price = price * (1 + change)
            prices.append(price)
        df = pd.DataFrame({
            "open": prices,
            "high": [p * 1.02 for p in prices],
            "low": [p * 0.98 for p in prices],
            "close": prices,
            "volume": [int(abs(np.random.normal(1e6, 2e5))) for _ in range(n)],
        }, index=dates)
        df.index.name = "datetime"
        return df


# ----------- Engine -----------

class BacktestEngine:
    """Wraps backtrader Cerebro for running backtests and extracting results."""

    def __init__(
        self,
        symbols: list[str],
        start_date: str,
        end_date: str,
        initial_capital: float = 100000.0,
        slippage: float = 0.0004,
        commission: float = 0.0006,
        strategy_code: str = "",
        data_source: str = "local",
    ):
        self.symbols = symbols
        self.start_date = start_date
        self.end_date = end_date
        self.initial_capital = initial_capital
        self.slippage = slippage
        self.commission = commission
        self.strategy_code = strategy_code
        self.data_source = data_source

    def run(self) -> dict:
        cerebro = bt.Cerebro()

        # Add data feeds
        for symbol in self.symbols:
            df = DataSource.get_data(symbol, self.start_date, self.end_date, self.data_source)
            data = bt.feeds.PandasData(dataname=df, name=symbol)
            cerebro.adddata(data)

        # Add strategy
        cerebro.addstrategy(
            DynamicStrategy,
            code=self.strategy_code,
            slippage=self.slippage,
        )

        # Configure broker
        cerebro.broker.set_cash(self.initial_capital)
        cerebro.broker.setcommission(commission=self.commission)

        if self.slippage > 0:
            cerebro.broker.set_slippage_perc(self.slippage)

        # Add analyzers
        cerebro.addanalyzer(TradeRecorder, _name="trades")
        cerebro.addanalyzer(EquityCurveRecorder, _name="equity")
        cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name="sharpe", timeframe=bt.TimeFrame.Days, riskfreerate=0.02)
        cerebro.addanalyzer(bt.analyzers.DrawDown, _name="drawdown")
        cerebro.addanalyzer(bt.analyzers.Returns, _name="returns")
        cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name="trade_analysis")
        cerebro.addanalyzer(bt.analyzers.VWR, _name="vwr")

        # Run
        results = cerebro.run()

        if not results:
            return self._empty_result("No results from backtest engine")

        strategy_result = results[0]
        return self._extract_results(cerebro, strategy_result)

    def _extract_results(self, cerebro: bt.Cerebro, strategy_result) -> dict:
        final_value = cerebro.broker.getvalue()
        total_return = ((final_value - self.initial_capital) / self.initial_capital) * 100

        # Analyzer data
        sharpe_analysis = strategy_result.analyzers.sharpe.get_analysis() if hasattr(strategy_result.analyzers, "sharpe") else {}
        drawdown_analysis = strategy_result.analyzers.drawdown.get_analysis() if hasattr(strategy_result.analyzers, "drawdown") else {}
        returns_analysis = strategy_result.analyzers.returns.get_analysis() if hasattr(strategy_result.analyzers, "returns") else {}
        trade_analysis = strategy_result.analyzers.trade_analysis.get_analysis() if hasattr(strategy_result.analyzers, "trade_analysis") else {}
        raw_trades = strategy_result.analyzers.trades.get_analysis() if hasattr(strategy_result.analyzers, "trades") else {}
        raw_equity = strategy_result.analyzers.equity.get_analysis() if hasattr(strategy_result.analyzers, "equity") else {}

        # Extract equity curve with drawdown
        equity_series = raw_equity.get("equity_curve", [])
        equity_values = [p["equity"] for p in equity_series]
        peak = equity_values[0] if equity_values else 1
        equity_curve = []
        for point in equity_series:
            if point["equity"] > peak:
                peak = point["equity"]
            dd = ((peak - point["equity"]) / peak) * 100 if peak > 0 else 0
            equity_curve.append({
                "date": point["date"],
                "equity": point["equity"],
                "drawdown": round(dd, 4),
            })

        # Trades
        trades_list = raw_trades.get("trades", [])

        # Monthly returns
        monthly_returns = self._calc_monthly_returns(equity_series)

        # Win rate & profit factor
        total_trades = trade_analysis.get("total", {}).get("total", len(trades_list))
        won = trade_analysis.get("won", {}).get("total", 0)
        lost = trade_analysis.get("lost", {}).get("total", 0)
        win_rate = (won / total_trades * 100) if total_trades > 0 else 0.0

        profit_factor = 0.0
        if "won" in trade_analysis and "lost" in trade_analysis:
            gross_won = trade_analysis["won"].get("pnl", {}).get("total", 0)
            gross_lost = abs(trade_analysis["lost"].get("pnl", {}).get("total", 0))
            profit_factor = round(gross_won / gross_lost, 4) if gross_lost > 0 else 0.0

        max_drawdown_pct = drawdown_analysis.get("max", {}).get("drawdown", 0.0)
        sharpe_ratio = sharpe_analysis.get("sharperatio", 0.0) or 0.0
        annualized_return = returns_analysis.get("rnorm100", total_return)

        return {
            "total_return": round(total_return, 4),
            "annualized_return": round(float(annualized_return), 4),
            "sharpe_ratio": round(float(sharpe_ratio), 4),
            "max_drawdown": round(float(max_drawdown_pct), 4),
            "win_rate": round(float(win_rate), 4),
            "profit_factor": round(float(profit_factor), 4),
            "total_trades": int(total_trades),
            "total_commission": round(self.commission * total_trades * 1000, 4),
            "equity_curve": equity_curve,
            "trades": trades_list,
            "monthly_returns": monthly_returns,
        }

    def _calc_monthly_returns(self, equity_series: list[dict]) -> list[dict]:
        if not equity_series:
            return []
        monthly = {}
        for point in equity_series:
            try:
                month_key = point["date"][:7]
            except (IndexError, KeyError):
                continue
            monthly.setdefault(month_key, [])
            monthly[month_key].append(point["equity"])
        result = []
        for month, values in sorted(monthly.items()):
            if len(values) >= 2:
                ret = ((values[-1] - values[0]) / values[0]) * 100
            else:
                ret = 0.0
            result.append({"month": month, "return_pct": round(ret, 4)})
        return result

    def _empty_result(self, reason: str) -> dict:
        return {
            "total_return": 0.0,
            "annualized_return": 0.0,
            "sharpe_ratio": 0.0,
            "max_drawdown": 0.0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "total_trades": 0,
            "total_commission": 0.0,
            "equity_curve": [],
            "trades": [],
            "monthly_returns": [],
            "error": reason,
        }
