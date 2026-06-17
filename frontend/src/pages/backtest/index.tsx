import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Progress, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, ExperimentOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { backtestApi, strategyApi } from '@/api/endpoints'
import type { Backtest, BacktestStatus } from '@/types'

const { Title, Text, Paragraph } = Typography
const BACKTEST_DRAFT_KEY = 'duozhixing-backtest-draft-v1'

interface StrategyBacktestDraft {
  source: string
  name: string
  description: string
  code: string
  language: string
  tags: string[]
  symbols: string[]
  start_date: string
  end_date: string
  initial_capital: number
  slippage: number
  commission: number
  strategy_output?: {
    verdict: string
    entry: string
    stopLoss: string
    takeProfit: string
    holding: string
    risk: string
  }
}

const statusMap: Record<BacktestStatus, { color: string; text: string }> = {
  pending: { color: 'default', text: '排队中' },
  running: { color: 'processing', text: '运行中' },
  completed: { color: 'green', text: '已完成' },
  failed: { color: 'red', text: '失败' },
  cancelled: { color: 'default', text: '已取消' },
}

const columns = [
  { title: '任务名称', dataIndex: 'name', key: 'name', width: 260, render: (name: string) => <Text strong>{name}</Text> },
  {
    title: '策略',
    dataIndex: 'strategy_id',
    key: 'strategy_id',
    width: 190,
    render: (id: number) => `Strategy #${id}`, 
  },
  { title: '标的', dataIndex: 'symbols', key: 'symbols', width: 220, render: (symbols: string[]) => <Space wrap>{symbols.map((symbol) => <Tag key={symbol}>{symbol}</Tag>)}</Space> },
  { title: '区间', key: 'range', width: 230, render: (_: unknown, item: Backtest) => <Text className="mono">{item.start_date} / {item.end_date}</Text> },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (status: BacktestStatus) => <Tag color={statusMap[status]?.color ?? 'default'}>{statusMap[status]?.text ?? status}</Tag> },
  { title: '年化', key: 'annualized_return', width: 110, render: (_: unknown, item: Backtest) => item.result ? <Text strong style={{ color: '#16a34a' }}>{item.result.annualized_return}%</Text> : <Progress percent={62} size="small" /> },
  { title: '回撤', key: 'max_drawdown', width: 110, render: (_: unknown, item: Backtest) => item.result ? <Text strong style={{ color: '#dc2626' }}>{item.result.max_drawdown}%</Text> : '-' },
  { title: '胜率', key: 'win_rate', width: 100, render: (_: unknown, item: Backtest) => item.result ? <Text>{item.result.win_rate}%</Text> : '-' },
]

const readDraft = (): StrategyBacktestDraft | null => {
  try {
    const raw = window.localStorage.getItem(BACKTEST_DRAFT_KEY)
    return raw ? JSON.parse(raw) as StrategyBacktestDraft : null
  } catch {
    return null
  }
}

