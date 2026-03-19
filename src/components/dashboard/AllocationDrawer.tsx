'use client'
import { useEffect } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import { groupAges } from './AllocationBanner'
import type { AgeRange } from './AllocationBanner'
import type { AgeBands } from '@/types/age-bands'
import { autoFillRange } from '@/types/age-bands'

export interface AllocationEntry {
  b2Cents: number
  b3Cents: number
  acknowledged?: boolean
}
export type AllocationMap = Record<string, AllocationEntry>

interface Props {
  isOpen: boolean
  onClose: () => void
  surplusByAge: Record<number, number>
  adjustedTargetCents: number
  ageBands: AgeBands
  b3HasLoc: boolean
  depletionAges?: { bucket2DepletionAge?: number | null; bucket3DepletionAge?: number | null }
  allocations: AllocationMap
  onAllocationsChange: (allocations: AllocationMap) => void
  onAgeBandsUpdate: (bands: AgeBands) => void
}

function rangeKey(r: AgeRange) {
  return `${r.startAge}-${r.endAge}`
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export default function AllocationDrawer({
  isOpen, onClose, surplusByAge, adjustedTargetCents, ageBands, b3HasLoc,
  depletionAges, allocations, onAllocationsChange, onAgeBandsUpdate,
}: Props) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const shortfallRanges = groupAges(surplusByAge, true).filter(r => {
    const entry = allocations[rangeKey(r)]
    return !entry?.acknowledged
  })
  const surplusRanges = groupAges(surplusByAge, false).filter(r => {
    const entry = allocations[rangeKey(r)]
    return !entry?.acknowledged
  })

  function getEntry(r: AgeRange): AllocationEntry {
    return allocations[rangeKey(r)] ?? { b2Cents: 0, b3Cents: 0 }
  }

  function setEntry(r: AgeRange, entry: AllocationEntry) {
    onAllocationsChange({ ...allocations, [rangeKey(r)]: entry })
  }

  function confirmShortfall(r: AgeRange) {
    const entry = getEntry(r)
    if (entry.b2Cents === 0 && entry.b3Cents === 0) return

    let updated = { ...ageBands }
    if (entry.b2Cents > 0) {
      updated = { ...updated, bucket2: { ...updated.bucket2, draws: autoFillRange(updated.bucket2.draws, r.startAge, r.endAge, entry.b2Cents) } }
    }
    if (entry.b3Cents > 0) {
      updated = { ...updated, bucket3: { ...updated.bucket3, draws: autoFillRange(updated.bucket3.draws, r.startAge, r.endAge, entry.b3Cents) } }
    }
    onAgeBandsUpdate(updated)
    setEntry(r, { b2Cents: 0, b3Cents: 0 })
  }

  function confirmSurplus(r: AgeRange) {
    const entry = getEntry(r)
    let updated = { ...ageBands }
    if (entry.b2Cents > 0) {
      updated = { ...updated, bucket2: { ...updated.bucket2, deposits: autoFillRange(updated.bucket2.deposits, r.startAge, r.endAge, entry.b2Cents) } }
    }
    if (entry.b3Cents > 0) {
      updated = { ...updated, bucket3: { ...updated.bucket3, repayments: autoFillRange(updated.bucket3.repayments, r.startAge, r.endAge, entry.b3Cents) } }
    }
    if (entry.b2Cents > 0 || entry.b3Cents > 0) {
      onAgeBandsUpdate(updated)
    }
    setEntry(r, { b2Cents: 0, b3Cents: 0 })
  }

  function acknowledgeRange(r: AgeRange) {
    setEntry(r, { ...getEntry(r), acknowledged: true })
  }

  function isB2Depleted(r: AgeRange) {
    const age = depletionAges?.bucket2DepletionAge
    return age != null && age <= r.startAge
  }

  function isB3Depleted(r: AgeRange) {
    const age = depletionAges?.bucket3DepletionAge
    return age != null && age <= r.startAge
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-full bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Allocation Issues</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs text-slate-500">
            Target: {formatCents(adjustedTargetCents)}/mo. Enter amounts to cover shortfalls or allocate surpluses, then confirm to update age bands.
          </div>

          {/* Shortfall ranges */}
          {shortfallRanges.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Shortfalls</div>
              <div className="space-y-3">
                {shortfallRanges.map((r, i) => {
                  const entry = getEntry(r)
                  const total = entry.b2Cents + entry.b3Cents
                  const remaining = r.avgCents - total
                  const b2Depleted = isB2Depleted(r)
                  const b3Depleted = isB3Depleted(r)
                  const b3Unavailable = !b3HasLoc
                  return (
                    <div key={i} className="border border-red-200 rounded-lg p-3 bg-red-50 space-y-2.5">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          🔴 Ages {r.startAge}{r.endAge !== r.startAge ? `–${r.endAge}` : ''}: ~{formatCents(r.avgCents)}/mo shortfall
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Cover this shortfall from:</div>
                      </div>

                      {/* B2 input */}
                      <BucketAmountInput
                        label="Bucket 2 — Nest Egg"
                        value={entry.b2Cents}
                        disabled={b2Depleted}
                        disabledReason={b2Depleted ? `B2 depleted at age ${depletionAges?.bucket2DepletionAge}` : undefined}
                        color="blue"
                        onChange={v => setEntry(r, { ...entry, b2Cents: v })}
                      />

                      {/* B3 input */}
                      <BucketAmountInput
                        label="Bucket 3 — Home Equity"
                        value={entry.b3Cents}
                        disabled={b3Depleted || b3Unavailable}
                        disabledReason={
                          b3Unavailable ? 'No LOC configured' :
                          b3Depleted ? `B3 depleted at age ${depletionAges?.bucket3DepletionAge}` :
                          undefined
                        }
                        color="red"
                        onChange={v => setEntry(r, { ...entry, b3Cents: v })}
                      />

                      {/* Totals */}
                      <div className="flex justify-between text-xs pt-1 border-t border-red-200">
                        <span className="text-slate-600">Total assigned: <span className="font-semibold">{formatCents(total)}/mo</span></span>
                        <span className={remaining > 0 ? 'text-red-700 font-semibold' : remaining < 0 ? 'text-amber-700 font-semibold' : 'text-green-700 font-semibold'}>
                          {remaining > 0 ? `Gap: ${formatCents(remaining)}/mo` : remaining < 0 ? `Over by ${formatCents(-remaining)}/mo` : '✓ Fully covered'}
                        </span>
                      </div>

                      <button
                        onClick={() => confirmShortfall(r)}
                        disabled={total === 0}
                        className="w-full text-xs font-semibold py-1.5 rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Surplus ranges */}
          {surplusRanges.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Surpluses</div>
              <div className="space-y-3">
                {surplusRanges.map((r, i) => {
                  const entry = getEntry(r)
                  const total = entry.b2Cents + entry.b3Cents
                  const remaining = r.avgCents - total
                  const b3Unavailable = !b3HasLoc
                  const b3Depleted = isB3Depleted(r)
                  return (
                    <div key={i} className="border border-amber-200 rounded-lg p-3 bg-amber-50 space-y-2.5">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          🟡 Ages {r.startAge}{r.endAge !== r.startAge ? `–${r.endAge}` : ''}: ~{formatCents(r.avgCents)}/mo surplus
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Allocate this surplus to:</div>
                      </div>

                      {/* B2 deposit input */}
                      <BucketAmountInput
                        label="Bucket 2 — Reinvest (deposit)"
                        value={entry.b2Cents}
                        color="blue"
                        onChange={v => setEntry(r, { ...entry, b2Cents: v })}
                      />

                      {/* B3 repayment input */}
                      <BucketAmountInput
                        label="Bucket 3 — LOC Repayment"
                        value={entry.b3Cents}
                        disabled={b3Depleted || b3Unavailable}
                        disabledReason={
                          b3Unavailable ? 'No LOC configured' :
                          b3Depleted ? `B3 depleted at age ${depletionAges?.bucket3DepletionAge}` :
                          undefined
                        }
                        color="red"
                        onChange={v => setEntry(r, { ...entry, b3Cents: v })}
                      />

                      {/* Totals */}
                      <div className="flex justify-between text-xs pt-1 border-t border-amber-200">
                        <span className="text-slate-600">Total allocated: <span className="font-semibold">{formatCents(total)}/mo</span></span>
                        <span className={remaining > 0 ? 'text-amber-700 font-semibold' : remaining < 0 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>
                          {remaining > 0 ? `Remaining: ${formatCents(remaining)}/mo` : remaining < 0 ? `Over by ${formatCents(-remaining)}/mo` : '✓ Fully allocated'}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => acknowledgeRange(r)}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          Acknowledge without allocating
                        </button>
                        <button
                          onClick={() => confirmSurplus(r)}
                          className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white bg-amber-600 hover:bg-amber-700 transition-colors"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {shortfallRanges.length === 0 && surplusRanges.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              ✓ No shortfalls or surpluses — plan is fully balanced.
            </div>
          )}
        </div>

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

function BucketAmountInput({
  label, value, disabled, disabledReason, color, onChange,
}: {
  label: string
  value: number
  disabled?: boolean
  disabledReason?: string
  color: 'blue' | 'red'
  onChange: (cents: number) => void
}) {
  const ringColor = color === 'blue' ? 'focus:ring-blue-500' : 'focus:ring-red-500'
  const dotColor = color === 'blue' ? 'bg-blue-500' : 'bg-red-500'

  return (
    <div className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
      <span className="text-xs text-slate-700 flex-1 min-w-0 truncate">{label}</span>
      {disabled ? (
        <span className="text-xs text-slate-400 italic shrink-0">{disabledReason ?? 'Unavailable'}</span>
      ) : (
        <div className="shrink-0">
          <CurrencyInput
            value={value}
            onChange={onChange}
            className={`text-xs w-28 focus:ring-1 ${ringColor}`}
          />
        </div>
      )}
    </div>
  )
}

