'use client'
import { useState } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import type { Scenario } from '@/app/clients/[clientId]/page'
import type { FullCalculationResult } from '@/lib/calculations'

interface Props {
  transitionAges: number[]
  calcResult: FullCalculationResult
  scenario: Scenario
  onScenarioUpdate: (updates: Partial<Scenario>) => Promise<void>
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export default function TransitionEventsPanel({ transitionAges, calcResult, scenario, onScenarioUpdate }: Props) {
  const [saving, setSaving] = useState<number | null>(null)

  // Find income at each transition age from longevity projection
  function incomeAtAge(age: number): number {
    const snap = calcResult.longevityProjection.find(s => s.age === age)
    return snap?.bucket1IncomeCents ?? 0
  }

  async function saveEvent(age: number, b2Cents: number, b3Cents: number) {
    setSaving(age)
    const existing = scenario.transition_events ?? {}
    await onScenarioUpdate({
      transition_events: {
        ...existing,
        [String(age)]: {
          bucket2_deposit_cents: b2Cents,
          bucket3_repayment_cents: b3Cents,
          notes: existing[String(age)]?.notes,
        },
      },
    })
    setSaving(null)
  }

  if (transitionAges.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="font-semibold text-slate-700 mb-3">
        Age-Triggered Reallocation — Move Income Gains Into Buckets
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        When Bucket 1 income increases (e.g., Social Security kicks in), you can reallocate those gains into Bucket 2 or Bucket 3.
      </p>
      <div className="space-y-3">
        {transitionAges.map(age => {
          const ev = scenario.transition_events?.[String(age)]
          const b2 = ev?.bucket2_deposit_cents ?? 0
          const b3 = ev?.bucket3_repayment_cents ?? 0
          const newIncome = incomeAtAge(age)
          return (
            <TransitionRow
              key={age}
              age={age}
              newIncomeCents={newIncome}
              initialB2={b2}
              initialB3={b3}
              saving={saving === age}
              onSave={(b2Cents, b3Cents) => saveEvent(age, b2Cents, b3Cents)}
            />
          )
        })}
      </div>
    </div>
  )
}

function TransitionRow({
  age, newIncomeCents, initialB2, initialB3, saving, onSave,
}: {
  age: number
  newIncomeCents: number
  initialB2: number
  initialB3: number
  saving: boolean
  onSave: (b2: number, b3: number) => void
}) {
  const [b2, setB2] = useState(initialB2)
  const [b3, setB3] = useState(initialB3)

  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-700">
          Age {age} — Income changes to {formatCents(newIncomeCents)}/mo
        </div>
        <button
          onClick={() => onSave(b2, b3)}
          disabled={saving}
          className="text-xs bg-slate-700 hover:bg-slate-800 text-white px-2.5 py-1 rounded font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <CurrencyInput
            label="One-time Bucket 2 deposit"
            value={b2}
            onChange={setB2}
            className="text-xs"
          />
          <p className="text-xs text-slate-400 mt-0.5">Added to nest egg at this age</p>
        </div>
        <div>
          <CurrencyInput
            label="One-time Bucket 3 repayment"
            value={b3}
            onChange={setB3}
            className="text-xs"
          />
          <p className="text-xs text-slate-400 mt-0.5">Restores line of credit at this age</p>
        </div>
      </div>
    </div>
  )
}
