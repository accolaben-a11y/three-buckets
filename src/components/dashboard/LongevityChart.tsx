'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import type { YearlySnapshot } from '@/lib/calculations'

interface Props {
  data: YearlySnapshot[]
  retirementAge: number
  depletionAges: {
    bucket2DepletionAge: number | null
    bucket3DepletionAge: number | null
  }
}

function formatM(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

function centsToDisplay(cents: number) {
  return cents / 100
}

export default function LongevityChart({ data, retirementAge, depletionAges }: Props) {
  const chartData = data.map(d => ({
    age: d.age,
    'Nest Egg Balance': centsToDisplay(d.bucket2BalanceCents),
    'LOC Balance': d.bucket3BalanceCents > 0 ? centsToDisplay(d.bucket3BalanceCents) : undefined,
    'Target Income': centsToDisplay(d.targetIncomeCents),
    'Bucket 1 Income': centsToDisplay(d.bucket1IncomeCents),
  }))

  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 11, fill: '#64748b' }}
            label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
          />
          <YAxis
            tickFormatter={formatM}
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={60}
          />
          <Tooltip
            formatter={(value: number | undefined, name: string | undefined) => [
              value !== undefined
                ? ((name ?? '').includes('Income') ? `$${(value / 12).toFixed(0)}/mo` : `$${value.toLocaleString()}`)
                : '—',
              name ?? ''
            ]}
            labelFormatter={(label) => `Age ${label}`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {/* Nest Egg balance */}
          <Line
            type="monotone"
            dataKey="Nest Egg Balance"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            name="Nest Egg Balance"
          />

          {/* LOC balance */}
          <Line
            type="monotone"
            dataKey="LOC Balance"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            name="LOC Balance"
            strokeDasharray="5 5"
          />

          {/* Bucket 1 Income */}
          <Line
            type="monotone"
            dataKey="Bucket 1 Income"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            name="Bucket 1 Income (annual)"
          />

          {/* Depletion reference lines */}
          {depletionAges.bucket2DepletionAge && (
            <ReferenceLine
              x={depletionAges.bucket2DepletionAge}
              stroke="#2563eb"
              strokeDasharray="4 4"
              label={{ value: `B2 depletes`, position: 'top', fontSize: 10, fill: '#2563eb' }}
            />
          )}
          {depletionAges.bucket3DepletionAge && (
            <ReferenceLine
              x={depletionAges.bucket3DepletionAge}
              stroke="#dc2626"
              strokeDasharray="4 4"
              label={{ value: `B3 depletes`, position: 'top', fontSize: 10, fill: '#dc2626' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
