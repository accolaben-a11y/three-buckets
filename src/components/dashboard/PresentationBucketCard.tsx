'use client'
import type { AgeBands } from '@/types/age-bands'
import type { FullCalculationResult } from '@/lib/calculations'

interface Props {
  ageBands: AgeBands
  calcResult: FullCalculationResult | null
  planningHorizonAge: number
  b3HasLoc: boolean
  b3IsTenure: boolean
  b3LocGrowthRateBps?: number
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

function hasSurplusOrShortfall(calcResult: FullCalculationResult | null) {
  if (!calcResult) return false
  return Object.values(calcResult.surplusByAge).some(s => s < 0)
}

export default function PresentationBucketCard({ ageBands, calcResult, planningHorizonAge, b3HasLoc, b3IsTenure, b3LocGrowthRateBps = 600 }: Props) {
  const unresolved = hasSurplusOrShortfall(calcResult)

  // Find the age ranges that have unresolved shortfalls
  const shortfallAges = calcResult
    ? Object.entries(calcResult.surplusByAge)
        .filter(([, s]) => s < 0)
        .map(([age]) => Number(age))
    : []
  const shortfallMin = shortfallAges.length > 0 ? Math.min(...shortfallAges) : null
  const shortfallMax = shortfallAges.length > 0 ? Math.max(...shortfallAges) : null

  // Projected balances at planning horizon
  const lastSnap = calcResult?.longevityProjection[calcResult.longevityProjection.length - 1]
  const b2EndBalance = lastSnap?.bucket2BalanceCents ?? 0
  const b3EndBalance = lastSnap?.bucket3BalanceCents ?? 0

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Bucket 2 card */}
      <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
          <span className="font-semibold text-slate-800 text-sm">Bucket 2 — Nest Egg</span>
        </div>

        {/* Draw bands */}
        <div className="space-y-1 text-xs mb-3">
          {ageBands.bucket2.draws.map(band => (
            <div key={band.id} className="flex justify-between text-slate-700">
              <span className="text-slate-500">Ages {band.start_age}–{band.end_age}</span>
              <span className="font-medium">{formatCents(band.monthly_amount_cents)}/mo drawn</span>
            </div>
          ))}
          {ageBands.bucket2.deposits.map(band => (
            <div key={band.id} className="flex justify-between text-slate-600 italic">
              <span className="text-slate-500">Ages {band.start_age}–{band.end_age}</span>
              <span>+ {formatCents(band.monthly_amount_cents)}/mo reinvested</span>
            </div>
          ))}
        </div>

        <div className="border-t border-blue-100 pt-2 text-xs">
          <span className="text-slate-500">Projected balance at age {planningHorizonAge}: </span>
          <span className={`font-bold ${b2EndBalance > 0 ? 'text-blue-700' : 'text-red-600'}`}>
            {b2EndBalance > 0 ? formatCents(b2EndBalance) : 'Depleted'}
          </span>
        </div>

        {unresolved && shortfallMin !== null && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            ⚠ Plan includes unresolved shortfalls at ages {shortfallMin}–{shortfallMax}. See allocation summary above.
          </div>
        )}
      </div>

      {/* Bucket 3 card */}
      <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
          <span className="font-semibold text-slate-800 text-sm">Bucket 3 — Home Equity</span>
        </div>

        <div className="space-y-1 text-xs mb-3">
          {ageBands.bucket3.draws.map(band => (
            <div key={band.id} className="flex justify-between text-slate-700">
              <span className="text-slate-500">Ages {band.start_age}–{band.end_age}</span>
              <span className="font-medium">
                {band.monthly_amount_cents === 0
                  ? b3HasLoc
                    ? <span className="text-slate-500">$0/mo (growing at {(b3LocGrowthRateBps / 100).toFixed(1)}%)</span>
                    : '$0/mo'
                  : `${formatCents(band.monthly_amount_cents)}/mo drawn`}
              </span>
            </div>
          ))}
          {b3HasLoc && ageBands.bucket3.repayments.map(band => (
            <div key={band.id} className="flex justify-between text-slate-600 italic">
              <span className="text-slate-500">Ages {band.start_age}–{band.end_age}</span>
              <span>+ {formatCents(band.monthly_amount_cents)}/mo repaid</span>
            </div>
          ))}
          {b3IsTenure && (
            <div className="text-slate-500 italic">Monthly tenure payment (guaranteed)</div>
          )}
        </div>

        {(b3HasLoc || b3IsTenure) && (
          <div className="border-t border-red-100 pt-2 text-xs">
            {b3HasLoc ? (
              <>
                <span className="text-slate-500">LOC balance at age {planningHorizonAge}: </span>
                <span className={`font-bold ${b3EndBalance > 0 ? 'text-red-700' : 'text-red-500'}`}>
                  {b3EndBalance > 0 ? formatCents(b3EndBalance) : 'Depleted'}
                </span>
              </>
            ) : (
              <span className="text-slate-500 italic">Tenure payments continue for life of occupancy</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
