'use client'
import { useState, useEffect, useRef } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import type { AgeBands, AgeBand, AgeBandWithMeta } from '@/types/age-bands'

interface Props {
  ageBands: AgeBands
  retirementAge: number
  planningHorizonAge: number
  nestEggAccounts: Array<{ id: string; label: string }>
  b3HasLoc: boolean
  onUpdate: (ageBands: AgeBands) => void
  bucket2DepletionAge?: number | null
  bucket3DepletionAge?: number | null
}

function newBandId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export default function AgeBandEditor({
  ageBands,
  planningHorizonAge,
  nestEggAccounts,
  b3HasLoc,
  onUpdate,
  bucket2DepletionAge,
  bucket3DepletionAge,
}: Props) {
  return (
    <div className="space-y-5">
      {/* Bucket 2 */}
      <div className="space-y-3">
        <BandSection
          title="Bucket 2 — Nest Egg Draws"
          color="blue"
          bands={ageBands.bucket2.draws}
          planningHorizonAge={planningHorizonAge}
          depletionAge={bucket2DepletionAge}
          onUpdate={(draws) => onUpdate({ ...ageBands, bucket2: { ...ageBands.bucket2, draws } })}
        />
        <BandSection
          title="Bucket 2 — Deposits (surplus reinvested)"
          color="blue"
          bands={ageBands.bucket2.deposits}
          planningHorizonAge={planningHorizonAge}
          isMeta
          nestEggAccounts={nestEggAccounts}
          onUpdate={(deposits) => onUpdate({ ...ageBands, bucket2: { ...ageBands.bucket2, deposits: deposits as AgeBandWithMeta[] } })}
        />
      </div>

      {/* Bucket 3 */}
      <div className="space-y-3">
        <BandSection
          title={b3HasLoc ? 'Bucket 3 — LOC Draws' : 'Bucket 3 — Home Equity Draws'}
          color="red"
          bands={ageBands.bucket3.draws}
          planningHorizonAge={planningHorizonAge}
          depletionAge={bucket3DepletionAge}
          onUpdate={(draws) => onUpdate({ ...ageBands, bucket3: { ...ageBands.bucket3, draws } })}
        />
        {b3HasLoc && (
          <BandSection
            title="Bucket 3 — LOC Repayments"
            color="red"
            bands={ageBands.bucket3.repayments}
            planningHorizonAge={planningHorizonAge}
            isMeta
            onUpdate={(repayments) => onUpdate({ ...ageBands, bucket3: { ...ageBands.bucket3, repayments: repayments as AgeBandWithMeta[] } })}
          />
        )}
      </div>
    </div>
  )
}

