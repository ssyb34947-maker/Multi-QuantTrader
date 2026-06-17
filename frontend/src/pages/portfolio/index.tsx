import React from 'react'
import { Card, Col, Progress, Row, Space, Table, Tag, Typography } from 'antd'
import { SafetyCertificateOutlined } from '@ant-design/icons'
import DonutChart from '@/components/charts/DonutChart'
import EquityCurve from '@/components/charts/EquityCurve'
import StatCard from '@/components/common/StatCard'
import { equityCurveData, portfolio, riskLimits } from '@/utils/mockData'
import type { Position } from '@/types'

const { Title, Text } = Typography

const columns = [
  { title: '资产', dataIndex: 'symbol', key: 'symbol', render: (value: string) => <Text strong>{value}</Text> },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', render: (value: number) => <Text className="mono">{value.toLocaleString()}</Text> },
  { title: '现价', dataIndex: 'current_price', key: 'current_price', render: (value: number) => `$${value.toLocaleString()}` },
  { title: '市值', dataIndex: 'market_value', key: 'market_value', render: (value: number) => `$${Math.round(value).toLocaleString()}` },
  { title: '浮动盈亏', dataIndex: 'unrealized_pnl', key: 'unrealized_pnl', render: (value: number, item: Position) => <Text strong style={{ color: value >= 0 ? '#16a34a' : '#dc2626' }}>{value >= 0 ? '+' : ''}${value.toLocaleString()} ({item.unrealized_pnl_pct.toFixed(2)}%)</Text> },
  { title: '权重', dataIndex: 'weight_pct', key: 'weight_pct', render: (value: number) => <Tag color="blue">{value.toFixed(1)}%</Tag> },
]

const Portfolio: React.FC = () => (
  <div className="page-shell">
    <div className="page-header">
      <div>
        <Title level={3} className="page-title">组合风控</Title>
        <Text type="secondary">统一管理资金、持仓、风险预算和组合绩效</Text>
      </div>
      <Tag icon={<SafetyCertificateOutlined />} color="green">风险状态正常</Tag>
    </div>

    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} xl={6}><StatCard title="当前市值" value={portfolio.current_value} precision={0} suffix="USD" color="#2563eb" /></Col>
      <Col xs={24} sm={12} xl={6}><StatCard title="总收益率" value={portfolio.total_return_pct} precision={2} suffix="%" color="#16a34a" /></Col>
      <Col xs={24} sm={12} xl={6}><StatCard title="波动率" value={portfolio.performance.volatility} precision={2} suffix="%" color="#8b5cf6" /></Col>
      <Col xs={24} sm={12} xl={6}><StatCard title="交易次数" value={portfolio.performance.total_trades} precision={0} color="#f59e0b" /></Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Card className="section-card" title="组合净值"><EquityCurve data={equityCurveData} height={330} /></Card>
      </Col>
      <Col xs={24} xl={9}>
        <Card className="section-card" title="持仓权重"><DonutChart data={portfolio.positions.map((item) => ({ name: item.symbol, value: item.weight_pct }))} height={330} /></Card>
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Card className="section-card" title="当前持仓">
          <Table dataSource={portfolio.positions} columns={columns} rowKey="symbol" pagination={false} scroll={{ x: 900 }} />
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="section-card" title="风控阈值">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {riskLimits.map((item) => (
              <div key={item.name}>
                <div className="risk-row"><Text>{item.name}</Text><Progress percent={item.current} showInfo={false} /><Text>{item.current}%</Text></div>
                <Text type="secondary" style={{ fontSize: 12 }}>上限 {item.limit}%</Text>
              </div>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
  </div>
)

export default Portfolio
