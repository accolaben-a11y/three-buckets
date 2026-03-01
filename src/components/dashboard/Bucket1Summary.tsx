'use client'
import type { FullCalculationResult } from '@/lib/calculations'

interface Props {
  calcResult: FullCalculationResult | null
  calcLoading: boolean
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export default function Bucket1Summary({ calcResult, calcLoading }: Props) {
  const atRetirement = calcResult?.dashboard.bucket1MonthlyCents ?? 0

  // Walk longevityProjection to find age steps where bucket1IncomeCents changes
  const transitions: Array<{ age: number; incomeCents: number }> = []
  if (calcResult) {
    const proj = calcResult.longevityProjection
    for (let i = 0; i < proj.length; i++) {
      const prev = proj[i - 1]
      const curr = proj[i]
      if (i === 0 || (prev && curr.bucket1IncomeCents !== prev.bucket1IncomeCents)) {
        transitions.push({ age: curr.age, incomeCents: curr.bucket1IncomeCents })
      }
    }
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
        <span className="text-xs font-semibold text-slate-700">Bucket 1 — Income Streams</span>
        <span className="ml-auto text-sm font-bold text-green-700">
          {calcLoading ? '…' : `${formatCents(atRetirement)}/mo at retirement`}
        </span>
      </div>

      {!calcLoading && transitions.length > 0 && (
        <div className="space-y-1">
          {transitions.map(({ age, incomeCents }) => (
            <div key={age} className="flex justify-between text-xs">
              <span className="text-slate-500">Age {age}</span>
              <span className="font-semibold text-green-700">{formatCents(incomeCents)}/mo</span>
            </div>
          ))}
        </div>
      )}

      {calcLoading && (
        <div className="text-xs text-slate-400 italic">Calculating…</div>
      )}
    </div>
  )
}
