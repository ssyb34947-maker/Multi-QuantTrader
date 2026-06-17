"""File-based market data service.

Reads OHLCV data from data/ CSV files. Supports stock daily data,
index data, and fund NAV data. Caches loaded dataframes in memory.
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import numpy as np

DATA_ROOT = Path(__file__).parent.parent.parent / "data"
PROJECT_DATA_ROOT = Path(__file__).parent.parent.parent.parent / "data"


def list_symbols() -> list[dict]:
    """List all available stock symbols with metadata."""
    catalog = DATA_ROOT / "processed" / "data_catalog.csv"
    if catalog.exists():
        df = pd.read_csv(catalog, dtype={"symbol": str})
        # Ensure 6-digit zero-padded symbols
        if "symbol" in df.columns:
            df["symbol"] = df["symbol"].str.zfill(6)
        return df.to_dict(orient="records")

    # Auto-detect from stock_daily directory
    stock_dir = DATA_ROOT / "stock_daily"
    results = []
    if stock_dir.exists():
        for f in sorted(stock_dir.glob("*.csv")):
            results.append({
                "symbol": f.stem,
                "file": f"stock_daily/{f.name}",
                "rows": 0,
                "start_date": "",
                "end_date": "",
            })
    return results


def get_stock_data(symbol: str, start: Optional[str] = None, end: Optional[str] = None) -> pd.DataFrame:
    """Get OHLCV data for a stock symbol from local CSV."""
    symbol = str(symbol).zfill(6)
    path = DATA_ROOT / "stock_daily" / f"{symbol}.csv"
    if not path.exists():
        raise FileNotFoundError(f"No data file for symbol {symbol} at {path}")

    df = pd.read_csv(path, parse_dates=True, index_col=0)
    df.index.name = "datetime"

    if start:
        df = df[df.index >= start]
    if end:
        df = df[df.index <= end]

    return df


def get_index_data(index_code: str = "csi2000_equal_weight", start: Optional[str] = None, end: Optional[str] = None) -> pd.DataFrame:
    """Get index data."""
    path = DATA_ROOT / "index" / f"{index_code}.csv"
    if not path.exists():
        raise FileNotFoundError(f"No index data file at {path}")

    df = pd.read_csv(path, parse_dates=True, index_col=0)
    df.index.name = "datetime"

    if start:
        df = df[df.index >= start]
    if end:
        df = df[df.index <= end]

    return df


def get_fund_nav(start: Optional[str] = None, end: Optional[str] = None) -> pd.DataFrame:
    """Get fund NAV data."""
    path = DATA_ROOT / "fund" / "nav.csv"
    if not path.exists():
        raise FileNotFoundError(f"No fund NAV file at {path}")

    df = pd.read_csv(path, parse_dates=True, index_col=0)
    df.index.name = "datetime"

    if start:
        df = df[df.index >= start]
    if end:
        df = df[df.index <= end]

    return df


def compute_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Compute common technical indicators on OHLCV data."""
    result = df.copy()

    # SMA
    result["sma_5"] = result["close"].rolling(5).mean()
    result["sma_10"] = result["close"].rolling(10).mean()
    result["sma_20"] = result["close"].rolling(20).mean()
    result["sma_60"] = result["close"].rolling(60).mean()

    # EMA
    result["ema_12"] = result["close"].ewm(span=12).mean()
    result["ema_26"] = result["close"].ewm(span=26).mean()

    # MACD
    result["macd"] = result["ema_12"] - result["ema_26"]
    result["macd_signal"] = result["macd"].ewm(span=9).mean()

    # RSI
    delta = result["close"].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    result["rsi_14"] = 100 - (100 / (1 + rs))

    # Bollinger Bands
    result["bb_mid"] = result["close"].rolling(20).mean()
    std = result["close"].rolling(20).std()
    result["bb_upper"] = result["bb_mid"] + 2 * std
    result["bb_lower"] = result["bb_mid"] - 2 * std

    # ATR
    high_low = result["high"] - result["low"]
    high_close = (result["high"] - result["close"].shift()).abs()
    low_close = (result["low"] - result["close"].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    result["atr_14"] = tr.rolling(14).mean()

    # Volume indicators
    result["volume_sma_20"] = result["volume"].rolling(20).mean()
    result["volume_ratio"] = result["volume"] / result["volume_sma_20"]

    # Returns
    result["return_1d"] = result["close"].pct_change()
    result["return_5d"] = result["close"].pct_change(5)
    result["return_20d"] = result["close"].pct_change(20)

    # Volatility
    result["volatility_20d"] = result["return_1d"].rolling(20).std()

    return result


def get_market_snapshot(symbol: str, as_of_date: Optional[str] = None) -> dict:
    """Get a market snapshot with technical indicators for analysis.

    If as_of_date is given, only data up to that date is used.
    """
    df = get_stock_data(symbol, end=as_of_date)
    if df.empty:
        return {"symbol": symbol, "error": "no data"}

    df_tech = compute_technical_indicators(df)
    latest = df_tech.iloc[-1]
    prev = df_tech.iloc[-2] if len(df_tech) > 1 else latest

    return {
        "symbol": symbol,
        "date": str(df.index[-1].date()),
        "price": round(float(latest["close"]), 2),
        "open": round(float(latest["open"]), 2),
        "high": round(float(latest["high"]), 2),
        "low": round(float(latest["low"]), 2),
        "volume": int(latest["volume"]),
        "change_pct": round(float((latest["close"] / prev["close"] - 1) * 100), 2),
        "sma_5": round(float(latest["sma_5"]), 2) if pd.notna(latest.get("sma_5")) else None,
        "sma_10": round(float(latest["sma_10"]), 2) if pd.notna(latest.get("sma_10")) else None,
        "sma_20": round(float(latest["sma_20"]), 2) if pd.notna(latest.get("sma_20")) else None,
        "sma_60": round(float(latest["sma_60"]), 2) if pd.notna(latest.get("sma_60")) else None,
        "macd": round(float(latest["macd"]), 4) if pd.notna(latest.get("macd")) else None,
        "rsi_14": round(float(latest["rsi_14"]), 2) if pd.notna(latest.get("rsi_14")) else None,
        "bb_upper": round(float(latest["bb_upper"]), 2) if pd.notna(latest.get("bb_upper")) else None,
        "bb_lower": round(float(latest["bb_lower"]), 2) if pd.notna(latest.get("bb_lower")) else None,
        "atr_14": round(float(latest["atr_14"]), 4) if pd.notna(latest.get("atr_14")) else None,
        "volume_ratio": round(float(latest["volume_ratio"]), 2) if pd.notna(latest.get("volume_ratio")) else None,
        "return_5d": round(float(latest["return_5d"] * 100), 2) if pd.notna(latest.get("return_5d")) else None,
        "return_20d": round(float(latest["return_20d"] * 100), 2) if pd.notna(latest.get("return_20d")) else None,
        "volatility_20d": round(float(latest["volatility_20d"] * 100), 2) if pd.notna(latest.get("volatility_20d")) else None,
    }


def list_all_stocks() -> list[dict]:
    """List all 2000 CSI 2000 constituent stocks with codes and names.

    Tries multiple sources in order of preference:
    1. constituents file in project root data/
    2. coverage report in project root data/
    3. stock_daily directory listing as fallback
    """
    sources = [
        PROJECT_DATA_ROOT / "raw" / "csi2000" / "constituents_932000_latest.csv",
        PROJECT_DATA_ROOT / "processed" / "data_coverage_report.csv",
    ]

    for path in sources:
        if path.exists():
            df = pd.read_csv(path, dtype={"stock_code": str})
            if "stock_code" in df.columns and "stock_name" in df.columns:
                df["stock_code"] = df["stock_code"].str.zfill(6)
                return df[["stock_code", "stock_name"]].to_dict(orient="records")

    # Fallback: scan stock_daily directories
    seen = set()
    results = []
    for root in [DATA_ROOT / "stock_daily", PROJECT_DATA_ROOT / "raw" / "stock_daily" / "qfq"]:
        if root.exists():
            for f in sorted(root.glob("*.csv")):
                sym = f.stem.zfill(6)
                if sym not in seen:
                    seen.add(sym)
                    results.append({"stock_code": sym, "stock_name": ""})
    return results


def predict_forward(symbol: str, as_of_date: str, days: int = 5) -> pd.DataFrame:
    """Generate predicted OHLCV data for N days after as_of_date.

    Uses the last 20 trading days before as_of_date to estimate drift and
    volatility, then simulates forward paths with a random walk.
    """
    df = get_stock_data(symbol, end=as_of_date)
    if df.empty or len(df) < 10:
        raise ValueError(f"Not enough data for {symbol} to generate predictions")

    recent = df.tail(20)
    closes = recent["close"].values
    daily_returns = np.diff(closes) / closes[:-1]
    mu = np.mean(daily_returns)
    sigma = np.std(daily_returns)

    last = df.iloc[-1]
    last_close = float(last["close"])
    last_open = float(last["open"])
    last_high = float(last["high"])
    last_low = float(last["low"])
    last_volume = int(last["volume"])

    last_date = pd.Timestamp(as_of_date)
    pred_dates = pd.bdate_range(last_date + pd.Timedelta(days=1), periods=days)

    prices = [last_close]
    for _ in range(days):
        ret = np.random.normal(mu, sigma)
        prices.append(prices[-1] * (1 + ret))
    prices = prices[1:]  # remove the starting price

    rows = []
    for i, d in enumerate(pred_dates):
        c = prices[i]
        daily_vol = c * sigma * 0.5
        rows.append({
            "datetime": d,
            "open": round(c - daily_vol, 2),
            "high": round(c + abs(daily_vol) * 1.5, 2),
            "low": round(c - abs(daily_vol) * 1.5, 2),
            "close": round(c, 2),
            "volume": int(abs(np.random.normal(last_volume, last_volume * 0.1))),
        })

    pred_df = pd.DataFrame(rows)
    pred_df = pred_df.set_index("datetime")
    pred_df.index.name = "datetime"
    return pred_df
