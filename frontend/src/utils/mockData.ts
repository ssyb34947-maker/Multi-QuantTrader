import type { Agent, Backtest, Portfolio, Position, Strategy, Trade } from '@/types'

export const equityCurveData = Array.from({ length: 96 }, (_, index) => {
  const month = Math.floor(index / 8) + 1
  const day = (index % 8) * 3 + 1
  const baseline = 1000000 + index * 5200
  const cycle = Math.sin(index * 0.34) * 28000 + Math.cos(index * 0.12) * 16000

  return {
    date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    value: Math.round(baseline + cycle),
  }
})

export const drawdownData = equityCurveData.map((point, index) => ({
  date: point.date,
  value: Number((-2.1 - Math.abs(Math.sin(index * 0.22) * 6.8)).toFixed(2)),
}))

export const strategies: Strategy[] = [
  {
    id: 11,
    name: '跨周期趋势突破',
    description: '双EMA趋势过滤 + ADX趋势确认 + ATR动态止损。快线(15)上穿慢线(40)且ADX>20时入场，ADX<15或快线下穿慢线时离场。单笔风险2%。',
    code: '',
    language: 'python',
    status: 'active',
    tags: ['中证2000', '趋势', 'ADX', 'ATR止损'],
    created_at: '2026-06-17',
    updated_at: '2026-06-17',
  },
  {
    id: 12,
    name: '统计套利 PairNet',
    description: 'Z-score均值回归。价格偏离30日均线超过2倍标准差时入场，回归至0.5倍标准差时离场。单笔风险1.5%。',
    code: '',
    language: 'python',
    status: 'active',
    tags: ['中证2000', '均值回归', 'Z-score', '统计套利'],
    created_at: '2026-06-17',
    updated_at: '2026-06-17',
  },
  {
    id: 13,
    name: '财报事件动量',
    description: '价格动量(20日涨幅>5%) + 成交量放大(>1.5倍均量) + 波动率过滤(ATR/价格<5%)。动量衰竭或波动率飙升时离场，最长持有15日。',
    code: '',
    language: 'python',
    status: 'active',
    tags: ['中证2000', '动量', '成交量', '事件驱动'],
    created_at: '2026-06-17',
    updated_at: '2026-06-17',
  },
  {
    id: 14,
    name: '低波动防守轮动',
    description: '低波动筛选(日波动<4%) + 趋势过滤(价格在50日均线上方) + 波动率反比仓位缩放。波动率低时加大仓位，波动率高时减仓或离场。',
    code: '',
    language: 'python',
    status: 'active',
    tags: ['中证2000', '低波动', '防守', '仓位管理'],
    created_at: '2026-06-17',
    updated_at: '2026-06-17',
  },
]

