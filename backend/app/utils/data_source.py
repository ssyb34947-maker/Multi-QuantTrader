"""Market data fetching utilities.

Supports Yahoo Finance and Binance (via ccxt) data sources.
Abstracted here so the backtrader engine doesn't depend directly on external libraries.
"""

from typing import Any

import pandas as pd

from app.config import settings


def fetch_data(
    symbol: str,
    start_date: str,
    end_date: str,
    source: str = "",
) -> pd.DataFrame:
    source = source or settings.default_data_source
    if source == "yahoo":
        return _fetch_yahoo(symbol, start_date, end_date)
    elif source == "binance":
        return _fetch_binance(symbol, start_date, end_date)
    else:
        return _fetch_yahoo(symbol, start_date, end_date)


def _fetch_yahoo(symbol: str, start: str, end: str) -> pd.DataFrame:
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start, end=end)
    if df.empty:
        raise ValueError(f"No data for {symbol}")
    df.rename(columns={
        "Open": "open", "High": "high", "Low": "low",
        "Close": "close", "Volume": "volume",
    }, inplace=True)
    df.index.name = "datetime"
    return df


def _fetch_binance(symbol: str, start: str, end: str) -> pd.DataFrame:
    import ccxt
    exchange = ccxt.binance()
    since = exchange.parse8601(f"{start}T00:00:00Z")
    ohlcv = exchange.fetch_ohlcv(symbol.replace("-", "/"), "1d", since=since, limit=1000)
    df = pd.DataFrame(ohlcv, columns=["datetime", "open", "high", "low", "close", "volume"])
    df["datetime"] = pd.to_datetime(df["datetime"], unit="ms")
    df.set_index("datetime", inplace=True)
    return df.loc[start:end]
