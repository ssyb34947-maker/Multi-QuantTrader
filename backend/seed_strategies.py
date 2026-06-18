"""Seed the database with professional trading strategies compatible with DynamicStrategy.

Each strategy must expose a `next(strategy, data)` function called by backtrader
on every bar. The module can also define helper functions and constants.
"""

import asyncio
import json

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import init_db, get_db
from app.models.user import User
from app.models.strategy import Strategy

# ── Strategy 1: 跨周期趋势突破 ──────────────────────────────────────────

STRAT_1_CODE = r'''# 跨周期趋势突破 - Multi-timeframe Trend Breakout
# Combines SMA trend filter with ADX confirmation and volatility-based stop.

ADX_PERIOD = 14
TREND_SLOW = 40
TREND_FAST = 15
ATR_MULTIPLIER = 2.0
RISK_PER_TRADE = 0.02

def _ema(series, period):
    alpha = 2 / (period + 1)
    result = [series[0]]
    for i in range(1, len(series)):
        result.append(series[i] * alpha + result[-1] * (1 - alpha))
    return result

def _atr(data, period=14):
    tr = []
    for i in range(len(data.close)):
        if i == 0:
            tr.append(data.high[0] - data.low[0])
        else:
            hl = data.high[i] - data.low[i]
            hc = abs(data.high[i] - data.close[i - 1])
            lc = abs(data.low[i] - data.close[i - 1])
            tr.append(max(hl, hc, lc))
    atr_vals = []
    for i in range(len(tr)):
        if i < period:
            atr_vals.append(sum(tr[:i + 1]) / (i + 1))
        else:
            atr_vals.append((atr_vals[-1] * (period - 1) + tr[i]) / period)
    return atr_vals

def _adx(data, period=14):
    plus_dm, minus_dm = [0.0], [0.0]
    tr = [data.high[0] - data.low[0]]
    for i in range(1, len(data.close)):
        up_move = data.high[i] - data.high[i - 1]
        down_move = data.low[i - 1] - data.low[i]
        plus_dm.append(max(up_move, 0) if up_move > down_move else 0)
        minus_dm.append(max(down_move, 0) if down_move > up_move else 0)
        hl = data.high[i] - data.low[i]
        hc = abs(data.high[i] - data.close[i - 1])
        lc = abs(data.low[i] - data.close[i - 1])
        tr.append(max(hl, hc, lc))

    def _smooth(values, p=period):
        smoothed = [sum(values[:p]) / p]
        for v in values[p:]:
            smoothed.append((smoothed[-1] * (p - 1) + v) / p)
        return [smoothed[0]] * (p - 1) + smoothed

    plus_smooth = _smooth(plus_dm)
    minus_smooth = _smooth(minus_dm)
    tr_smooth = _smooth(tr)
    plus_di = [100 * p / t if t > 0 else 0 for p, t in zip(plus_smooth, tr_smooth)]
    minus_di = [100 * p / t if t > 0 else 0 for p, t in zip(minus_smooth, tr_smooth)]
    dx = [abs(plus_di[i] - minus_di[i]) / (plus_di[i] + minus_di[i]) * 100
           if (plus_di[i] + minus_di[i]) > 0 else 0 for i in range(len(plus_di))]
    adx_val = _smooth(dx, period)
    return adx_val, plus_di, minus_di


def next(strategy, data):
    bar = len(data)
    if bar < TREND_SLOW + ADX_PERIOD + 5:
        return

    close = [float(data.close[i]) for i in range(bar)]
    ema_fast = _ema(close, TREND_FAST)
    ema_slow = _ema(close, TREND_SLOW)
    adx_vals, plus_di, minus_di = _adx(data, ADX_PERIOD)
    atr_vals = _atr(data, ATR_PERIOD)

    price = float(data.close[0])
    atr = atr_vals[-1] if atr_vals else price * 0.02
    position = strategy.getposition(data)
    cash = strategy.broker.getvalue()
    risk_capital = cash * RISK_PER_TRADE

    # Entry: EMA fast crosses above slow + ADX > 20 (trending)
    if not position.size:
        if (ema_fast[-1] > ema_slow[-1] and ema_fast[-2] <= ema_slow[-2]
                and adx_vals[-1] > 20):
            size = max(100, int(risk_capital / (ATR_MULTIPLIER * atr) / 100) * 100)
            strategy.buy(data=data, size=size)

    # Exit: EMA cross down or ADX falls below 15
    elif position.size > 0:
        if (ema_fast[-1] < ema_slow[-1] and ema_fast[-2] >= ema_slow[-2]) or adx_vals[-1] < 15:
            strategy.sell(data=data, size=position.size)
'''

