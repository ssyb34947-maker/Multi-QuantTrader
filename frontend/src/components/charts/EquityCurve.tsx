import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAppStore } from '@/stores'

interface EquityCurveProps {
  data: { date: string; value: number }[]
  height?: number
  color?: string
  valuePrefix?: string
}

const EquityCurve: React.FC<EquityCurveProps> = ({
  data,
  height = 320,
  color = '#2563eb',
  valuePrefix = '$',
}) => {
  const isDark = useAppStore((state) => state.theme) === 'dark'

  const option = useMemo(
    () => ({
      color: [color],
      grid: { left: 60, right: 20, top: 30, bottom: 30 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number) => `${valuePrefix}${value.toFixed(2)}`,
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.date),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: { color: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)' },
        },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          formatter: (value: number) => `${valuePrefix}${value.toFixed(0)}`,
        },
      },
      series: [
        {
          type: 'line',
          data: data.map((item) => item.value),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${color}44` },
                { offset: 1, color: `${color}05` },
              ],
            },
          },
        },
      ],
    }),
    [color, data, isDark, valuePrefix],
  )

  return <ReactECharts option={option} style={{ height }} notMerge />
}

export default EquityCurve
