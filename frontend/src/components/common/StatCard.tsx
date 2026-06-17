import React from 'react'
import { Card, Statistic, Typography } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

const { Text } = Typography

interface StatCardProps {
  title: string
  value: number | string
  precision?: number
  prefix?: React.ReactNode
  suffix?: string
  change?: number
  changePct?: number
  loading?: boolean
  color?: string
  helper?: string
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  precision = 2,
  prefix,
  suffix,
  change,
  changePct,
  loading,
  color,
  helper = '较昨日',
}) => {
  const isUp = (change ?? 0) >= 0

  return (
    <Card className="stat-card" hoverable loading={loading}>
      <Text className="stat-card-title">{title}</Text>
      <div style={{ marginTop: 8 }}>
        <Statistic
          value={value}
          precision={precision}
          prefix={prefix}
          suffix={suffix}
          valueStyle={{ fontSize: 28, fontWeight: 700, color }}
        />
      </div>
      {(change !== undefined || changePct !== undefined) && (
        <div className="stat-card-delta">
          <Text
            style={{
              color: isUp ? '#16a34a' : '#dc2626',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {change !== undefined && ` ${Math.abs(change).toFixed(2)}`}
            {changePct !== undefined && ` (${Math.abs(changePct).toFixed(2)}%)`}
          </Text>
          <Text className="stat-card-helper">{helper}</Text>
        </div>
      )}
    </Card>
  )
}

export default StatCard
