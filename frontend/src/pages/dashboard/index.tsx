import React, { useMemo } from 'react'
import { Button, Card, Col, Divider, Progress, Row, Space, Table, Tag, Typography } from 'antd'
import ReactECharts from 'echarts-for-react'
import {
  CloudServerOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import BarTrend from '@/components/charts/BarTrend'
import DonutChart from '@/components/charts/DonutChart'
import EquityCurve from '@/components/charts/EquityCurve'
import StatCard from '@/components/common/StatCard'
import {
  agentWorkflow,
  contextInjectionPlan,
  csi2000DataPool,
  drawdownData,
  equityCurveData,
  recentTrades,
  riskLimits,
  strategySkillRegistry,
} from '@/utils/mockData'
import { useAppStore } from '@/stores'
import type { Trade } from '@/types'

const { Title, Text } = Typography

const tradeColumns = [
  { title: '标的', dataIndex: 'symbol', key: 'symbol', width: 150 },
  {
    title: '方向',
    dataIndex: 'side',
    key: 'side',
    width: 80,
    render: (side: Trade['side']) => <Tag color={side === 'buy' ? 'green' : 'red'}>{side === 'buy' ? '买入' : '卖出'}</Tag>,
  },
  { title: '入场', dataIndex: 'entry_time', key: 'entry_time', width: 150 },
  { title: '出场', dataIndex: 'exit_time', key: 'exit_time', width: 150 },
  {
    title: '盈亏',
    dataIndex: 'pnl',
    key: 'pnl',
    width: 120,
    render: (value: number) => <Text strong style={{ color: value >= 0 ? '#16a34a' : '#dc2626' }}>{value >= 0 ? '+' : ''}¥{value.toLocaleString()}</Text>,
  },
  {
    title: '收益率',
    dataIndex: 'pnl_pct',
    key: 'pnl_pct',
    width: 100,
    render: (value: number) => <Tag color={value >= 0 ? 'green' : 'red'}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</Tag>,
  },
  { title: '基金席位', dataIndex: 'agent_name', key: 'agent_name', width: 150 },
]

const dataFileColumns = [
  { title: '数据资产', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 110, render: (value: string) => <Tag>{value}</Tag> },
  { title: '规模', dataIndex: 'rows', key: 'rows', width: 100, render: (value: string) => <Text className="mono">{value}</Text> },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: () => <Tag color="green">Ready</Tag> },
]

const monthlyReturns = [
  { label: '1月', value: 1.8 },
  { label: '2月', value: 2.4 },
  { label: '3月', value: 3.1 },
  { label: '4月', value: -1.2 },
  { label: '5月', value: 4.6 },
]

const dataComposition = [
  { name: '日线前复权', value: 189811 },
  { name: '基本面', value: 5874 },
  { name: '个股信息', value: 1371 },
  { name: '指数代理', value: 95 },
]


const marketDates = Array.from({ length: 48 }, (_, index) => {
  const month = index < 20 ? 3 : index < 40 ? 4 : 5
  const day = (index % 20) + 1
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
})

const indexKlineData = marketDates.map((date, index) => {
  const base = 1000 + index * 3.2 + Math.sin(index * 0.45) * 24
  const open = Number((base + Math.sin(index) * 8).toFixed(2))
  const close = Number((base + Math.cos(index * 0.8) * 10).toFixed(2))
  const low = Number((Math.min(open, close) - 8 - Math.abs(Math.sin(index * 0.7) * 6)).toFixed(2))
  const high = Number((Math.max(open, close) + 8 + Math.abs(Math.cos(index * 0.5) * 6)).toFixed(2))
  const volume = Math.round(180000 + Math.abs(Math.sin(index * 0.33)) * 90000 + index * 1100)
  return { date, values: [open, close, low, high], volume }
})

const movingAverage = (dayCount: number) => indexKlineData.map((_, index) => {
  if (index < dayCount - 1) return '-'
  const window = indexKlineData.slice(index - dayCount + 1, index + 1)
  const average = window.reduce((sum, item) => sum + item.values[1], 0) / dayCount
  return Number(average.toFixed(2))
})