function BandSection({
  title,
  color,
  bands,
  planningHorizonAge,
  isMeta = false,
  nestEggAccounts,
  depletionAge,
  onUpdate,
}: {
  title: string
  color: 'blue' | 'red'
  bands: AgeBand[] | AgeBandWithMeta[]
  planningHorizonAge: number
  isMeta?: boolean
  nestEggAccounts?: Array<{ id: string; label: string }>
  depletionAge?: number | null
  onUpdate: (bands: AgeBand[] | AgeBandWithMeta[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)

  // Split mode state
  const [splitMode, setSplitMode] = useState(false)
  const [splitTargetId, setSplitTargetId] = useState<string>('')
  const [splitAge, setSplitAge] = useState<number>(0)
  const [splitError, setSplitError] = useState<string | null>(null)

  // Fix 3B: toast for auto-split notification
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fix 3B: track last processed depletion age to avoid infinite effect loops
  const lastAppliedDepletionAge = useRef<number | null | undefined>(undefined)

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  // Fix 3B: auto-split bands at depletion point whenever depletionAge changes
  useEffect(() => {
    // Only for draw sections (depletionAge is undefined for deposits/repayments)
    if (depletionAge === undefined) return
    // Guard: skip if depletionAge hasn't changed since last time we processed it
    if (depletionAge === lastAppliedDepletionAge.current) return
    lastAppliedDepletionAge.current = depletionAge

    const currentBands = bands as (AgeBand | AgeBandWithMeta)[]

    // Step 1: Remove all depleted bands
    const activeBands = currentBands.filter(b => !(b as AgeBandWithMeta).depleted)

    if (depletionAge == null) {
      // Bucket no longer depletes — remove any depleted bands and restore last band to horizon
      if (activeBands.length < currentBands.length) {
        const restored = [...activeBands]
        if (restored.length > 0) {
          restored[restored.length - 1] = { ...restored[restored.length - 1], end_age: planningHorizonAge }
        }
        onUpdate(restored)
      }
      return
    }

    // Step 2: Remove non-depleted bands starting at/after depletionAge (they'd be post-depletion)
    const preBands = activeBands.filter(b => b.start_age < depletionAge)

    // Step 3: Build new array — adjust last pre-depletion band's end_age
    const newBands: (AgeBand | AgeBandWithMeta)[] = [...preBands]
    if (preBands.length > 0) {
      const last = preBands[preBands.length - 1]
      // Extend (or truncate) last pre-depletion band to end at depletionAge - 1
      const targetEnd = depletionAge - 1
      if (last.end_age !== targetEnd) {
        newBands[newBands.length - 1] = { ...last, end_age: targetEnd }
      }
    }

    // Step 4: Add a single locked depleted band from depletionAge to planningHorizonAge
    const depletedBand = {
      id: newBandId(),
      start_age: depletionAge,
      end_age: planningHorizonAge,
      monthly_amount_cents: 0,
      auto_created: true,
      needs_review: false,
      depleted: true,
    } as AgeBandWithMeta

    newBands.push(depletedBand)

    // Step 5: Only call onUpdate if something actually changed
    const changed =
      newBands.length !== currentBands.length ||
      newBands.some((b, i) => {
        const cur = currentBands[i]
        return !cur || b.start_age !== cur.start_age || b.end_age !== cur.end_age ||
          b.monthly_amount_cents !== cur.monthly_amount_cents ||
          (b as AgeBandWithMeta).depleted !== (cur as AgeBandWithMeta).depleted
      })

    if (changed) {
      const wasAlreadySplit = currentBands.some(b => (b as AgeBandWithMeta).depleted)
      onUpdate(newBands)
      if (!wasAlreadySplit) {
        showToast(`Auto-split at age ${depletionAge} — bucket depletes here. Post-depletion band locked.`)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depletionAge])

  const colorCls = color === 'blue'
    ? { header: 'text-blue-700', border: 'border-blue-200', btn: 'text-blue-600 hover:text-blue-800', addBtn: 'border-blue-300 text-blue-600 hover:bg-blue-50', splitBg: 'bg-blue-50 border-blue-200' }
    : { header: 'text-red-700', border: 'border-red-200', btn: 'text-red-600 hover:text-red-800', addBtn: 'border-red-300 text-red-600 hover:bg-red-50', splitBg: 'bg-red-50 border-red-200' }

  // Fix 1: Corrected deleteBand — extends adjacent band to fill the gap
  function deleteBand(id: string) {
    const idx = bands.findIndex(b => b.id === id)
    if (idx === -1) return
    const deletedBand = bands[idx]
    const newBands = bands.filter(b => b.id !== id) as (AgeBand | AgeBandWithMeta)[]

    if (idx === 0 && newBands.length > 0) {
      // Deleted first band — extend next band back to 62
      newBands[0] = { ...newBands[0], start_age: 62 }
    } else if (idx > 0 && newBands.length > 0) {
      // Extend previous band to cover deleted band's range
      newBands[idx - 1] = { ...newBands[idx - 1], end_age: deletedBand.end_age }
    }

    onUpdate(newBands)
    setConfirmDeleteId(null)
  }

  // Fix 1 + Fix 3A: saveBand with depletion blocking
  function saveBand(id: string, updates: Partial<AgeBand & AgeBandWithMeta>) {
    const idx = bands.findIndex(b => b.id === id)
    if (idx === -1) return

    const updatedBand = { ...bands[idx], ...updates }

    // Validate same-band consistency
    if (updatedBand.start_age >= updatedBand.end_age) {
      setEditError('Start age must be less than end age.')
      return
    }

    // Fix 3A: block edits that would place a band at/after depletion point
    if (depletionAge != null && updatedBand.start_age >= depletionAge) {
      setEditError(`Cannot save — bucket depletes at age ${depletionAge}. This band starts after depletion.`)
      return
    }

    const newBands = [...bands] as (AgeBand | AgeBandWithMeta)[]
    newBands[idx] = updatedBand

    // Auto-adjust adjacent bands for contiguity
    if (updates.end_age !== undefined && idx < bands.length - 1) {
      const newNextStart = updates.end_age + 1
      const nextBand = newBands[idx + 1]
      if (newNextStart >= nextBand.end_age) {
        setEditError('End age is too large — it would eliminate the next band.')
        return
      }
      newBands[idx + 1] = { ...nextBand, start_age: newNextStart }
    }

    if (updates.start_age !== undefined && idx > 0) {
      const newPrevEnd = updates.start_age - 1
      const prevBand = newBands[idx - 1]
      if (newPrevEnd <= prevBand.start_age) {
        setEditError('Start age is too small — it would eliminate the previous band.')
        return
      }
      newBands[idx - 1] = { ...prevBand, end_age: newPrevEnd }
    }

    setEditError(null)
    onUpdate(newBands)
    setEditingId(null)
  }

  // Fix 1 + Fix 3A: addBand with depletion blocking
  function addBand() {
    setSectionError(null)
    const nonDepleted = (bands as (AgeBand | AgeBandWithMeta)[]).filter(b => !(b as AgeBandWithMeta).depleted)
    const lastBand = nonDepleted[nonDepleted.length - 1]
    const startAge = lastBand ? lastBand.end_age + 1 : 62

    // Fix 3A: block adding bands at/after depletion
    if (depletionAge != null && startAge >= depletionAge) {
      setSectionError(`Cannot add band — bucket depletes at age ${depletionAge}.`)
      return
    }

    if (startAge > planningHorizonAge) {
      // All non-depleted ages covered — show split prompt
      const target = nonDepleted[0]
      setSplitTargetId(target?.id ?? '')
      setSplitAge(target ? Math.floor((target.start_age + target.end_age) / 2) : 62)
      setSplitMode(true)
      setSplitError(null)
      return
    }

    const newBands = [...bands] as (AgeBand | AgeBandWithMeta)[]
    // Find the last non-depleted band index in the full array
    const lastNonDepIdx = newBands.reduce((acc, b, i) => (!(b as AgeBandWithMeta).depleted ? i : acc), -1)
    if (lastNonDepIdx >= 0) {
      newBands[lastNonDepIdx] = { ...newBands[lastNonDepIdx], end_age: startAge - 1 }
    }

    // Insert new band before any depleted bands
    const newBand: AgeBandWithMeta = {
      id: newBandId(),
      start_age: startAge,
      end_age: depletionAge != null ? depletionAge - 1 : planningHorizonAge,
      monthly_amount_cents: 0,
      auto_created: false,
      needs_review: false,
    }

    // Insert before depleted bands
    const firstDepletedIdx = newBands.findIndex(b => (b as AgeBandWithMeta).depleted)
    if (firstDepletedIdx >= 0) {
      newBands.splice(firstDepletedIdx, 0, newBand)
    } else {
      newBands.push(newBand)
    }

    onUpdate(newBands)
    setEditingId(newBand.id)
    setEditError(null)
  }

  function doSplit() {
    const nonDepleted = (bands as (AgeBand | AgeBandWithMeta)[]).filter(b => !(b as AgeBandWithMeta).depleted)
    const target = nonDepleted.find(b => b.id === splitTargetId)
    if (!target) return
    if (splitAge <= target.start_age || splitAge > target.end_age) {
      setSplitError(`Split age must be between ${target.start_age + 1} and ${target.end_age}.`)
      return
    }
    // Fix 3A: block split if it would create a band at/after depletion
    if (depletionAge != null && splitAge >= depletionAge) {
      setSplitError(`Cannot split at age ${splitAge} — bucket depletes at age ${depletionAge}.`)
      return
    }
    const band1 = { ...target, id: newBandId(), end_age: splitAge - 1 }
    const band2 = { ...target, id: newBandId(), start_age: splitAge }
    const newBands = bands
      .filter(b => b.id !== splitTargetId)
      .concat([band1, band2])
      .sort((a, b) => a.start_age - b.start_age)
    onUpdate(newBands)
    setSplitMode(false)
    setSplitError(null)
    setEditingId(band2.id)
  }

  function clearNeedsReview(id: string) {
    onUpdate(bands.map(b => b.id === id ? { ...b, needs_review: false } : b))
  }

  // Non-depleted bands available for split selection
  const nonDepletedBands = (bands as (AgeBand | AgeBandWithMeta)[]).filter(b => !(b as AgeBandWithMeta).depleted)

  return (
    <div>
      {/* Fix 3B: auto-split toast */}
      {toast && (
        <div className="mb-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <span className="shrink-0">⚡</span>
          <span>{toast}</span>
        </div>
      )}

      <div className={`text-xs font-semibold ${colorCls.header} mb-1.5`}>{title}</div>

      {/* Fix 3A: section-level error (e.g. addBand blocked by depletion) */}
      {sectionError && (
        <div className="mb-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-1.5">
          {sectionError}
        </div>
      )}

      <div className="space-y-1">
        {bands.map((band, idx) => {
          const meta = band as AgeBandWithMeta
          const isDepletion = meta.depleted === true

          // Fix 3B: render depleted bands as locked read-only rows
          if (isDepletion) {
            return (
              <div key={band.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-xs">
                <span className="text-slate-400 w-20 shrink-0">Age {band.start_age}–{band.end_age}</span>
                <span className="text-slate-400 flex-1 italic">$0/mo (depleted)</span>
                <span className="text-slate-400 text-[10px] shrink-0">🔒 Locked</span>
              </div>
            )
          }

          const nonDepletedBandsArray = (bands as (AgeBand | AgeBandWithMeta)[]).filter(b => !(b as AgeBandWithMeta).depleted)
          const nonDepIdx = nonDepletedBandsArray.findIndex(b => b.id === band.id)
          const isFirst = nonDepIdx === 0
          const isLast = nonDepIdx === nonDepletedBandsArray.length - 1
          const isEditing = editingId === band.id
          const isConfirmingDelete = confirmDeleteId === band.id

          if (isConfirmingDelete) {
            return (
              <div key={band.id} className={`border ${colorCls.border} rounded-lg p-2.5 bg-red-50 text-xs`}>
                <p className="text-slate-700 mb-2">
                  Delete this band? The adjacent band will extend to fill the gap.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteId(null)} className="text-slate-500 hover:text-slate-700">Cancel</button>
                  <button onClick={() => deleteBand(band.id)} className="text-red-600 font-semibold hover:text-red-800">Delete</button>
                </div>
              </div>
            )
          }

          if (isEditing) {
            return (
              <BandEditRow
                key={band.id}
                band={band}
                isMeta={isMeta}
                nestEggAccounts={nestEggAccounts}
                color={color}
                isFirst={isFirst}
                isLast={isLast}
                error={editError}
                onSave={(updates) => saveBand(band.id, updates)}
                onCancel={() => { setEditingId(null); setEditError(null) }}
              />
            )
          }

          return (
            <div key={band.id} className={`flex items-center gap-2 border ${colorCls.border} rounded-lg px-3 py-2 bg-white text-xs`}>
              <span className="text-slate-500 w-20 shrink-0">Age {band.start_age}–{band.end_age}</span>
              <span className="font-semibold text-slate-800 flex-1">{formatCents(band.monthly_amount_cents)}/mo</span>
              {isMeta && meta.account_id && nestEggAccounts && (
                <span className="text-slate-400 truncate max-w-[100px]">
                  → {nestEggAccounts.find(a => a.id === meta.account_id)?.label ?? 'Account'}
                </span>
              )}
              {meta.needs_review && (
                <button
                  onClick={() => clearNeedsReview(band.id)}
                  title="Auto-created band — click to mark as reviewed."
                  className="text-amber-500 hover:text-amber-700 shrink-0"
                >
                  ⚠
                </button>
              )}
              {depletionAge != null && band.start_age < depletionAge && band.end_age >= depletionAge && (
                <span className="text-red-500 text-xs shrink-0" title={`Bucket depletes at age ${depletionAge}`}>
                  ⚠ depletes {depletionAge}
                </span>
              )}
              <button onClick={() => { setEditingId(band.id); setEditError(null); setSectionError(null) }} className={`shrink-0 ${colorCls.btn}`}>Edit</button>
              {nonDepletedBandsArray.length > 1 && (
                <button onClick={() => setConfirmDeleteId(band.id)} className="shrink-0 text-slate-400 hover:text-red-500">✕</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Split prompt */}
      {splitMode && (
        <div className={`mt-2 border ${colorCls.splitBg} rounded-lg p-3 text-xs space-y-2`}>
          <div className="font-semibold text-slate-700">All ages are covered. Split an existing band to add a new one.</div>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-slate-500 mb-1">Band to split</label>
              <select
                value={splitTargetId}
                onChange={e => {
                  setSplitTargetId(e.target.value)
                  const b = nonDepletedBands.find(b => b.id === e.target.value)
                  if (b) setSplitAge(Math.floor((b.start_age + b.end_age) / 2))
                }}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1"
              >
                {nonDepletedBands.map(b => (
                  <option key={b.id} value={b.id}>Age {b.start_age}–{b.end_age}: {formatCents(b.monthly_amount_cents)}/mo</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Split at age</label>
              <input
                type="number"
                value={splitAge}
                onChange={e => setSplitAge(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1"
              />
            </div>
          </div>
          {splitError && <p className="text-red-600">{splitError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setSplitMode(false); setSplitError(null) }} className="text-slate-500 hover:text-slate-700">Cancel</button>
            <button
              onClick={doSplit}
              className={`px-3 py-1 rounded font-semibold text-white text-xs ${color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              Split Band
            </button>
          </div>
        </div>
      )}

      {/* Add band button — hidden when split prompt is showing */}
      {!splitMode && (
        <button
          onClick={addBand}
          className={`mt-1.5 w-full border border-dashed ${colorCls.addBtn} rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors`}
        >
          + Add Band
        </button>
      )}
    </div>
  )
}

function BandEditRow({
  band,
  isMeta,
  nestEggAccounts,
  color,
  isFirst,
  isLast,
  error,
  onSave,
  onCancel,
}: {
  band: AgeBand | AgeBandWithMeta
  isMeta: boolean
  nestEggAccounts?: Array<{ id: string; label: string }>
  color: 'blue' | 'red'
  isFirst: boolean
  isLast: boolean
  error?: string | null
  onSave: (updates: Partial<AgeBand & AgeBandWithMeta>) => void
  onCancel: () => void
}) {
  const meta = band as AgeBandWithMeta
  const [amount, setAmount] = useState(band.monthly_amount_cents)
  const [accountId, setAccountId] = useState(meta.account_id ?? '')
  const [startAge, setStartAge] = useState(band.start_age)
  const [endAge, setEndAge] = useState(band.end_age)

  const ringColor = color === 'blue' ? 'focus:ring-blue-500' : 'focus:ring-red-500'
  const borderColor = color === 'blue' ? 'border-blue-300' : 'border-red-300'

  return (
    <div className={`border ${borderColor} rounded-lg p-2.5 bg-white text-xs space-y-2`}>
      {/* Age range row */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-slate-500 mb-1">Start age</label>
          <input
            type="number"
            value={startAge}
            onChange={e => setStartAge(parseInt(e.target.value) || 0)}
            disabled={isFirst}
            className={`w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 ${ringColor} disabled:bg-slate-100 disabled:text-slate-400`}
          />
          {isFirst && <div className="text-slate-400 text-[10px] mt-0.5">Locked at 62</div>}
        </div>
        <div className="text-slate-400 pb-1.5">–</div>
        <div className="flex-1">
          <label className="block text-slate-500 mb-1">End age</label>
          <input
            type="number"
            value={endAge}
            onChange={e => setEndAge(parseInt(e.target.value) || 0)}
            disabled={isLast}
            className={`w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 ${ringColor} disabled:bg-slate-100 disabled:text-slate-400`}
          />
          {isLast && <div className="text-slate-400 text-[10px] mt-0.5">Locked to horizon</div>}
        </div>
      </div>

      {/* Amount */}
      <CurrencyInput
        value={amount}
        onChange={setAmount}
        className="text-xs"
      />

      {/* Account selector for deposit bands */}
      {isMeta && nestEggAccounts && nestEggAccounts.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-600 mb-0.5 block">Deposit to Account</label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className={`w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 ${ringColor}`}
          >
            <option value="">— Any account —</option>
            {nestEggAccounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      )}

      {/* Inline error */}
      {error && <p className="text-red-600 text-xs">{error}</p>}

      <div className="flex justify-between pt-1">
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">Cancel</button>
        <button
          onClick={() => onSave({
            start_age: isFirst ? band.start_age : startAge,
            end_age: isLast ? band.end_age : endAge,
            monthly_amount_cents: amount,
            account_id: accountId || null,
          })}
          className={`px-3 py-1 rounded font-semibold text-white text-xs ${color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          Save
        </button>
      </div>
    </div>
  )
}
