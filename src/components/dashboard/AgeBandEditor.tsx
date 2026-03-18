'use client'
import { useState } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import type { AgeBands, AgeBand, AgeBandWithMeta } from '@/types/age-bands'

interface Props {
  ageBands: AgeBands
  retirementAge: number
  planningHorizonAge: number
  nestEggAccounts: Array<{ id: string; label: string }>
  b3HasLoc: boolean
  onUpdate: (ageBands: AgeBands) => void
  /** Per-age depletion warnings from calcResult */
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
  retirementAge,
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
  const [adding, setAdding] = useState(false)

  const colorCls = color === 'blue'
    ? { header: 'text-blue-700', border: 'border-blue-200', btn: 'text-blue-600 hover:text-blue-800', addBtn: 'border-blue-300 text-blue-600 hover:bg-blue-50' }
    : { header: 'text-red-700', border: 'border-red-200', btn: 'text-red-600 hover:text-red-800', addBtn: 'border-red-300 text-red-600 hover:bg-red-50' }

  function deleteBand(id: string) {
    const idx = bands.findIndex(b => b.id === id)
    if (idx === -1) return
    const newBands = bands.filter(b => b.id !== id)
    // Extend previous band to planning horizon if it exists
    if (idx > 0 && newBands.length > 0) {
      const prev = newBands[idx - 1]
      newBands[idx - 1] = { ...prev, end_age: planningHorizonAge }
    }
    onUpdate(newBands)
    setConfirmDeleteId(null)
  }

  function saveBand(id: string, updates: Partial<AgeBand & AgeBandWithMeta>) {
    onUpdate(bands.map(b => b.id === id ? { ...b, ...updates } : b))
    setEditingId(null)
  }

  function addBand() {
    const lastBand = bands[bands.length - 1]
    const startAge = lastBand ? lastBand.end_age + 1 : planningHorizonAge
    if (startAge > planningHorizonAge) return
    // Shrink the last band to end at startAge - 1
    const newBands: (AgeBand | AgeBandWithMeta)[] = [...bands]
    if (lastBand) {
      newBands[newBands.length - 1] = { ...lastBand, end_age: startAge - 1 }
    }
    const newBand: AgeBandWithMeta = {
      id: newBandId(),
      start_age: startAge,
      end_age: planningHorizonAge,
      monthly_amount_cents: 0,
      auto_created: false,
      needs_review: false,
    }
    onUpdate([...newBands, newBand])
    setAdding(false)
    setEditingId(newBand.id)
  }

  function clearNeedsReview(id: string) {
    onUpdate(bands.map(b => b.id === id ? { ...b, needs_review: false } : b))
  }

  return (
    <div>
      <div className={`text-xs font-semibold ${colorCls.header} mb-1.5`}>{title}</div>
      <div className="space-y-1">
        {bands.map((band) => {
          const meta = band as AgeBandWithMeta
          const isEditing = editingId === band.id
          const isConfirmingDelete = confirmDeleteId === band.id

          if (isConfirmingDelete) {
            return (
              <div key={band.id} className={`border ${colorCls.border} rounded-lg p-2.5 bg-red-50 text-xs`}>
                <p className="text-slate-700 mb-2">
                  Delete this band? The previous band will extend to age {planningHorizonAge}.
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
                onSave={(updates) => saveBand(band.id, updates)}
                onCancel={() => setEditingId(null)}
              />
            )
          }

          return (
            <div key={band.id} className={`flex items-center gap-2 border ${colorCls.border} rounded-lg px-3 py-2 bg-white text-xs`}>
              <span className="text-slate-500 w-20 shrink-0">Age {band.start_age}–{band.end_age}</span>
              <span className="font-semibold text-slate-800 flex-1">{formatCents(band.monthly_amount_cents)}/mo</span>
              {isMeta && (meta as AgeBandWithMeta).account_id && nestEggAccounts && (
                <span className="text-slate-400 truncate max-w-[100px]">
                  → {nestEggAccounts.find(a => a.id === (meta as AgeBandWithMeta).account_id)?.label ?? 'Account'}
                </span>
              )}
              {meta.needs_review && (
                <button
                  onClick={() => clearNeedsReview(band.id)}
                  title="This band was auto-created and may need review based on recent changes to Bucket 1 income. Click to mark as reviewed."
                  className="text-amber-500 hover:text-amber-700 shrink-0"
                >
                  ⚠
                </button>
              )}
              {depletionAge && band.start_age < depletionAge && band.end_age >= depletionAge && (
                <span className="text-red-500 text-xs shrink-0" title={`Bucket depletes at age ${depletionAge}`}>
                  ⚠ depletes {depletionAge}
                </span>
              )}
              <button onClick={() => setEditingId(band.id)} className={`shrink-0 ${colorCls.btn}`}>Edit</button>
              {bands.length > 1 && (
                <button onClick={() => setConfirmDeleteId(band.id)} className="shrink-0 text-slate-400 hover:text-red-500">✕</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add band button */}
      {!adding && (
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
  onSave,
  onCancel,
}: {
  band: AgeBand | AgeBandWithMeta
  isMeta: boolean
  nestEggAccounts?: Array<{ id: string; label: string }>
  color: 'blue' | 'red'
  onSave: (updates: Partial<AgeBand & AgeBandWithMeta>) => void
  onCancel: () => void
}) {
  const meta = band as AgeBandWithMeta
  const [amount, setAmount] = useState(band.monthly_amount_cents)
  const [accountId, setAccountId] = useState(meta.account_id ?? '')

  const ringColor = color === 'blue' ? 'focus:ring-blue-500' : 'focus:ring-red-500'

  return (
    <div className={`border ${color === 'blue' ? 'border-blue-300' : 'border-red-300'} rounded-lg p-2.5 bg-white text-xs space-y-2`}>
      <div className="text-slate-500 font-medium">Age {band.start_age}–{band.end_age}</div>
      <CurrencyInput
        value={amount}
        onChange={setAmount}
        className="text-xs"
      />
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
      <div className="flex justify-between pt-1">
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">Cancel</button>
        <button
          onClick={() => onSave({ monthly_amount_cents: amount, account_id: accountId || null })}
          className={`px-3 py-1 rounded font-semibold text-white text-xs ${color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          Save
        </button>
      </div>
    </div>
  )
}