const Csi2000MarketChart: React.FC = () => {
  const isDark = useAppStore((state) => state.theme) === 'dark'
  const option = useMemo(() => {
    const axisColor = isDark ? '#94a3b8' : '#64748b'
    const splitColor = isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)'
    const macd = indexKlineData.map((item, index) => Number(((item.values[1] - item.values[0]) * 8 + Math.sin(index * 0.4) * 6).toFixed(2)))
    const rsi = indexKlineData.map((_, index) => Number((52 + Math.sin(index * 0.33) * 18).toFixed(2)))

    return {
      animation: false,
      legend: {
        top: 2,
        data: ['K线', 'MA5', 'MA20', '成交量', 'MACD', 'RSI'],
        textStyle: { color: axisColor },
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [
        { left: 54, right: 24, top: 38, height: 220 },
        { left: 54, right: 24, top: 292, height: 72 },
        { left: 54, right: 24, top: 398, height: 66 },
      ],
      xAxis: [
        { type: 'category', data: marketDates, scale: true, boundaryGap: false, axisLine: { lineStyle: { color: axisColor } }, axisLabel: { color: axisColor }, splitLine: { show: false } },
        { type: 'category', gridIndex: 1, data: marketDates, scale: true, boundaryGap: false, axisLine: { lineStyle: { color: axisColor } }, axisLabel: { show: false }, splitLine: { show: false } },
        { type: 'category', gridIndex: 2, data: marketDates, scale: true, boundaryGap: false, axisLine: { lineStyle: { color: axisColor } }, axisLabel: { color: axisColor }, splitLine: { show: false } },
      ],
      yAxis: [
        { scale: true, axisLabel: { color: axisColor }, splitLine: { lineStyle: { color: splitColor } } },
        { scale: true, gridIndex: 1, axisLabel: { color: axisColor }, splitLine: { lineStyle: { color: splitColor } } },
        { scale: true, gridIndex: 2, axisLabel: { color: axisColor }, splitLine: { lineStyle: { color: splitColor } } },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1, 2], start: 35, end: 100 },
        { show: true, xAxisIndex: [0, 1, 2], type: 'slider', bottom: 0, height: 20, start: 35, end: 100, borderColor: 'transparent', textStyle: { color: axisColor } },
      ],
      series: [
        { name: 'K线', type: 'candlestick', data: indexKlineData.map((item) => item.values), itemStyle: { color: '#dc2626', color0: '#16a34a', borderColor: '#dc2626', borderColor0: '#16a34a' } },
        { name: 'MA5', type: 'line', data: movingAverage(5), smooth: true, symbol: 'none', lineStyle: { width: 1.4, color: '#2563eb' } },
        { name: 'MA20', type: 'line', data: movingAverage(20), smooth: true, symbol: 'none', lineStyle: { width: 1.4, color: '#f59e0b' } },
        { name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: indexKlineData.map((item) => item.volume), itemStyle: { color: '#64748b' } },
        { name: 'MACD', type: 'bar', xAxisIndex: 2, yAxisIndex: 2, data: macd, itemStyle: { color: (params: { value: number }) => params.value >= 0 ? '#dc2626' : '#16a34a' } },
        { name: 'RSI', type: 'line', xAxisIndex: 2, yAxisIndex: 2, data: rsi, symbol: 'none', lineStyle: { color: '#7c3aed', width: 1.2 } },
      ],
    }
  }, [isDark])

  return <ReactECharts option={option} style={{ height: 500 }} notMerge />
}

