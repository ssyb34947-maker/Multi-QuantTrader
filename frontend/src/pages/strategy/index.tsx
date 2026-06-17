import React from 'react'
import { Button, Card, Col, Row, Space, Steps, Tag, Typography } from 'antd'
import {
  ApiOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  ExperimentOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { strategySkillLifecycle, strategySkillRegistry } from '@/utils/mockData'

const { Title, Text, Paragraph } = Typography

const statusMap = {
  active: { color: 'green', text: '已注入' },
  draft: { color: 'gold', text: '待验证' },
  archived: { color: 'default', text: '已归档' },
}

const lifecycleIcon = (status: string) => {
  if (status === '强制') return <ExperimentOutlined />
  if (status === '人工') return <SafetyCertificateOutlined />
  if (status === '可复用') return <RobotOutlined />
  return <CodeOutlined />
}

const Strategies: React.FC = () => (
  <div className="page-shell strategy-skill-page">
    <div className="page-header">
      <div>
        <Title level={3} className="page-title">策略 Skill 库</Title>
        <Text type="secondary">策略库定位为 Skill Registry。每次模拟生成的量化策略，必须先通过中证 2000 回测，并在用户允许后才能注入为可调用 Skill。</Text>
      </div>
      <Space wrap>
        <Button icon={<ApiOutlined />}>导入 Strategy Skill</Button>
        <Button type="primary" icon={<PlusOutlined />}>新建候选策略</Button>
      </Space>
    </div>

    <Card className="section-card" title="策略注入生命周期" extra={<Tag color="blue">用户授权是强制闸门</Tag>}>
      <Steps
        items={strategySkillLifecycle.map((item) => ({
          title: item.step,
          description: item.detail,
          icon: lifecycleIcon(item.status),
          status: item.status === '人工' ? 'process' : 'finish',
        }))}
      />
    </Card>

    <Row gutter={[16, 16]}>
      {strategySkillRegistry.map((strategy) => (
        <Col xs={24} md={12} xl={6} key={strategy.id}>
          <Card
            className="strategy-card strategy-skill-card"
            title={strategy.skillName}
            extra={<Tag color={statusMap[strategy.status].color}>{statusMap[strategy.status].text}</Tag>}
            actions={[
              <Button type="link" icon={<ThunderboltOutlined />} key="backtest">中证2000回测</Button>,
              <Button type="link" icon={<CodeOutlined />} key="edit">查看 Skill</Button>,
            ]}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>{strategy.name}</Text>
                <Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ marginTop: 8, marginBottom: 0 }}>{strategy.description}</Paragraph>
              </div>
              <Space wrap>
                {strategy.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
              </Space>
              <div className="strategy-skill-meta">
                <div><Text type="secondary">来源</Text><Text strong>{strategy.source}</Text></div>
                <div><Text type="secondary">授权</Text><Text strong>{strategy.permission}</Text></div>
              </div>
              <div>
                <Text type="secondary">可调用基金席位</Text>
                <Space wrap size={[4, 4]} style={{ marginTop: 8 }}>
                  {strategy.callableByAgents.map((agent) => <Tag color="blue" key={agent}>{agent}</Tag>)}
                </Space>
              </div>
              <div className="strategy-skill-ready">
                <CheckCircleOutlined />
                <Text type="secondary">只允许在中证 2000 数据池上下文中调用</Text>
              </div>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  </div>
)

export default Strategies