export const agents: Agent[] = [
  {
    id: 1,
    name: 'Alpha-Scout',
    role: 'analyst',
    model: 'gpt-4.1',
    strategy_id: 1,
    status: 'running',
    created_at: '2026-01-12',
    config: {
      max_position_size: 0.24,
      stop_loss: 0.035,
      take_profit: 0.085,
      risk_per_trade: 0.012,
      max_concurrent_trades: 6,
      allowed_symbols: ['000070', '000926', '002297', '301096'],
      timeframes: ['1d'],
      extra_params: {},
    },
    metrics: {
      total_trades: 418,
      win_rate: 63.4,
      profit_factor: 2.18,
      sharpe_ratio: 1.92,
      max_drawdown: -7.8,
      total_pnl: 126420,
    },
  },
  {
    id: 2,
    name: 'Hedge-Critic',
    role: 'risk_manager',
    model: 'risk-rules-v3',
    strategy_id: 4,
    status: 'running',
    created_at: '2026-02-05',
    config: {
      max_position_size: 0.18,
      stop_loss: 0.022,
      take_profit: 0.052,
      risk_per_trade: 0.008,
      max_concurrent_trades: 10,
      allowed_symbols: ['932000', '000417', '002146', '002297'],
      timeframes: ['1d'],
      extra_params: {},
    },
    metrics: {
      total_trades: 236,
      win_rate: 58.1,
      profit_factor: 1.74,
      sharpe_ratio: 1.43,
      max_drawdown: -4.6,
      total_pnl: 54280,
    },
  },
  {
    id: 3,
    name: 'Pair-Orchestrator',
    role: 'trader',
    model: 'pairnet-v2',
    strategy_id: 2,
    status: 'idle',
    created_at: '2026-03-11',
    config: {
      max_position_size: 0.2,
      stop_loss: 0.028,
      take_profit: 0.06,
      risk_per_trade: 0.01,
      max_concurrent_trades: 8,
      allowed_symbols: ['000070/000417', '002146/000926', '002297/301096'],
      timeframes: ['1d'],
      extra_params: {},
    },
    metrics: {
      total_trades: 189,
      win_rate: 61.9,
      profit_factor: 1.96,
      sharpe_ratio: 1.66,
      max_drawdown: -6.1,
      total_pnl: 87360,
    },
  },
  {
    id: 4,
    name: 'Exec-Guard',
    role: 'executor',
    model: 'execution-router',
    strategy_id: 1,
    status: 'running',
    created_at: '2026-05-03',
    config: {
      max_position_size: 0.16,
      stop_loss: 0.025,
      take_profit: 0.05,
      risk_per_trade: 0.006,
      max_concurrent_trades: 12,
      allowed_symbols: ['000070', '002146', '002297', '301096'],
      timeframes: ['1d'],
      extra_params: {},
    },
    metrics: {
      total_trades: 516,
      win_rate: 67.2,
      profit_factor: 2.41,
      sharpe_ratio: 2.08,
      max_drawdown: -5.2,
      total_pnl: 96470,
    },
  },
]

export const backtests: Backtest[] = [
  {
    id: 101,
    name: '趋势突破 Q2 参数扫描',
    strategy_id: 1,
    agents: [1, 4],
    symbols: ['000070', '000926', '002297', '301096'],
    start_date: '2026-01-05',
    end_date: '2026-05-29',
    initial_capital: 1000000,
    status: 'completed',
    created_at: '2026-06-10 09:20',
    updated_at: '2026-06-10 11:46',
    result: {
      total_return: 42.8,
      annualized_return: 17.6,
      sharpe_ratio: 1.92,
      benchmark_name: 'CSI 2000 equal-weight',
      benchmark_return: 12.6,
      benchmark_annualized_return: 5.2,
      alpha: 12.4,
      max_drawdown: -7.8,
      win_rate: 63.4,
      profit_factor: 2.18,
      total_trades: 418,
      total_commission: 8420,
      equity_curve: [],
      trades: [],
      monthly_returns: [],
    },
  },
  {
    id: 102,
    name: 'PairNet 中证 2000 行业内配对回测',
    strategy_id: 2,
    agents: [3],
    symbols: ['000070/000417', '002146/000926'],
    start_date: '2026-01-05',
    end_date: '2026-05-31',
    initial_capital: 800000,
    status: 'running',
    created_at: '2026-06-12 10:15',
    updated_at: '2026-06-12 10:48',
  },
  {
    id: 103,
    name: '中证 2000 低波动组合压力测试',
    strategy_id: 4,
    agents: [2],
    symbols: ['000011', '000014', '000017', '000025'],
    start_date: '2026-01-05',
    end_date: '2026-05-29',
    initial_capital: 1500000,
    status: 'completed',
    created_at: '2026-06-09 15:00',
    updated_at: '2026-06-09 16:12',
    result: {
      total_return: 31.4,
      annualized_return: 8.2,
      sharpe_ratio: 1.43,
      benchmark_name: 'CSI 2000 equal-weight',
      benchmark_return: 12.6,
      benchmark_annualized_return: 5.2,
      alpha: 3.0,
      max_drawdown: -4.6,
      win_rate: 58.1,
      profit_factor: 1.74,
      total_trades: 236,
      total_commission: 5210,
      equity_curve: [],
      trades: [],
      monthly_returns: [],
    },
  },
]