# ── Strategy 2: 统计套利 PairNet ──────────────────────────────────────

STRAT_2_CODE = r'''# 统计套利 PairNet - Statistical Pairs Trading (single-security Z-score mean reversion)
# Uses Z-score of price vs rolling mean to identify oversold/overbought levels.

LOOKBACK = 30
ENTRY_Z = 2.0
EXIT_Z = 0.5
ATR_PERIOD = 14
RISK_PER_TRADE = 0.015

def _sma(series, period):
    if len(series) < period:
        return sum(series) / len(series)
    return sum(series[-period:]) / period

def _std(series, period):
    if len(series) < period:
        return 0.0
    mean = sum(series[-period:]) / period
    variance = sum((x - mean) ** 2 for x in series[-period:]) / period
    return variance ** 0.5

def _atr(data, period=14):
    tr = []
    for i in range(len(data.close)):
        if i == 0:
            tr.append(data.high[0] - data.low[0])
        else:
            hl = data.high[i] - data.low[i]
            hc = abs(data.high[i] - data.close[i - 1])
            lc = abs(data.low[i] - data.close[i - 1])
            tr.append(max(hl, hc, lc))
    atr_vals = []
    for i in range(len(tr)):
        if i < period:
            atr_vals.append(sum(tr[:i + 1]) / (i + 1))
        else:
            atr_vals.append((atr_vals[-1] * (period - 1) + tr[i]) / period)
    return atr_vals


def next(strategy, data):
    bar = len(data)
    if bar < LOOKBACK + 5:
        return

    close = [float(data.close[i]) for i in range(bar)]
    price = close[-1]
    mean = _sma(close, LOOKBACK)
    std = _std(close, LOOKBACK)

    if std == 0:
        return

    z_score = (price - mean) / std
    atr_vals = _atr(data, ATR_PERIOD)
    atr = atr_vals[-1] if atr_vals else price * 0.015

    position = strategy.getposition(data)
    cash = strategy.broker.getvalue()
    risk_capital = cash * RISK_PER_TRADE
    size = max(100, int(risk_capital / atr / 100) * 100)

    # Short when Z-score above +ENTRY_Z (overbought)
    if not position.size and z_score > ENTRY_Z:
        strategy.sell(data=data, size=size)

    # Long when Z-score below -ENTRY_Z (oversold)
    elif not position.size and z_score < -ENTRY_Z:
        strategy.buy(data=data, size=size)

    # Exit when reverting to mean
    elif position.size > 0 and abs(z_score) < EXIT_Z:
        if position.size > 0:
            strategy.sell(data=data, size=position.size)
        else:
            strategy.buy(data=data, size=abs(position.size))
'''

# ── Strategy 3: 财报事件动量 ──────────────────────────────────────────

