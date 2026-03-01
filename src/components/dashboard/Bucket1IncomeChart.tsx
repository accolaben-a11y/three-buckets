'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { IncomeSourceMeta } from '@/lib/calculations'

interface Props {
  incomeByAgePerSource: {
    byAge: Record<number, Record<string, number>>
    sources: IncomeSourceMeta[]
  }
  retirementAge: number
  planningHorizonAge: number
}

// Green palette for stacking bars
const COLORS = [
  '#16a34a', '#4ade80', '#86efac', '#a3e635', '#65a30d',
  '#22c55e', '#15803d', '#bbf7d0', '#166534', '#dcfce7',
]

function formatMo(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k/mo`
  return `$${value}/mo`
}

export default function Bucket1IncomeChart({ incomeByAgePerSource, retirementAge, planningHorizonAge }: Props) {
  const { byAge, sources } = incomeByAgePerSource

  if (sources.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic py-2">No income sources configured.</div>
    )
  }

  const chartData = []
  for (let age = retirementAge; age <= planningHorizonAge; age++) {
    const ageMap = byAge[age] ?? {}
    const entry: Record<string, number | string> = { age }
    for (const src of sources) {
      // Convert cents to dollars/month
      entry[src.id] = Math.round((ageMap[src.id] ?? 0) / 100)
    }
    chartData.push(entry)
  }

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <XAxis
            dataKey="age"
            tick={{ fontSize: 10, fill: '#64748b' }}
            label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 10 }}
          />
          <YAxis
            tickFormatter={formatMo}
            tick={{ fontSize: 10, fill: '#64748b' }}
            width={68}
          />
          <Tooltip
            formatter={(value: number | undefined, name: string | undefined) => {
              const src = sources.find(s => s.id === name)
              return [value !== undefined ? `$${value.toLocaleString()}/mo` : '—', src?.label ?? name ?? '']
            }}
            labelFormatter={(label) => `Age ${label}`}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Legend
            formatter={(value) => {
              const src = sources.find(s => s.id === value)
              return src?.label ?? value
            }}
            wrapperStyle={{ fontSize: 10 }}
          />
          {sources.map((src, i) => (
            <Bar
              key={src.id}
              dataKey={src.id}
              stackId="income"
              fill={COLORS[i % COLORS.length]}
              name={src.id}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