export const recentTrades: Trade[] = [
  { id: 'T-4601', symbol: '000070 特发信息', side: 'buy', entry_time: '2026-05-26 09:31', exit_time: '2026-05-29 14:40', entry_price: 17.42, exit_price: 18.07, quantity: 52000, pnl: 33800, pnl_pct: 3.73, agent_id: 1, agent_name: 'Factor-Analyst' },
  { id: 'T-4602', symbol: '002146 荣盛发展', side: 'buy', entry_time: '2026-05-27 10:15', exit_time: '2026-05-29 14:52', entry_price: 1.21, exit_price: 1.3, quantity: 360000, pnl: 32400, pnl_pct: 7.44, agent_id: 4, agent_name: 'Portfolio-Manager' },
  { id: 'T-4603', symbol: '002297 博云新材', side: 'sell', entry_time: '2026-05-28 10:00', exit_time: '2026-05-29 14:30', entry_price: 22.9, exit_price: 20.61, quantity: 18000, pnl: 41220, pnl_pct: 10.0, agent_id: 2, agent_name: 'Risk-Manager' },
  { id: 'T-4604', symbol: '000417 合百集团', side: 'sell', entry_time: '2026-05-28 13:10', exit_time: '2026-05-29 14:45', entry_price: 7.72, exit_price: 7.5, quantity: 64000, pnl: 14080, pnl_pct: 2.85, agent_id: 3, agent_name: 'Bear-Agent' },
]

export const positions: Position[] = [
  { symbol: '000070 特发信息', quantity: 52000, avg_entry_price: 17.42, current_price: 18.07, market_value: 939640, unrealized_pnl: 33800, unrealized_pnl_pct: 3.73, weight_pct: 25.8 },
  { symbol: '002146 荣盛发展', quantity: 360000, avg_entry_price: 1.21, current_price: 1.3, market_value: 468000, unrealized_pnl: 32400, unrealized_pnl_pct: 7.44, weight_pct: 12.9 },
  { symbol: '002297 博云新材', quantity: -18000, avg_entry_price: 22.9, current_price: 20.61, market_value: 370980, unrealized_pnl: 41220, unrealized_pnl_pct: 10.0, weight_pct: 10.2 },
  { symbol: '000926 福星股份', quantity: 98000, avg_entry_price: 2.41, current_price: 2.59, market_value: 253820, unrealized_pnl: 17640, unrealized_pnl_pct: 7.47, weight_pct: 7.0 },
  { symbol: '现金/保证金', quantity: 1, avg_entry_price: 1602338, current_price: 1602338, market_value: 1602338, unrealized_pnl: 0, unrealized_pnl_pct: 0, weight_pct: 44.1 },
]

export const portfolio: Portfolio = {
  id: 1,
  name: '多智星基金 Alpha 组合',
  description: '仅基于 data/processed 下中证 2000 数据池运行的多智星基金 Alpha 组合。',
  initial_capital: 1500000,
  current_value: 1824778,
  total_pnl: 324778,
  total_return_pct: 21.65,
  positions,
  performance: {
    total_return: 21.65,
    annualized_return: 18.4,
    sharpe_ratio: 1.87,
    max_drawdown: -7.8,
    volatility: 12.6,
    win_rate: 62.3,
    profit_factor: 2.15,
    total_trades: 1247,
  },
}

export const riskLimits = [
  { name: '单策略资金上限', current: 64, limit: 80 },
  { name: '组合净敞口', current: 42, limit: 65 },
  { name: '单日亏损预算', current: 31, limit: 50 },
  { name: '相关性拥挤度', current: 56, limit: 70 },
]

