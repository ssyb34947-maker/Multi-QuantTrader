// ========== 用户 & 认证 ==========

export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'user'
  created_at: string
}

// ========== 策略 ==========

export type StrategyStatus = 'draft' | 'active' | 'archived'
export type StrategyLanguage = 'python' | 'pinescript'

export interface Strategy {
  id: number
  name: string
  description: string
  code: string
  language: StrategyLanguage
  status: StrategyStatus
  tags: string[]
  created_at: string
  updated_at: string
}

// ========== 智能体 ==========

export type AgentRole = 'analyst' | 'trader' | 'risk_manager' | 'executor' | 'observer'
export type AgentStatus = 'idle' | 'running' | 'error' | 'stopped'

export interface Agent {
  id: number
  name: string
  role: AgentRole
  model: string
  strategy_id: number
  config: AgentConfig
  status: AgentStatus
  metrics: AgentMetrics
  created_at: string
}

export interface AgentConfig {
  max_position_size: number
  stop_loss: number
  take_profit: number
  risk_per_trade: number
  max_concurrent_trades: number
  allowed_symbols: string[]
  timeframes: string[]
  extra_params: Record<string, unknown>
}

export interface AgentMetrics {
  total_trades: number
  win_rate: number
  profit_factor: number
  sharpe_ratio: number
  max_drawdown: number
  total_pnl: number
}

// ========== 回测 ==========

export type BacktestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Backtest {
  id: number
  name: string
  strategy_id: number
  agents: number[]
  symbols: string[]
  start_date: string
  end_date: string
  initial_capital: number
  status: BacktestStatus
  result?: BacktestResult
  created_at: string
  updated_at: string
}

export interface BacktestResult {
  total_return: number
  annualized_return: number
  sharpe_ratio: number
  max_drawdown: number
  win_rate: number
  profit_factor: number
  total_trades: number
  total_commission: number
  equity_curve: EquityPoint[]
  trades: Trade[]
  monthly_returns: MonthlyReturn[]
}

export interface EquityPoint {
  date: string
  equity: number
  drawdown: number
}

export interface Trade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  entry_time: string
  exit_time: string
  entry_price: number
  exit_price: number
  quantity: number
  pnl: number
  pnl_pct: number
  agent_id: number
  agent_name: string
}

export interface MonthlyReturn {
  month: string
  return_pct: number
}

// ========== 投资组合 ==========

export interface Portfolio {
  id: number
  name: string
  description: string
  initial_capital: number
  current_value: number
  total_pnl: number
  total_return_pct: number
  positions: Position[]
  performance: PortfolioPerformance
}

export interface Position {
  symbol: string
  quantity: number
  avg_entry_price: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  weight_pct: number
}

export interface PortfolioPerformance {
  total_return: number
  annualized_return: number
  sharpe_ratio: number
  max_drawdown: number
  volatility: number
  win_rate: number
  profit_factor: number
  total_trades: number
}

// ========== 通用 ==========

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color?: string
  }[]
}
