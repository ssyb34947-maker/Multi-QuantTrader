import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAppStore } from '@/stores'

interface BarTrendProps {
  data: { label: string; value: number }[]
  height?: number
  color?: string
}

const BarTrend: React.FC<BarTrendProps> = ({ data, height = 260, color = '#2563eb' }) => {
  const isDark = useAppStore((state) => state.theme) === 'dark'

  const option = useMemo(
    () => ({
      grid: { left: 42, right: 16, top: 18, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.label),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: isDark ? '#94a3b8' : '#64748b' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)' } },
        axisLabel: { color: isDark ? '#94a3b8' : '#64748b' },
      },
      series: [
        {
          type: 'bar',
          data: data.map((item) => item.value),
          barWidth: 18,
          itemStyle: {
            color,
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }),
    [color, data, isDark],
  )

  return <ReactECharts option={option} style={{ height }} notMerge />
}

export default BarTrend