export const agentWorkflow = [
  { title: '数据池装载', agent: 'Context-Builder', status: '运行中', detail: '仅加载 data/processed 中证 2000 行情、基本面、指数代理与特征面板' },
  { title: '上下文注入', agent: 'Factor-Analyst', status: '运行中', detail: '注入股票池边界、特征 schema、数据覆盖率和候选策略 Skill' },
  { title: '合作讨论', agent: 'Portfolio-Manager', status: '待命', detail: '汇总 Factor Analyst、Bull/Bear 辩论结果与策略 Skill 输出' },
  { title: '入库审批', agent: 'Risk-Manager', status: '运行中', detail: '回测通过且用户授权后，将新策略作为 Skill 注入策略库' },
]


export const csi2000DataPool = {
  name: '中证 2000 数据池',
  indexCode: '932000',
  rootPath: 'data/processed',
  dateRange: '2026-01-01 至 2026-05-31',
  lastTradeDate: '2026-05-20',
  constituents: 2000,
  dailyRows: 189811,
  indexRows: 95,
  infoRows: 1371,
  fundamentalRows: 5874,
  dailySuccess: 2000,
  dailyFailed: 0,
  missingRatio: 11.21,
  files: [
    { name: 'stock_daily_csi2000_qfq_20260101_20260531', type: '日线前复权', rows: '189,811', status: 'ready' },
    { name: 'stock_spot_snapshot_csi2000_latest', type: '最新截面', rows: '2,000', status: 'ready' },
    { name: 'fundamental_csi2000_latest', type: '基本面', rows: '5,874', status: 'ready' },
    { name: 'index_daily_932000_proxy_equal_weight', type: '指数代理', rows: '95', status: 'ready' },
    { name: 'model_panel_base', type: '模型面板', rows: 'parquet', status: 'ready' },
    { name: 'model_feature_schema_v1', type: '特征 Schema', rows: 'json', status: 'ready' },
  ],
}

export const contextInjectionPlan = [
  { agent: 'Factor Analyst Agent', context: '股票池边界 + 特征 Schema + 数据覆盖报告', payload: ['index_code=932000', 'n_constituents=2000', 'feature_schema_v1'], status: '已注入' },
  { agent: 'Bull Agent', context: '最新截面 + 强势成交额/换手率候选', payload: ['stock_spot_snapshot', 'pct_change', 'turnover_rate'], status: '已注入' },
  { agent: 'Bear Agent', context: '缺失率 + 回撤压力 + 异常波动样本', payload: ['missing_ratio=11.21%', 'vol_20d', 'drawdown_probe'], status: '已注入' },
  { agent: 'Portfolio Manager Agent', context: '策略 Skill 输出 + 回测指标 + 风险预算', payload: ['strategy_skill_registry', 'backtest_metrics', 'capital_budget'], status: '待确认' },
  { agent: 'Risk Manager Agent', context: '风控阈值 + 入库审批策略 + 审计日志', payload: ['risk_gate', 'user_approval_required', 'audit-log.mcp'], status: '已注入' },
]

export const strategySkillLifecycle = [
  { step: '模拟生成', detail: '多智星基金投研流程生成候选量化策略代码与参数。', status: '自动' },
  { step: '回测验证', detail: '仅使用中证 2000 数据池执行回测，输出收益、回撤、胜率、稳定性。', status: '强制' },
  { step: '用户授权', detail: '策略通过阈值后仍需用户允许，禁止自动写入策略库。', status: '人工' },
  { step: '注入策略库', detail: '授权后将策略注册为 Strategy Skill，供后续 Agent 编排调用。', status: '可复用' },
]

export const strategySkillRegistry = strategies.map((strategy) => ({
  ...strategy,
  skillName: `strategy_skill_${strategy.id}`,
  source: strategy.status === 'draft' ? '候选模拟' : '回测通过',
  permission: strategy.status === 'draft' ? '等待用户授权' : '已授权注入',
  callableByAgents: ['Factor Analyst Agent', 'Portfolio Manager Agent', 'Risk Manager Agent'],
}))