const Dashboard: React.FC = () => (
  <div className="page-shell">
    <div className="page-header">
      <div>
        <Title level={3} className="page-title">中证 2000 数据池总览</Title>
        <Text type="secondary">当前平台仅支持 data/processed 下的中证 2000 数据，多智星基金上下文、回测与策略 Skill 均受此边界约束。</Text>
      </div>
      <Space wrap>
        <Button icon={<ExperimentOutlined />}>新建中证 2000 回测</Button>
        <Button type="primary" icon={<PlayCircleOutlined />}>启动编排</Button>
      </Space>
    </div>

    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} xl={6}>
        <StatCard title="成分股覆盖" value={csi2000DataPool.constituents} precision={0} prefix={<DatabaseOutlined />} suffix="只" helper="中证 2000" color="#2563eb" />
      </Col>
      <Col xs={24} sm={12} xl={6}>
        <StatCard title="日线样本" value={csi2000DataPool.dailyRows} precision={0} prefix={<CloudServerOutlined />} suffix="行" helper={csi2000DataPool.dateRange} color="#16a34a" />
      </Col>
      <Col xs={24} sm={12} xl={6}>
        <StatCard title="策略 Skills" value={strategySkillRegistry.length} precision={0} prefix={<RobotOutlined />} suffix="个" helper="可被基金席位调用" color="#7c3aed" />
      </Col>
      <Col xs={24} sm={12} xl={6}>
        <StatCard title="下载失败" value={csi2000DataPool.dailyFailed} precision={0} prefix={<SafetyCertificateOutlined />} suffix="只" helper="日线采集" color="#f59e0b" />
      </Col>
    </Row>


    <Row gutter={[16, 16]}>
      <Col xs={24} xl={17}>
        <Card className="section-card" title="中证两千指数大盘" extra={<Space><Tag color="blue">K线</Tag><Tag>MA / Volume / MACD / RSI</Tag></Space>}>
          <Csi2000MarketChart />
        </Card>
      </Col>
      <Col xs={24} xl={7}>
        <Card className="section-card" title="系统运行统计" extra={<Tag color="green">运行中</Tag>}>
          <div className="system-runtime-grid">
            <div><Text type="secondary">模拟任务</Text><Text strong>12</Text></div>
            <div><Text type="secondary">通过回测</Text><Text strong>7</Text></div>
            <div><Text type="secondary">待用户授权</Text><Text strong>2</Text></div>
            <div><Text type="secondary">策略 Skill</Text><Text strong>{strategySkillRegistry.length}</Text></div>
            <div><Text type="secondary">多智星基金关系</Text><Text strong>10</Text></div>
            <div><Text type="secondary">MCP Tool</Text><Text strong>8</Text></div>
          </div>
          <Divider />
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div className="system-runtime-row"><Text type="secondary">数据边界</Text><Tag color="purple">{csi2000DataPool.indexCode}</Tag></div>
            <div className="system-runtime-row"><Text type="secondary">最新交易日</Text><Text className="mono">{csi2000DataPool.lastTradeDate}</Text></div>
            <div className="system-runtime-row"><Text type="secondary">后端行情图</Text><Tag color="gold">待接入</Tag></div>
          </Space>
        </Card>
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Card className="section-card" title="中证 2000 代理权益曲线" extra={<Tag color="blue">932000 proxy</Tag>}>
          <EquityCurve data={equityCurveData} height={342} />
        </Card>
      </Col>
      <Col xs={24} xl={9}>
        <Card className="section-card" title="数据池健康度">
          <div className="metric-grid">
            <div className="metric-tile"><span className="metric-label">日线成功</span><span className="metric-value">{csi2000DataPool.dailySuccess}</span></div>
            <div className="metric-tile"><span className="metric-label">缺失率</span><span className="metric-value">{csi2000DataPool.missingRatio}%</span></div>
            <div className="metric-tile"><span className="metric-label">基本面</span><span className="metric-value">{csi2000DataPool.fundamentalRows}</span></div>
            <div className="metric-tile"><span className="metric-label">最新交易日</span><span className="metric-value metric-value-small">{csi2000DataPool.lastTradeDate}</span></div>
          </div>
          <div style={{ marginTop: 18 }}>
            <EquityCurve data={drawdownData} height={154} color="#dc2626" valuePrefix="" />
          </div>
        </Card>
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col xs={24} xl={14}>
        <Card className="section-card" title="数据资产清单" extra={<Tag color="green">{csi2000DataPool.rootPath}</Tag>}>
          <Table dataSource={csi2000DataPool.files} columns={dataFileColumns} pagination={false} rowKey="name" size="small" />
        </Card>
      </Col>
      <Col xs={24} xl={10}>
        <Card className="section-card" title="上下文工程注入">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {contextInjectionPlan.map((item) => (
              <div className="context-injection-row" key={item.agent}>
                <div>
                  <Text strong>{item.agent}</Text>
                  <div><Text type="secondary">{item.context}</Text></div>
                  <Space wrap size={[4, 4]}>{item.payload.map((payload) => <Tag key={payload}>{payload}</Tag>)}</Space>
                </div>
                <Tag color={item.status === '已注入' ? 'green' : 'gold'}>{item.status}</Tag>
              </div>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <Card className="section-card" title="数据构成">
          <DonutChart data={dataComposition} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card className="section-card" title="月度模拟收益">
          <BarTrend data={monthlyReturns} color="#16a34a" />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card className="section-card" title="风险预算">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {riskLimits.map((item) => (
              <div className="risk-row" key={item.name}>
                <Text>{item.name}</Text>
                <Progress percent={item.current} showInfo={false} strokeColor={item.current > item.limit * 0.8 ? '#f59e0b' : '#2563eb'} />
                <Text className="mono">{item.current}%</Text>
              </div>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col xs={24} xl={9}>
        <Card className="section-card" title="多智星基金数据流">
          {agentWorkflow.map((item) => (
            <div className="workflow-item" key={item.title}>
              <Space align="start">
                <span className={`agent-status-dot ${item.status === '运行中' ? 'running' : ''}`} />
                <div>
                  <Text strong>{item.title}</Text>
                  <div><Text type="secondary">{item.agent} · {item.status}</Text></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.detail}</Text>
                </div>
              </Space>
            </div>
          ))}
        </Card>
      </Col>
      <Col xs={24} xl={15}>
        <Card className="section-card" title="最近中证 2000 模拟交易" extra={<Tag color="purple">Strategy Skill 输出</Tag>}>
          <Table dataSource={recentTrades} columns={tradeColumns} pagination={false} rowKey="id" size="small" scroll={{ x: 920 }} />
        </Card>
      </Col>
    </Row>
  </div>
)

export default Dashboard
