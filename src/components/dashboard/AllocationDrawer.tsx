'use client'
import { useEffect } from 'react'
import { groupAges } from './AllocationBanner'
import type { AgeBands } from '@/types/age-bands'

interface Props {
  isOpen: boolean
  onClose: () => void
  surplusByAge: Record<number, number>
  adjustedTargetCents: number
  ageBands: AgeBands
  onAgeBandsUpdate: (bands: AgeBands) => void
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

function newBandId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function AllocationDrawer({
  isOpen, onClose, surplusByAge, adjustedTargetCents, ageBands, onAgeBandsUpdate,
}: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const shortfallRanges = groupAges(surplusByAge, true)
  const surplusRanges = groupAges(surplusByAge, false)

  function autoFillB2(startAge: number, endAge: number, avgCents: number) {
    // Find the existing B2 draw band that covers startAge
    const draws = [...ageBands.bucket2.draws]
    const coveringIdx = draws.findIndex(b => b.start_age <= startAge && b.end_age >= startAge)
    if (coveringIdx === -1) {
      // Append a new band at the end (shouldn't normally happen)
      const newBand = {
        id: newBandId(),
        start_age: startAge,
        end_age: endAge,
        monthly_amount_cents: avgCents,
      }
      onAgeBandsUpdate({ ...ageBands, bucket2: { ...ageBands.bucket2, draws: [...draws, newBand] } })
      return
    }
    const covering = draws[coveringIdx]
    const newDraws = draws.filter((_, i) => i !== coveringIdx)

    // Split the covering band around the shortfall range
    if (covering.start_age < startAge) {
      newDraws.push({ ...covering, id: newBandId(), end_age: startAge - 1 })
    }
    newDraws.push({
      id: newBandId(),
      start_age: startAge,
      end_age: Math.min(endAge, covering.end_age),
      monthly_amount_cents: covering.monthly_amount_cents + avgCents,
    })
    if (covering.end_age > endAge) {
      newDraws.push({ ...covering, id: newBandId(), start_age: endAge + 1 })
    }

    newDraws.sort((a, b) => a.start_age - b.start_age)
    onAgeBandsUpdate({ ...ageBands, bucket2: { ...ageBands.bucket2, draws: newDraws } })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 max-w-full bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Allocation Issues</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary */}
          <div className="text-xs text-slate-500">
            Target: {formatCents(adjustedTargetCents)}/mo. Review age ranges below and adjust bands in the editor to resolve issues.
          </div>

          {/* Shortfall ranges */}
          {shortfallRanges.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Shortfalls</div>
              <div className="space-y-2">
                {shortfallRanges.map((r, i) => (
                  <div key={i} className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Ages {r.startAge}{r.endAge !== r.startAge ? `–${r.endAge}` : ''}
                        </div>
                        <div className="text-xs text-red-700 mt-0.5">
                          Avg shortfall: {formatCents(r.avgCents)}/mo
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Increase B2 or B3 draw bands to cover this gap.
                        </div>
                      </div>
                      <button
                        onClick={() => autoFillB2(r.startAge, r.endAge, r.avgCents)}
                        className="shrink-0 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition-colors"
                        title="Add the shortfall amount to your B2 draw band covering this range"
                      >
                        Auto-fill B2
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Surplus ranges */}
          {surplusRanges.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Surpluses</div>
              <div className="space-y-2">
                {surplusRanges.map((r, i) => (
                  <div key={i} className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                    <div className="text-sm font-semibold text-slate-800">
                      Ages {r.startAge}{r.endAge !== r.startAge ? `–${r.endAge}` : ''}
                    </div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      Avg surplus: {formatCents(r.avgCents)}/mo
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Reduce B2 or B3 draws for these ages, or add a deposit band to reinvest surplus.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shortfallRanges.length === 0 && surplusRanges.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              ✓ No shortfalls or surpluses — plan is fully balanced.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
