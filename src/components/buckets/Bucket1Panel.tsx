'use client'
import { useState } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import type { IncomeItem, Scenario } from '@/app/clients/[clientId]/page'

interface ClientData {
  id: string
  first_name: string
  last_name: string
  age: number
  spouse_name: string | null
  marital_status: string
  target_retirement_age: number
  income_items: IncomeItem[]
}

interface Props {
  client: ClientData
  scenario: Scenario
  onUpdate: () => Promise<void>
  onScenarioUpdate: (updates: Partial<Scenario>) => Promise<void>
}

const INCOME_TYPE_LABELS: Record<string, string> = {
  social_security: 'Social Security',
  wage: 'Wage',
  commission: 'Commission',
  business: 'Business Income',
  pension: 'Pension',
  other: 'Other',
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export default function Bucket1Panel({ client, scenario, onUpdate, onScenarioUpdate }: Props) {
  const [addingItem, setAddingItem] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isMarried = client.marital_status !== 'single'

  const ssPrimary = client.income_items.find(i => i.type === 'social_security' && i.owner === 'primary')
  const ssSpouse = client.income_items.find(i => i.type === 'social_security' && i.owner === 'spouse')
  const otherItems = client.income_items.filter(i => i.type !== 'social_security')

  const bridgePrimary = scenario.ss_primary_claim_age > client.target_retirement_age
  const bridgeSpouse = isMarried && scenario.ss_spouse_claim_age > client.target_retirement_age
  const hasBridge = bridgePrimary || bridgeSpouse

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <h2 className="font-semibold text-slate-800">Income Sources — Bucket 1</h2>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Social Security, wages, pensions, and all recurring income streams.</p>

      {/* Social Security — Primary */}
      <SSSection
        title={`${client.first_name}'s Social Security`}
        item={ssPrimary ?? null}
        clientId={client.id}
        owner="primary"
        claimAge={scenario.ss_primary_claim_age}
        onClaimAgeChange={age => onScenarioUpdate({ ss_primary_claim_age: age })}
        onUpdate={onUpdate}
      />

      {/* Social Security — Spouse */}
      {isMarried && (
        <SSSection
          title={`${client.spouse_name ?? 'Spouse'}'s Social Security`}
          item={ssSpouse ?? null}
          clientId={client.id}
          owner="spouse"
          claimAge={scenario.ss_spouse_claim_age}
          onClaimAgeChange={age => onScenarioUpdate({ ss_spouse_claim_age: age })}
          onUpdate={onUpdate}
        />
      )}

      {/* Bridge Period Alert */}
      {hasBridge && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-amber-800 text-sm font-medium mb-1">SS Deferral Bridge Period</p>
          <p className="text-amber-700 text-xs">
            {bridgePrimary && `${client.first_name} defers SS from age ${client.target_retirement_age} to ${scenario.ss_primary_claim_age}. `}
            {bridgeSpouse && `${client.spouse_name ?? 'Spouse'} defers SS from age ${client.target_retirement_age} to ${scenario.ss_spouse_claim_age}. `}
            The income gap must be funded from another bucket.
          </p>
          <div className="mt-2">
            <label className="text-xs font-medium text-amber-800">Bridge Funding Source:</label>
            <select
              value={scenario.bridge_funding_source ?? 'bucket2'}
              onChange={e => onScenarioUpdate({ bridge_funding_source: e.target.value as Scenario['bridge_funding_source'] })}
              className="ml-2 text-xs border border-amber-300 rounded px-2 py-1 text-amber-800 bg-amber-50 focus:outline-none"
            >
              <option value="bucket1">Bucket 1 (Other Income)</option>
              <option value="bucket2">Bucket 2 (Nest Egg)</option>
              <option value="bucket3">Bucket 3 (HECM)</option>
            </select>
          </div>
        </div>
      )}

      {/* Other Income Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-700">Additional Income Sources</h3>
          <button
            onClick={() => setAddingItem(true)}
            className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Income Source
          </button>
        </div>

        {otherItems.length === 0 && !addingItem && (
          <p className="text-xs text-slate-400 italic py-2">No additional income sources added yet.</p>
        )}

        <div className="space-y-2">
          {otherItems.map(item => (
            <IncomeItemRow
              key={item.id}
              item={item}
              isEditing={editingId === item.id}
              onEdit={() => setEditingId(item.id)}
              onSave={async (updates) => {
                setSaving(true)
                await fetch(`/api/income-items/${item.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updates),
                })
                setEditingId(null)
                await onUpdate()
                setSaving(false)
              }}
              onDelete={async () => {
                await fetch(`/api/income-items/${item.id}`, { method: 'DELETE' })
                await onUpdate()
              }}
              onCancel={() => setEditingId(null)}
            />
          ))}
        </div>

        {addingItem && (
          <AddIncomeItemForm
            clientId={client.id}
            isMarried={isMarried}
            spouseName={client.spouse_name}
            onSave={async (data) => {
              setSaving(true)
              await fetch('/api/income-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })
              setAddingItem(false)
              await onUpdate()
              setSaving(false)
            }}
            onCancel={() => setAddingItem(false)}
          />
        )}
      </div>
    </div>
  )
}

// SS Section Component
function SSSection({
  title, item, clientId, owner, claimAge, onClaimAgeChange, onUpdate,
}: {
  title: string
  item: IncomeItem | null
  clientId: string
  owner: 'primary' | 'spouse'
  claimAge: number
  onClaimAgeChange: (age: number) => void
  onUpdate: () => Promise<void>
}) {
  const [editing, setEditing] = useState(!item)
  const [form, setForm] = useState({
    ss_age62_cents: item?.ss_age62_cents ?? 0,
    ss_age67_cents: item?.ss_age67_cents ?? 0,
    ss_age70_cents: item?.ss_age70_cents ?? 0,
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const monthlyAmount = claimAge === 62 ? form.ss_age62_cents
      : claimAge === 70 ? form.ss_age70_cents : form.ss_age67_cents

    if (item) {
      await fetch(`/api/income-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monthly_amount_cents: monthlyAmount, ss_claim_age: claimAge }),
      })
    } else {
      await fetch('/api/income-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          owner,
          type: 'social_security',
          label: title,
          monthly_amount_cents: monthlyAmount,
          start_age: claimAge,
          ss_claim_age: claimAge,
          ...form,
        }),
      })
    }
    setSaving(false)
    setEditing(false)
    await onUpdate()
  }

  const selectedAmount = claimAge === 62 ? form.ss_age62_cents
    : claimAge === 70 ? form.ss_age70_cents : form.ss_age67_cents

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-green-800">{title}</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-green-700 hover:text-green-800 underline">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <p className="text-xs text-green-700 italic">Enter amounts from client's Social Security statement.</p>
          <div className="grid grid-cols-3 gap-2">
            <CurrencyInput label="At age 62" value={form.ss_age62_cents} onChange={v => setForm(f => ({ ...f, ss_age62_cents: v }))} />
            <CurrencyInput label="At age 67 (FRA)" value={form.ss_age67_cents} onChange={v => setForm(f => ({ ...f, ss_age67_cents: v }))} />
            <CurrencyInput label="At age 70" value={form.ss_age70_cents} onChange={v => setForm(f => ({ ...f, ss_age70_cents: v }))} />
          </div>
          <div className="flex justify-between mt-2">
            <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={save} disabled={saving} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:bg-green-400">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-700">Claim Age:</span>
            {[62, 67, 70].map(age => (
              <button
                key={age}
                onClick={() => onClaimAgeChange(age)}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                  claimAge === age ? 'bg-green-600 text-white' : 'bg-white border border-green-300 text-green-700 hover:bg-green-100'
                }`}
              >
                {age}
              </button>
            ))}
          </div>
          <div className="text-lg font-bold text-green-800">
            {selectedAmount ? `${formatCents(selectedAmount)}/mo` : <span className="text-slate-400 text-sm italic">Not entered</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// Income Item Row Component
function IncomeItemRow({ item, isEditing, onEdit, onSave, onDelete, onCancel }: {
  item: IncomeItem
  isEditing: boolean
  onEdit: () => void
  onSave: (updates: Partial<IncomeItem>) => Promise<void>
  onDelete: () => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    label: item.label,
    type: item.type,
    owner: item.owner,
    monthly_amount_cents: item.monthly_amount_cents,
    start_age: item.start_age,
    end_age: item.end_age,
    pension_survivor_pct: item.pension_survivor_pct ?? 0,
  })

  if (isEditing) {
    return (
      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Label</label>
            <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as IncomeItem['type'] }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500">
              {Object.entries(INCOME_TYPE_LABELS).filter(([k]) => k !== 'social_security').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <CurrencyInput label="Monthly Amount" value={form.monthly_amount_cents} onChange={v => setForm(f => ({ ...f, monthly_amount_cents: v }))} />
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Start Age</label>
            <input type="number" value={form.start_age} onChange={e => setForm(f => ({ ...f, start_age: parseInt(e.target.value) }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">End Age (blank = forever)</label>
            <input type="number" value={form.end_age ?? ''} onChange={e => setForm(f => ({ ...f, end_age: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="—"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        {form.type === 'pension' && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Survivor Benefit %</label>
            <input type="number" value={form.pension_survivor_pct} onChange={e => setForm(f => ({ ...f, pension_survivor_pct: parseInt(e.target.value) }))}
              min={0} max={100}
              className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <span className="text-xs text-slate-500 ml-1">% of full pension to surviving spouse</span>
          </div>
        )}
        <div className="flex justify-between">
          <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          <button onClick={() => onSave({ ...form, pension_survivor_pct: form.type === 'pension' ? form.pension_survivor_pct * 100 : null })}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 group">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{item.label}</div>
        <div className="text-xs text-slate-500">
          {INCOME_TYPE_LABELS[item.type]} • {item.owner} •
          Age {item.start_age}{item.end_age ? `–${item.end_age}` : '+'}
        </div>
      </div>
      <div className="flex items-center gap-3 ml-3">
        <span className="text-sm font-semibold text-green-700">{formatCents(item.monthly_amount_cents)}/mo</span>
        <button onClick={onEdit} className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button onClick={onDelete} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Add Income Item Form
function AddIncomeItemForm({ clientId, isMarried, spouseName, onSave, onCancel }: {
  clientId: string
  isMarried: boolean
  spouseName: string | null
  onSave: (data: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    label: '',
    type: 'wage',
    owner: 'primary',
    monthly_amount_cents: 0,
    start_age: 62,
    end_age: '' as string | number,
    pension_survivor_pct: 0,
  })

  return (
    <div className="border-2 border-dashed border-green-300 rounded-lg p-3 mt-2 bg-green-50 space-y-2">
      <p className="text-xs font-medium text-green-800">New Income Source</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Label</label>
          <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="e.g. Part-time Work"
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {Object.entries(INCOME_TYPE_LABELS).filter(([k]) => k !== 'social_security').map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <CurrencyInput label="Monthly Amount" value={form.monthly_amount_cents} onChange={v => setForm(f => ({ ...f, monthly_amount_cents: v }))} />
        {isMarried && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Owner</label>
            <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="primary">Primary</option>
              <option value="spouse">{spouseName ?? 'Spouse'}</option>
              <option value="joint">Joint</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Start Age</label>
          <input type="number" value={form.start_age} onChange={e => setForm(f => ({ ...f, start_age: parseInt(e.target.value) }))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">End Age</label>
          <input type="number" value={form.end_age} onChange={e => setForm(f => ({ ...f, end_age: e.target.value ? parseInt(e.target.value) : '' }))}
            placeholder="Forever"
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
      {form.type === 'pension' && (
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Survivor Benefit %</label>
          <input type="number" value={form.pension_survivor_pct} onChange={e => setForm(f => ({ ...f, pension_survivor_pct: parseInt(e.target.value) }))}
            min={0} max={100}
            className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      )}
      <div className="flex justify-between pt-1">
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
        <button
          onClick={() => onSave({
            client_id: clientId,
            owner: form.owner,
            type: form.type,
            label: form.label,
            monthly_amount_cents: form.monthly_amount_cents,
            start_age: form.start_age,
            end_age: form.end_age === '' ? null : form.end_age,
            pension_survivor_pct: form.type === 'pension' ? form.pension_survivor_pct * 100 : null,
          })}
          disabled={!form.label}
          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:bg-green-300"
        >
          Add Income Source
        </button>
      </div>
    </div>
  )
}
