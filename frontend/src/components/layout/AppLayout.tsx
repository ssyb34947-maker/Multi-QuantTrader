import React, { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Dropdown, Layout, Menu, Space, Switch, Tooltip, Typography, theme } from 'antd'
import {
  BellOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FundOutlined,
  GithubOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PieChartOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAppStore } from '@/stores'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = Layout
const { Text } = Typography

type MenuItem = Required<MenuProps>['items'][number]

const GITHUB_REPO_URL = 'https://github.com/ssyb34947-maker/Multi-QuantTrader'

const menuItems: MenuItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: '总览' },
  { key: '/strategies', icon: <FundOutlined />, label: '策略库' },
  { key: '/agents', icon: <RobotOutlined />, label: '多智星基金' },
  { key: '/backtest', icon: <ExperimentOutlined />, label: '回测实验' },
  { key: '/portfolio', icon: <PieChartOutlined />, label: '组合风控' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
]

const userMenuItems: MenuProps['items'] = [
  { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
  { key: 'repo', icon: <GithubOutlined />, label: '项目仓库' },
  { type: 'divider' },
  { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
]

const AppLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const { theme: themeMode, sidebarCollapsed, toggleSidebar, setTheme } = useAppStore()
  const [notiCount] = useState(3)

  const selectedKey = useMemo(() => {
    const firstPath = `/${location.pathname.split('/')[1]}`
    return firstPath === '//' ? '/' : firstPath
  }, [location.pathname])

  const isDark = themeMode === 'dark'

  return (
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={240}
        theme={isDark ? 'dark' : 'light'}
        style={{ background: token.colorBgContainer }}
      >
        <div className="app-logo">
          <div className="app-logo-mark"><RobotOutlined /></div>
          {!sidebarCollapsed && (
            <div className="app-logo-text">
              <Text strong style={{ display: 'block', fontSize: 16 }}>多智星</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>DuoZhiXing Fund</Text>
            </div>
          )}
        </div>

        <Menu
          className="app-nav-menu"
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none', padding: '12px 8px' }}
        />

        <div className="app-sider-footer">
          <Tooltip title={sidebarCollapsed ? 'GitHub 仓库' : undefined} placement="right">
            <Button
              block={!sidebarCollapsed}
              type="text"
              className="app-github-link"
              aria-label="打开 GitHub 仓库"
              icon={<GithubOutlined />}
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              {!sidebarCollapsed && 'GitHub 仓库'}
            </Button>
          </Tooltip>
        </div>
      </Sider>

      <Layout>
        <Header className="app-header" style={{ background: token.colorBgContainer }}>
          <Space size="middle">
            <Button
              type="text"
              aria-label="切换侧边栏"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
            />
            <div>
              <Text strong>多智星基金量化投研平台</Text>
              <Text type="secondary" style={{ marginLeft: 10, fontSize: 12 }}>数据、投研、回测、风控一体化</Text>
            </div>
          </Space>

          <Space size="middle">
            <Switch
              checked={isDark}
              checkedChildren="暗"
              unCheckedChildren="亮"
              onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
            <Badge count={notiCount} size="small">
              <Button type="text" aria-label="通知" icon={<BellOutlined />} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space>
                <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: token.colorPrimary }} />
                <Text>Admin</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content className="app-content" style={{ background: token.colorBgLayout }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
