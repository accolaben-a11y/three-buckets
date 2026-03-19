'use client'
import { useState, useEffect } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import { groupAges } from './AllocationBanner'
import type { AgeRange } from './AllocationBanner'
import type { AgeBands, AgeBand } from '@/types/age-bands'
import { autoFillRange } from '@/types/age-bands'

export interface AllocationEntry {
  selectedBucket: 'b2' | 'b3' | null
  amountCents: number
  acknowledged?: boolean
}
export type AllocationMap = Record<string, AllocationEntry>

interface ConflictState {
  rangeKey: string
  isShortfall: boolean
  bucket: 'b2' | 'b3'
  amountCents: number
  existingCents: number
}

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

function hasConflictBands(bands: AgeBand[], startAge: number, endAge: number): number {
  // Returns total existing cents in the overlapping range (0 if no conflict)
  const overlapping = bands.filter(b =>
    b.start_age <= endAge && b.end_age >= startAge && b.monthly_amount_cents > 0
  )
  if (overlapping.length === 0) return 0
  return Math.round(overlapping.reduce((s, b) => s + b.monthly_amount_cents, 0) / overlapping.length)
}

export default function AllocationDrawer({
  isOpen, onClose, surplusByAge, adjustedTargetCents, ageBands, b3HasLoc,
  depletionAges, allocations, onAllocationsChange, onAgeBandsUpdate,
}: Props) {
  const [conflictState, setConflictState] = useState<ConflictState | null>(null)

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
    return allocations[rangeKey(r)] ?? { selectedBucket: null, amountCents: 0 }
  }

  function setEntry(r: AgeRange, entry: AllocationEntry) {
    onAllocationsChange({ ...allocations, [rangeKey(r)]: entry })
  }

  function isB2Depleted(r: AgeRange) {
    const age = depletionAges?.bucket2DepletionAge
    return age != null && age <= r.startAge
  }

  function isB3Depleted(r: AgeRange) {
    const age = depletionAges?.bucket3DepletionAge
    return age != null && age <= r.startAge
  }

  function applyShortfall(r: AgeRange, bucket: 'b2' | 'b3', amountCents: number, mode: 'add' | 'set') {
    let updated = { ...ageBands }
    if (bucket === 'b2') {
      updated = { ...updated, bucket2: { ...updated.bucket2, draws: autoFillRange(updated.bucket2.draws, r.startAge, r.endAge, amountCents, mode) } }
    } else {
      updated = { ...updated, bucket3: { ...updated.bucket3, draws: autoFillRange(updated.bucket3.draws, r.startAge, r.endAge, amountCents, mode) } }
    }
    onAgeBandsUpdate(updated)
    setEntry(r, { selectedBucket: null, amountCents: 0 })
    setConflictState(null)
  }

  function applySurplus(r: AgeRange, bucket: 'b2' | 'b3', amountCents: number, mode: 'add' | 'set') {
    let updated = { ...ageBands }
    if (bucket === 'b2') {
      updated = { ...updated, bucket2: { ...updated.bucket2, deposits: autoFillRange(updated.bucket2.deposits, r.startAge, r.endAge, amountCents, mode) } }
    } else {
      updated = { ...updated, bucket3: { ...updated.bucket3, repayments: autoFillRange(updated.bucket3.repayments, r.startAge, r.endAge, amountCents, mode) } }
    }
    onAgeBandsUpdate(updated)
    setEntry(r, { selectedBucket: null, amountCents: 0 })
    setConflictState(null)
  }

  function confirmShortfall(r: AgeRange) {
    const entry = getEntry(r)
    if (!entry.selectedBucket || entry.amountCents <= 0) return

    const targetBands = entry.selectedBucket === 'b2' ? ageBands.bucket2.draws : ageBands.bucket3.draws
    const existing = hasConflictBands(targetBands, r.startAge, r.endAge)
    if (existing > 0) {
      setConflictState({ rangeKey: rangeKey(r), isShortfall: true, bucket: entry.selectedBucket, amountCents: entry.amountCents, existingCents: existing })
      return
    }

    applyShortfall(r, entry.selectedBucket, entry.amountCents, 'add')
  }

  function confirmSurplus(r: AgeRange) {
    const entry = getEntry(r)
    if (!entry.selectedBucket || entry.amountCents <= 0) return

    const targetBands = entry.selectedBucket === 'b2' ? ageBands.bucket2.deposits : ageBands.bucket3.repayments
    const existing = hasConflictBands(targetBands, r.startAge, r.endAge)
    if (existing > 0) {
      setConflictState({ rangeKey: rangeKey(r), isShortfall: false, bucket: entry.selectedBucket, amountCents: entry.amountCents, existingCents: existing })
      return
    }

    applySurplus(r, entry.selectedBucket, entry.amountCents, 'add')
  }

  function resolveConflict(mode: 'override' | 'merge' | 'cancel') {
    if (!conflictState) return
    if (mode === 'cancel') { setConflictState(null); return }

    // Find the range from its key
    const allRanges = [...shortfallRanges, ...surplusRanges]
    const r = allRanges.find(range => rangeKey(range) === conflictState.rangeKey)
    if (!r) { setConflictState(null); return }

    const fillMode = mode === 'override' ? 'set' : 'add'
    if (conflictState.isShortfall) {
      applyShortfall(r, conflictState.bucket, conflictState.amountCents, fillMode)
    } else {
      applySurplus(r, conflictState.bucket, conflictState.amountCents, fillMode)
    }
  }

  function acknowledgeRange(r: AgeRange) {
    setEntry(r, { ...getEntry(r), acknowledged: true })
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
            Target: {formatCents(adjustedTargetCents)}/mo. Select a bucket and enter an amount, then confirm to update age bands.
          </div>

          {/* Conflict resolution prompt */}
          {conflictState && (
            <div className="border border-amber-300 rounded-lg p-3 bg-amber-50 text-xs space-y-2">
              <div className="font-semibold text-amber-800">Band conflict detected</div>
              <div className="text-slate-600">
                An existing band for this age range already has {formatCents(conflictState.existingCents)}/mo.
                How should the new amount ({formatCents(conflictState.amountCents)}/mo) be applied?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => resolveConflict('override')}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
                >
                  Override
                </button>
                <button
                  onClick={() => resolveConflict('merge')}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Merge
                </button>
                <button
                  onClick={() => resolveConflict('cancel')}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Shortfall ranges */}
          {shortfallRanges.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Shortfalls</div>
              <div className="space-y-3">
                {shortfallRanges.map((r, i) => {
                  const entry = getEntry(r)
                  const b2Depleted = isB2Depleted(r)
                  const b3Depleted = isB3Depleted(r)
                  const b3Unavailable = !b3HasLoc
                  const canConfirm = entry.selectedBucket !== null && entry.amountCents > 0
                  const isThisConflict = conflictState?.rangeKey === rangeKey(r)
                  return (
                    <div key={i} className={`border rounded-lg p-3 space-y-2.5 ${isThisConflict ? 'border-amber-300 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="text-sm font-semibold text-slate-800">
                        🔴 Ages {r.startAge}{r.endAge !== r.startAge ? `–${r.endAge}` : ''}: ~{formatCents(r.avgCents)}/mo shortfall
                      </div>
                      <div className="text-xs text-slate-500">Cover this shortfall from:</div>

                      {/* Bucket buttons */}
                      <div className="flex gap-2">
                        <BucketButton
                          label="B2 — Nest Egg"
                          color="blue"
                          selected={entry.selectedBucket === 'b2'}
                          disabled={b2Depleted}
                          disabledReason={b2Depleted ? `B2 depleted at age ${depletionAges?.bucket2DepletionAge}` : undefined}
                          onClick={() => setEntry(r, { ...entry, selectedBucket: entry.selectedBucket === 'b2' ? null : 'b2', amountCents: 0 })}
                        />
                        <BucketButton
                          label="B3 — HECM/LOC"
                          color="red"
                          selected={entry.selectedBucket === 'b3'}
                          disabled={b3Depleted || b3Unavailable}
                          disabledReason={b3Unavailable ? 'No LOC configured' : b3Depleted ? `B3 depleted at age ${depletionAges?.bucket3DepletionAge}` : undefined}
                          onClick={() => setEntry(r, { ...entry, selectedBucket: entry.selectedBucket === 'b3' ? null : 'b3', amountCents: 0 })}
                        />
                      </div>

                      {/* Amount input — only shown when a bucket is selected */}
                      {entry.selectedBucket && (
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Amount</div>
                          <CurrencyInput
                            value={entry.amountCents}
                            onChange={v => setEntry(r, { ...entry, amountCents: v })}
                            className="text-xs w-full"
                          />
                          <div className={`text-xs mt-1 ${entry.amountCents >= r.avgCents ? 'text-green-700' : 'text-red-600'}`}>
                            {entry.amountCents >= r.avgCents
                              ? `✓ Covers ${formatCents(r.avgCents)}/mo shortfall`
                              : `Gap: ${formatCents(r.avgCents - entry.amountCents)}/mo remaining`}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => confirmShortfall(r)}
                        disabled={!canConfirm || !!conflictState}
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
                  const b3Unavailable = !b3HasLoc
                  const b3Depleted = isB3Depleted(r)
                  const canConfirm = entry.selectedBucket !== null && entry.amountCents > 0
                  const isThisConflict = conflictState?.rangeKey === rangeKey(r)
                  return (
                    <div key={i} className={`border rounded-lg p-3 space-y-2.5 ${isThisConflict ? 'border-amber-300 bg-amber-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div className="text-sm font-semibold text-slate-800">
                        🟡 Ages {r.startAge}{r.endAge !== r.startAge ? `–${r.endAge}` : ''}: ~{formatCents(r.avgCents)}/mo surplus
                      </div>
                      <div className="text-xs text-slate-500">Allocate this surplus to:</div>

                      {/* Bucket buttons */}
                      <div className="flex gap-2">
                        <BucketButton
                          label="B2 — Reinvest"
                          color="blue"
                          selected={entry.selectedBucket === 'b2'}
                          onClick={() => setEntry(r, { ...entry, selectedBucket: entry.selectedBucket === 'b2' ? null : 'b2', amountCents: 0 })}
                        />
                        <BucketButton
                          label="B3 — LOC Repay"
                          color="red"
                          selected={entry.selectedBucket === 'b3'}
                          disabled={b3Depleted || b3Unavailable}
                          disabledReason={b3Unavailable ? 'No LOC configured' : b3Depleted ? `B3 depleted at age ${depletionAges?.bucket3DepletionAge}` : undefined}
                          onClick={() => setEntry(r, { ...entry, selectedBucket: entry.selectedBucket === 'b3' ? null : 'b3', amountCents: 0 })}
                        />
                      </div>

                      {/* Amount input */}
                      {entry.selectedBucket && (
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Amount</div>
                          <CurrencyInput
                            value={entry.amountCents}
                            onChange={v => setEntry(r, { ...entry, amountCents: v })}
                            className="text-xs w-full"
                          />
                          <div className={`text-xs mt-1 ${entry.amountCents >= r.avgCents ? 'text-green-700' : 'text-amber-700'}`}>
                            {entry.amountCents >= r.avgCents
                              ? `✓ Fully allocated`
                              : `Remaining: ${formatCents(r.avgCents - entry.amountCents)}/mo`}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => acknowledgeRange(r)}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          Acknowledge without allocating
                        </button>
                        <button
                          onClick={() => confirmSurplus(r)}
                          disabled={!canConfirm || !!conflictState}
                          className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 transition-colors"
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

function BucketButton({
  label,
  color,
  selected,
  disabled,
  disabledReason,
  onClick,
}: {
  label: string
  color: 'blue' | 'red'
  selected: boolean
  disabled?: boolean
  disabledReason?: string
  onClick: () => void
}) {
  const baseClass = 'flex-1 text-xs py-2 px-3 rounded-lg border-2 font-medium transition-colors'
  const selectedClass = color === 'blue'
    ? 'bg-blue-600 border-blue-600 text-white'
    : 'bg-red-600 border-red-600 text-white'
  const unselectedClass = color === 'blue'
    ? 'border-blue-300 text-blue-700 hover:bg-blue-50'
    : 'border-red-300 text-red-700 hover:bg-red-50'
  const disabledClass = 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'

  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      title={disabledReason}
      className={`${baseClass} ${disabled ? disabledClass : selected ? selectedClass : unselectedClass}`}
    >
      {label}
      {disabled && disabledReason && (
        <div className="text-[10px] font-normal mt-0.5 opacity-75 truncate">{disabledReason}</div>
      )}
    </button>
  )
}