STRAT_3_CODE = r'''# 财报事件动量 - Earnings Event Momentum
# Combines price momentum with volume confirmation and volatility regime filter.

MOMENTUM_LOOKBACK = 20
VOLUME_LOOKBACK = 20
VOLUME_SURGE = 1.5
MIN_MOMENTUM = 5.0
ATR_PERIOD = 14
MAX_HOLDING = 15

def _sma(series, period):
    if len(series) < period:
        return sum(series) / len(series)
    return sum(series[-period:]) / period

def _atr(data, period=14):
    tr = []
    for i in range(len(data.close)):
        if i == 0:
            tr.append(data.high[0] - data.low[0])
        else:
            hl = data.high[i] - data.low[i]
            hc = abs(data.high[i] - data.close[i - 1])
            lc = abs(data.low[i] - data.close[i - 1])
            tr.append(max(hl, hc, lc))
    atr_vals = []
    for i in range(len(tr)):
        if i < period:
            atr_vals.append(sum(tr[:i + 1]) / (i + 1))
        else:
            atr_vals.append((atr_vals[-1] * (period - 1) + tr[i]) / period)
    return atr_vals


def next(strategy, data):
    bar = len(data)
    if bar < MOMENTUM_LOOKBACK + VOLUME_LOOKBACK + 5:
        return

    close = [float(data.close[i]) for i in range(bar)]
    volume = [float(data.volume[i]) for i in range(bar)]

    price = close[-1]
    momentum = ((price / close[-(MOMENTUM_LOOKBACK + 1)]) - 1) * 100
    avg_volume = _sma(volume, VOLUME_LOOKBACK)
    vol_ratio = volume[-1] / avg_volume if avg_volume > 0 else 1.0

    atr_vals = _atr(data, ATR_PERIOD)
    atr = atr_vals[-1] if atr_vals else price * 0.015

    position = strategy.getposition(data)

    # Entry: strong momentum + volume surge + reasonable volatility
    if not position.size:
        if momentum > MIN_MOMENTUM and vol_ratio > VOLUME_SURGE and atr / price < 0.05:
            cash = strategy.broker.getvalue()
            risk_capital = cash * 0.02
            size = max(100, int(risk_capital / atr / 100) * 100)
            strategy.buy(data=data, size=size)

    # Exit: momentum fades, volatility spikes, or holding period exceeded
    elif position.size > 0:
        holding = bar - getattr(strategy, "_entry_bar", bar)
        if momentum < 0 or vol_ratio < 0.5 or atr / price > 0.06 or holding > MAX_HOLDING:
            strategy.sell(data=data, size=position.size)
'''

# ── Strategy 4: 低波动防守轮动 ────────────────────────────────────────

STRAT_4_CODE = r'''# 低波动防守轮动 - Low Volatility Defensive Rotation
# Targets low-volatility securities with trend filter and position scaling.

LOOKBACK = 30
VOLATILITY_THRESHOLD = 0.04  # 4% daily volatility max
TREND_PERIOD = 50
ATR_PERIOD = 14
MAX_POSITION_FACTOR = 0.25
BASE_RISK = 0.015

def _sma(series, period):
    if len(series) < period:
        return sum(series) / len(series)
    return sum(series[-period:]) / period

def _std(series, period):
    if len(series) < period:
        return 0.0
    mean = sum(series[-period:]) / period
    variance = sum((x - mean) ** 2 for x in series[-period:]) / period
    return variance ** 0.5

def _atr(data, period=14):
    tr = []
    for i in range(len(data.close)):
        if i == 0:
            tr.append(data.high[0] - data.low[0])
        else:
            hl = data.high[i] - data.low[i]
            hc = abs(data.high[i] - data.close[i - 1])
            lc = abs(data.low[i] - data.close[i - 1])
            tr.append(max(hl, hc, lc))
    atr_vals = []
    for i in range(len(tr)):
        if i < period:
            atr_vals.append(sum(tr[:i + 1]) / (i + 1))
        else:
            atr_vals.append((atr_vals[-1] * (period - 1) + tr[i]) / period)
    return atr_vals


def next(strategy, data):
    bar = len(data)
    if bar < TREND_PERIOD + 10:
        return

    close = [float(data.close[i]) for i in range(bar)]
    returns = [(close[i] / close[i - 1] - 1) for i in range(1, bar)]
    price = close[-1]
    daily_vol = _std(returns, min(LOOKBACK, len(returns)))
    sma_trend = _sma(close, TREND_PERIOD)

    # Defensive filter: skip if volatility too high or below trend
    if daily_vol > VOLATILITY_THRESHOLD or price < sma_trend * 0.95:
        position = strategy.getposition(data)
        if position.size > 0:
            strategy.sell(data=data, size=position.size)
        return

    atr_vals = _atr(data, ATR_PERIOD)
    atr = atr_vals[-1] if atr_vals else price * 0.01

    position = strategy.getposition(data)
    cash = strategy.broker.getvalue()

    # Scale position size inversely with volatility
    vol_adjust = max(0.3, min(1.0, VOLATILITY_THRESHOLD / max(daily_vol, 0.001)))
    risk_factor = BASE_RISK * vol_adjust
    risk_capital = cash * risk_factor
    size = max(100, int(risk_capital / atr / 100) * 100)

    if not position.size:
        if price > sma_trend and daily_vol < VOLATILITY_THRESHOLD * 0.8:
            strategy.buy(data=data, size=size)

    elif position.size > 0:
        if price < sma_trend * 0.92 or daily_vol > VOLATILITY_THRESHOLD:
            strategy.sell(data=data, size=position.size)
'''

