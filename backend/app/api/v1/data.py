"""Data API - File-based market data endpoints."""

from fastapi import APIRouter, HTTPException, Query, status

from app.services.data_service import (
    list_symbols,
    list_all_stocks,
    get_stock_data,
    get_index_data,
    get_fund_nav,
    get_market_snapshot,
    compute_technical_indicators,
)
from app.api.deps import ok

router = APIRouter(prefix="/data", tags=["Data"])


@router.get("/symbols")
async def api_list_symbols():
    """List all available stock symbols with metadata."""
    symbols = list_symbols()
    return ok(symbols)


@router.get("/stocks/all")
async def api_list_all_stocks():
    """List all 2000 CSI 2000 constituent stocks with codes and names."""
    stocks = list_all_stocks()
    return ok(stocks)


@router.get("/stock/{symbol}")
async def api_get_stock_data(
    symbol: str,
    start: str = Query(None, description="Start date YYYY-MM-DD"),
    end: str = Query(None, description="End date YYYY-MM-DD"),
    indicators: bool = Query(False, description="Include technical indicators"),
):
    """Get OHLCV data for a stock symbol."""
    try:
        df = get_stock_data(symbol, start, end)
        if indicators:
            df = compute_technical_indicators(df)
        records = df.reset_index().to_dict(orient="records")
        return ok(records)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/index/{code}")
async def api_get_index_data(
    code: str,
    start: str = Query(None, description="Start date YYYY-MM-DD"),
    end: str = Query(None, description="End date YYYY-MM-DD"),
):
    """Get index data."""
    try:
        df = get_index_data(code, start, end)
        records = df.reset_index().to_dict(orient="records")
        return ok(records)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/fund/nav")
async def api_get_fund_nav(
    start: str = Query(None, description="Start date YYYY-MM-DD"),
    end: str = Query(None, description="End date YYYY-MM-DD"),
):
    """Get fund NAV data."""
    try:
        df = get_fund_nav(start, end)
        records = df.reset_index().to_dict(orient="records")
        return ok(records)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/snapshot/{symbol}")
async def api_get_snapshot(
    symbol: str,
    as_of_date: str = Query(None, description="Analysis cut-off date YYYY-MM-DD"),
):
    """Get market snapshot with technical indicators for a symbol."""
    try:
        snapshot = get_market_snapshot(symbol, as_of_date=as_of_date)
        return ok(snapshot)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