const Backtest: React.FC = () => {
  const [draft, setDraft] = useState<StrategyBacktestDraft | null>(() => readDraft())
  const [remoteBacktests, setRemoteBacktests] = useState<Backtest[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<Backtest | null>(null)

  useEffect(() => {
    backtestApi.list({ page: 1, page_size: 20 })
      .then((response) => setRemoteBacktests(response.data.items))
      .catch(() => setRemoteBacktests([]))
  }, [])

  const tableData = useMemo(() => remoteBacktests, [remoteBacktests])
  const completedCount = tableData.filter((item) => item.status === 'completed').length
  const runningCount = tableData.filter((item) => item.status === 'running').length
  const avgReturn = tableData.filter((item) => item.result).reduce((sum, item) => sum + (item.result?.total_return ?? 0), 0) / Math.max(1, tableData.filter((item) => item.result).length)

  const clearDraft = () => {
    window.localStorage.removeItem(BACKTEST_DRAFT_KEY)
    setDraft(null)
    setLastResult(null)
  }

  const submitDraftBacktest = async () => {
    if (!draft) return
    setSubmitting(true)
    try {
      const strategyResponse = await strategyApi.create({
        name: draft.name,
        description: draft.description,
        code: draft.code,
        language: 'python',
        tags: draft.tags,
      })
      const payload = {
        name: `${draft.name} · 回测实验`,
        strategy_id: strategyResponse.data.id,
        agents: [],
        symbols: draft.symbols,
        start_date: draft.start_date,
        end_date: draft.end_date,
        initial_capital: draft.initial_capital,
        slippage: draft.slippage,
        commission: draft.commission,
      }
      const created = await backtestApi.create(payload as Partial<Backtest>)
      const result = await backtestApi.run(created.data.id)
      setLastResult(result.data)
      setRemoteBacktests((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)])
      message.success('回测实验已完成')
    } catch (error) {
      console.error('Failed to run backtest draft', error)
      message.error('回测任务提交失败，请检查策略代码或回测服务状态')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-shell backtest-lab-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">回测实验</Title>
          <Text type="secondary">承接多智星基金输出策略，执行中证 2000 样本内回测、压力测试与入库前验证</Text>
        </div>
        <Space wrap>
          <Button icon={<ExperimentOutlined />}>参数扫描</Button>
          <Button type="primary" icon={<PlayCircleOutlined />}>新建回测</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card className="section-card"><Statistic title="实验任务" value={tableData.length} prefix={<ExperimentOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card className="section-card"><Statistic title="运行中" value={runningCount} prefix={<ThunderboltOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card className="section-card"><Statistic title="已完成" value={completedCount} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card className="section-card"><Statistic title="平均收益" value={Number(avgReturn.toFixed(2))} suffix="%" valueStyle={{ color: avgReturn >= 0 ? '#16a34a' : '#dc2626' }} /></Card></Col>
      </Row>

      {draft && (
        <Card className="section-card backtest-draft-card">
          <div className="backtest-draft-header">
            <div>
              <Text strong>{draft.name}</Text>
              <div><Text type="secondary">来源：{draft.source} · {draft.symbols.join(', ')} · {draft.start_date} / {draft.end_date}</Text></div>
            </div>
            <Space wrap>
              <Tag color="gold">待回测策略草案</Tag>
              <Button loading={submitting} type="primary" icon={<PlayCircleOutlined />} onClick={submitDraftBacktest}>创建并运行回测</Button>
              <Button onClick={clearDraft}>移除草案</Button>
            </Space>
          </div>
          <div className="backtest-draft-grid">
            <div><Text type="secondary">入场</Text><strong>{draft.strategy_output?.entry ?? draft.description}</strong></div>
            <div><Text type="secondary">止损</Text><strong>{draft.strategy_output?.stopLoss ?? '-'}</strong></div>
            <div><Text type="secondary">止盈</Text><strong>{draft.strategy_output?.takeProfit ?? '-'}</strong></div>
            <div><Text type="secondary">持有/退出</Text><strong>{draft.strategy_output?.holding ?? '-'}</strong></div>
            <div><Text type="secondary">风险约束</Text><strong>{draft.strategy_output?.risk ?? '-'}</strong></div>
            <div><Text type="secondary">资金与成本</Text><strong>{draft.initial_capital.toLocaleString()} · 滑点 {draft.slippage} · 佣金 {draft.commission}</strong></div>
          </div>
          {lastResult?.result && (
            <div className="backtest-result-strip">
              <Tag color="green">回测完成</Tag>
              <Text>总收益 {lastResult.result.total_return}%</Text>
              <Text>夏普 {lastResult.result.sharpe_ratio}</Text>
              <Text>最大回撤 {lastResult.result.max_drawdown}%</Text>
              <Text>胜率 {lastResult.result.win_rate}%</Text>
            </div>
          )}
          <Paragraph className="backtest-code-preview"><pre>{draft.code}</pre></Paragraph>
        </Card>
      )}

      <Card className="section-card" title="实验任务队列">
        <Table
          dataSource={tableData}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="暂无真实回测任务" /> }}
        />
      </Card>
    </div>
  )
}

export default Backtest