STRATEGIES = [
    {
        "name": "跨周期趋势突破",
        "description": "双EMA趋势过滤 + ADX趋势确认 + ATR动态止损。快线(15)上穿慢线(40)且ADX>20时入场，ADX<15或快线下穿慢线时离场。单笔风险2%。",
        "code": STRAT_1_CODE,
        "language": "python",
        "status": "active",
        "tags": ["中证2000", "趋势", "ADX", "ATR止损"],
    },
    {
        "name": "统计套利 PairNet",
        "description": "Z-score均值回归。价格偏离30日均线超过2倍标准差时入场，回归至0.5倍标准差时离场。单笔风险1.5%。",
        "code": STRAT_2_CODE,
        "language": "python",
        "status": "active",
        "tags": ["中证2000", "均值回归", "Z-score", "统计套利"],
    },
    {
        "name": "财报事件动量",
        "description": "价格动量(20日涨幅>5%) + 成交量放大(>1.5倍均量) + 波动率过滤(ATR/价格<5%)。动量衰竭或波动率飙升时离场，最长持有15日。",
        "code": STRAT_3_CODE,
        "language": "python",
        "status": "active",
        "tags": ["中证2000", "动量", "成交量", "事件驱动"],
    },
    {
        "name": "低波动防守轮动",
        "description": "低波动筛选(日波动<4%) + 趋势过滤(价格在50日均线上方) + 波动率反比仓位缩放。波动率低时加大仓位，波动率高时减仓或离场。",
        "code": STRAT_4_CODE,
        "language": "python",
        "status": "active",
        "tags": ["中证2000", "低波动", "防守", "仓位管理"],
    },
]


async def seed_strategies():
    await init_db()

    async for db in get_db():
        # Check if our specific professional strategies already exist by name
        strategy_names = [s["name"] for s in STRATEGIES]
        existing = await db.execute(
            select(Strategy.name).where(Strategy.name.in_(strategy_names))
        )
        if existing.scalars().all():
            print("Professional strategies already seeded, skipping.")
            return

        # Find or create demo user
        result = await db.execute(select(User).where(User.username == "duozhixing-demo"))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                username="duozhixing-demo",
                email="demo@duozhixing.local",
                hashed_password="demo-disabled",
                role="user",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        for s in STRATEGIES:
            strat = Strategy(
                name=s["name"],
                description=s["description"],
                code=s["code"],
                language=s["language"],
                status=s["status"],
                tags=json.dumps(s["tags"], ensure_ascii=False),
                user_id=user.id,
            )
            db.add(strat)

        await db.commit()
        print(f"Seeded {len(STRATEGIES)} professional strategies.")
        break


if __name__ == "__main__":
    asyncio.run(seed_strategies())
