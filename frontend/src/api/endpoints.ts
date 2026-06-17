import client from './client'
import type {
  ApiResponse,
  Strategy,
  Backtest,
  Agent,
  Portfolio,
  PaginatedResponse,
} from '@/types'

// ========== 策略 API ==========

export const strategyApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<any, ApiResponse<PaginatedResponse<Strategy>>>('/strategies', { params }),

  get: (id: number) =>
    client.get<any, ApiResponse<Strategy>>(`/strategies/${id}`),

  create: (data: Partial<Strategy>) =>
    client.post<any, ApiResponse<Strategy>>('/strategies', data),

  update: (id: number, data: Partial<Strategy>) =>
    client.put<any, ApiResponse<Strategy>>(`/strategies/${id}`, data),

  delete: (id: number) =>
    client.delete<any, ApiResponse<void>>(`/strategies/${id}`),
}

// ========== 回测 API ==========

export const backtestApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<any, ApiResponse<PaginatedResponse<Backtest>>>('/backtests', { params }),

  get: (id: number) =>
    client.get<any, ApiResponse<Backtest>>(`/backtests/${id}`),

  create: (data: Partial<Backtest>) =>
    client.post<any, ApiResponse<Backtest>>('/backtests', data),

  run: (id: number) =>
    client.post<any, ApiResponse<Backtest>>(`/backtests/${id}/run`),

  cancel: (id: number) =>
    client.post<any, ApiResponse<void>>(`/backtests/${id}/cancel`),

  delete: (id: number) =>
    client.delete<any, ApiResponse<void>>(`/backtests/${id}`),
}

// ========== 智能体 API ==========

export const agentApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<any, ApiResponse<PaginatedResponse<Agent>>>('/agents', { params }),

  get: (id: number) =>
    client.get<any, ApiResponse<Agent>>(`/agents/${id}`),

  create: (data: Partial<Agent>) =>
    client.post<any, ApiResponse<Agent>>('/agents', data),

  update: (id: number, data: Partial<Agent>) =>
    client.put<any, ApiResponse<Agent>>(`/agents/${id}`, data),

  delete: (id: number) =>
    client.delete<any, ApiResponse<void>>(`/agents/${id}`),

  start: (id: number) =>
    client.post<any, ApiResponse<void>>(`/agents/${id}/start`),

  stop: (id: number) =>
    client.post<any, ApiResponse<void>>(`/agents/${id}/stop`),
}

// ========== 投资组合 API ==========

export const portfolioApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<any, ApiResponse<PaginatedResponse<Portfolio>>>('/portfolios', { params }),

  get: (id: number) =>
    client.get<any, ApiResponse<Portfolio>>(`/portfolios/${id}`),

  create: (data: Partial<Portfolio>) =>
    client.post<any, ApiResponse<Portfolio>>('/portfolios', data),
}

// ========== 仪表盘 API ==========

export const dashboardApi = {
  summary: () =>
    client.get<any, ApiResponse<DashboardSummary>>('/dashboard/summary'),
}


// ========== 数据 API ==========

export interface StockOption {
  stock_code: string
  stock_name: string
}

export const dataApi = {
  listAllStocks: () =>
    client.get<any, ApiResponse<StockOption[]>>('/data/stocks/all'),
}

// ========== 类型 ==========

export interface DashboardSummary {
  total_strategies: number
  active_strategies: number
  total_backtests: number
  running_backtests: number
  total_agents: number
  active_agents: number
  portfolio_value: number
  total_pnl: number
  daily_pnl: number
  equity_curve: { date: string; value: number }[]
  recent_trades: number
  win_rate: number
}
