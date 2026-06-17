import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAppStore } from '@/stores'

interface DonutChartProps {
  data: { name: string; value: number }[]
  height?: number
}

const DonutChart: React.FC<DonutChartProps> = ({ data, height = 260 }) => {
  const isDark = useAppStore((state) => state.theme) === 'dark'

  const option = useMemo(
    () => ({
      color: ['#16a34a', '#2563eb', '#f59e0b', '#8b5cf6', '#64748b'],
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {d}%',
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        textStyle: { color: isDark ? '#cbd5e1' : '#475569' },
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '72%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          label: {
            formatter: '{d}%',
            color: isDark ? '#e2e8f0' : '#0f172a',
          },
          labelLine: { length: 8, length2: 8 },
          data,
        },
      ],
    }),
    [data, isDark],
  )

  return <ReactECharts option={option} style={{ height }} notMerge />
}

export default DonutChart
