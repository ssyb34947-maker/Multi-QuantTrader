import React from 'react'
import { Button, Card, Col, Form, Input, InputNumber, Row, Select, Switch, Typography } from 'antd'
import { SaveOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const Settings: React.FC = () => (
  <div className="page-shell">
    <div className="page-header">
      <div>
        <Title level={3} className="page-title">系统设置</Title>
        <Text type="secondary">配置数据源、回测引擎、交易成本和系统级风控参数</Text>
      </div>
      <Button type="primary" icon={<SaveOutlined />}>保存配置</Button>
    </div>

    <Form layout="vertical" initialValues={{ dataSource: 'binance', slippage: 0.04, commission: 0.06, currency: 'USD', maxDrawdown: 10, maxDailyLoss: 3, enablePaper: true, enableRisk: true }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="section-card" title="数据与回测">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="默认数据源" name="dataSource"><Select options={[{ label: 'Binance', value: 'binance' }, { label: 'Yahoo Finance', value: 'yahoo' }, { label: '自定义 CSV', value: 'csv' }]} /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="账户币种" name="currency"><Select options={[{ label: 'USD', value: 'USD' }, { label: 'USDT', value: 'USDT' }, { label: 'CNY', value: 'CNY' }]} /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="滑点假设 (%)" name="slippage"><InputNumber min={0} max={5} step={0.01} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="手续费率 (%)" name="commission"><InputNumber min={0} max={5} step={0.01} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="FastAPI 地址" name="apiBase"><Input placeholder="http://localhost:8000/api" /></Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card className="section-card" title="全局风控">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="最大组合回撤 (%)" name="maxDrawdown"><InputNumber min={1} max={50} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="单日亏损熔断 (%)" name="maxDailyLoss"><InputNumber min={0.5} max={20} step={0.5} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="启用模拟交易" name="enablePaper" valuePropName="checked"><Switch /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="启用风险裁决席位" name="enableRisk" valuePropName="checked"><Switch /></Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="告警 Webhook" name="webhook"><Input placeholder="https://hooks.example.com/quant-alert" /></Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Form>
  </div>
)

export default Settings
