'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import type { IncomeSourceMeta } from '@/lib/calculations'

interface Props {
  incomeByAgePerSource: {
    byAge: Record<number, Record<string, number>>
    sources: IncomeSourceMeta[]
  }
  bucket2DrawsByAge: Record<number, number>
  bucket3DrawsByAge: Record<number, number>
  adjustedTargetCents: number
  retirementAge: number
  planningHorizonAge: number
  bandTransitionAges: number[]
  surplusByAge: Record<number, number>
  bucket2DepletionAge?: number | null
  bucket3DepletionAge?: number | null
}

// Green palette for B1 sources
const B1_COLORS = [
  '#16a34a', '#4ade80', '#86efac', '#65a30d', '#22c55e',
  '#15803d', '#bbf7d0', '#166534',
]

function formatMo(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

interface ChartEntry {
  age: number
  [key: string]: number
}

export default function IncomeByAgeChart({
  incomeByAgePerSource,
  bucket2DrawsByAge,
  bucket3DrawsByAge,
  adjustedTargetCents,
  retirementAge,
  planningHorizonAge,
  bandTransitionAges,
  surplusByAge,
  bucket2DepletionAge,
  bucket3DepletionAge,
}: Props) {
  const { byAge, sources } = incomeByAgePerSource
  const targetDollars = Math.round(adjustedTargetCents / 100)

  // Build chart data
  const chartData: ChartEntry[] = []
  for (let age = retirementAge; age <= planningHorizonAge; age++) {
    const ageMap = byAge[age] ?? {}
    const entry: ChartEntry = { age }

    // B1 per-source (green shades)
    for (const src of sources) {
      entry[`b1_${src.id}`] = Math.round((ageMap[src.id] ?? 0) / 100)
    }

    // B2 draw (blue) — absent for ages at/after depletion (Fix 3A enforcement)
    const b2Depleted = bucket2DepletionAge != null && age >= bucket2DepletionAge
    entry['b2_draw'] = b2Depleted ? 0 : Math.round((bucket2DrawsByAge[age] ?? 0) / 100)

    // B3 draw (red) — absent for ages at/after depletion (Fix 3A enforcement)
    const b3Depleted = bucket3DepletionAge != null && age >= bucket3DepletionAge
    entry['b3_draw'] = b3Depleted ? 0 : Math.round((bucket3DrawsByAge[age] ?? 0) / 100)

    // Shortfall bar (above the stacked bars, red) — only if negative surplus
    const surplus = surplusByAge[age] ?? 0
    const total = entry['b2_draw'] + entry['b3_draw'] + sources.reduce((s, src) => s + (entry[`b1_${src.id}`] ?? 0), 0)
    if (surplus < 0) {
      entry['shortfall'] = Math.round(Math.abs(surplus) / 100)
    } else if (surplus > 0) {
      entry['surplus_extra'] = Math.round(surplus / 100)
    }

    // Invisible base for surplus (to position it above target line)
    if (surplus > 0) {
      entry['surplus_base'] = targetDollars
    }

    chartData.push(entry)
  }

  const customTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill: string }>; label?: number }) => {
    if (!active || !payload || !label) return null
    const age = label
    const isBandTransition = bandTransitionAges.includes(age)
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
        <div className="font-semibold text-slate-700 mb-2">Age {age}{isBandTransition ? ' — Band transition' : ''}</div>
        {payload.filter(p => p.value > 0 && p.name !== 'surplus_base').map((p, i) => {
          let label = p.name
          if (p.name.startsWith('b1_')) {
            const srcId = p.name.replace('b1_', '')
            label = sources.find(s => s.id === srcId)?.label ?? srcId
          } else if (p.name === 'b2_draw') label = 'Nest Egg Draw'
          else if (p.name === 'b3_draw') label = 'LOC / HECM Draw'
          else if (p.name === 'shortfall') label = '⚠ Shortfall'
          else if (p.name === 'surplus_extra') label = '↑ Surplus'
          return (
            <div key={i} className="flex justify-between gap-4">
              <span style={{ color: p.fill !== 'transparent' ? p.fill : '#888' }}>{label}</span>
              <span className="font-medium">${p.value.toLocaleString()}/mo</span>
            </div>
          )
        })}
      </div>
    )
  }

  // Reference lines at band transition ages
  const transitionLines = bandTransitionAges.map(age => (
    <ReferenceLine key={`trans-${age}`} x={age} stroke="#cbd5e1" strokeDasharray="4 3" strokeWidth={1} />
  ))

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }} barCategoryGap="10%">
          <XAxis dataKey="age" tick={{ fontSize: 10, fill: '#64748b' }} />
          <YAxis
            tickFormatter={formatMo}
            tick={{ fontSize: 10, fill: '#64748b' }}
            width={56}
          />
          <Tooltip content={customTooltip as never} />
          <Legend
            formatter={(value: string) => {
              if (value.startsWith('b1_')) return sources.find(s => s.id === value.replace('b1_', ''))?.label ?? value
              if (value === 'b2_draw') return 'Nest Egg (B2)'
              if (value === 'b3_draw') return 'HECM/LOC (B3)'
              if (value === 'shortfall') return '⚠ Shortfall'
              if (value === 'surplus_extra') return '↑ Surplus'
              return ''
            }}
            wrapperStyle={{ fontSize: 10 }}
          />

          {/* Band transition vertical markers */}
          {transitionLines}

          {/* Target income reference line */}
          <ReferenceLine
            y={targetDollars}
            stroke="#1e293b"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `Target: $${targetDollars.toLocaleString()}/mo`, position: 'insideTopRight', fontSize: 10, fill: '#1e293b' }}
          />

          {/* B1 sources stacked (green shades) */}
          {sources.map((src, i) => (
            <Bar
              key={src.id}
              dataKey={`b1_${src.id}`}
              stackId="income"
              fill={B1_COLORS[i % B1_COLORS.length]}
              name={`b1_${src.id}`}
              radius={i === 0 ? [0, 0, 2, 2] : undefined}
            />
          ))}

          {/* B2 Nest Egg draw (blue) */}
          <Bar dataKey="b2_draw" stackId="income" fill="#3b82f6" name="b2_draw" />

          {/* B3 HECM/LOC draw (red) */}
          <Bar dataKey="b3_draw" stackId="income" fill="#ef4444" name="b3_draw" radius={[2, 2, 0, 0]} />

          {/* Shortfall bar (red, above stacked bars, separate stack) */}
          <Bar dataKey="shortfall" stackId="shortfall_stack" fill="#fca5a5" name="shortfall" opacity={0.85} radius={[2, 2, 0, 0]} />

          {/* Surplus: invisible base + yellow bar */}
          <Bar dataKey="surplus_base" stackId="surplus_stack" fill="transparent" name="surplus_base" legendType="none" />
          <Bar dataKey="surplus_extra" stackId="surplus_stack" fill="#fbbf24" name="surplus_extra" opacity={0.85} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
