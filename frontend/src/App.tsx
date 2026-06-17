import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme as antTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAppStore } from '@/stores'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/dashboard'
import Strategies from '@/pages/strategy'
import Agents from '@/pages/agents'
import Backtest from '@/pages/backtest'
import Portfolio from '@/pages/portfolio'
import Settings from '@/pages/settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
})

const App: React.FC = () => {
  const themeMode = useAppStore((state) => state.theme)

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: themeMode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#2563eb',
            colorSuccess: '#16a34a',
            colorWarning: '#f59e0b',
            colorError: '#dc2626',
            borderRadius: 8,
            fontFamily: "Inter, 'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          },
          components: {
            Card: { headerFontSize: 15 },
            Layout: { bodyBg: themeMode === 'dark' ? '#020617' : '#eef2f7' },
            Menu: { itemBorderRadius: 8 },
          },
        }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="strategies" element={<Strategies />} />
              <Route path="agents" element={<Agents />} />
              <Route path="backtest" element={<Backtest />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App
