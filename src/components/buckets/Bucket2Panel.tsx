'use client'
import { useState } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import PercentInput from '@/components/ui/PercentInput'
import type { NestEggAccount, Scenario } from '@/app/clients/[clientId]/page'
import type { FullCalculationResult } from '@/lib/calculations'

interface ClientData {
  id: string
  first_name: string
  target_retirement_age: number
  nest_egg_accounts: NestEggAccount[]
}

interface Props {
  client: ClientData
  scenario: Scenario
  calcResult: FullCalculationResult | null
  onUpdate: () => Promise<void>
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export default function Bucket2Panel({ client, scenario, calcResult, onUpdate }: Props) {
  const [addingAccount, setAddingAccount] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const totalCurrent = client.nest_egg_accounts.reduce((s, a) => s + a.current_balance_cents, 0)
  const totalProjected = calcResult?.accumulationPhase.totalProjectedNestEggCents ?? 0
  const totalDraw = client.nest_egg_accounts.reduce((s, a) => s + a.monthly_draw_cents, 0)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <h2 className="font-semibold text-slate-800">Investment Assets — Bucket 2</h2>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Qualified (401k, IRA) and non-qualified (brokerage, savings) accounts.</p>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Current Balance', value: formatCents(totalCurrent), color: 'text-blue-800' },
          { label: `At Age ${client.target_retirement_age}`, value: formatCents(totalProjected), color: 'text-blue-800' },
          { label: 'Monthly Draw', value: `${formatCents(totalDraw)}/mo`, color: 'text-blue-800' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-blue-50 rounded-lg p-2.5 text-center">
            <div className="text-xs text-slate-500 mb-0.5">{label}</div>
            <div className={`font-bold text-sm ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Account List */}
      <div className="space-y-2">
        {client.nest_egg_accounts.map(account => {
          const projection = calcResult?.accumulationPhase.nestEggProjections.find(p => p.id === account.id)
          return (
            <AccountRow
              key={account.id}
              account={account}
              projectedBalance={projection?.projectedBalanceCents}
              isEditing={editingId === account.id}
              onEdit={() => setEditingId(account.id)}
              onSave={async (updates) => {
                await fetch(`/api/nest-egg/${account.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updates),
                })
                setEditingId(null)
                await onUpdate()
              }}
              onDelete={async () => {
                await fetch(`/api/nest-egg/${account.id}`, { method: 'DELETE' })
                await onUpdate()
              }}
              onCancel={() => setEditingId(null)}
            />
          )
        })}
      </div>

      {/* Add Account */}
      {addingAccount ? (
        <AddAccountForm
          clientId={client.id}
          onSave={async (data) => {
            await fetch('/api/nest-egg', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
            setAddingAccount(false)
            await onUpdate()
          }}
          onCancel={() => setAddingAccount(false)}
        />
      ) : (
        <button
          onClick={() => setAddingAccount(true)}
          className="w-full border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      )}

      {/* Tax Note */}
      {client.nest_egg_accounts.some(a => a.account_type === 'qualified') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Tax Note:</span> Withdrawals from qualified accounts (401k, IRA) may be subject to income tax. Consult a tax professional.
          </p>
        </div>
      )}
    </div>
  )
}

function AccountRow({ account, projectedBalance, isEditing, onEdit, onSave, onDelete, onCancel }: {
  account: NestEggAccount
  projectedBalance?: number
  isEditing: boolean
  onEdit: () => void
  onSave: (updates: Partial<NestEggAccount>) => Promise<void>
  onDelete: () => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    label: account.label,
    account_type: account.account_type,
    current_balance_cents: account.current_balance_cents,
    monthly_contribution_cents: account.monthly_contribution_cents,
    rate_of_return_bps: account.rate_of_return_bps,
    monthly_draw_cents: account.monthly_draw_cents,
  })

  if (isEditing) {
    return (
      <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Account Label</label>
            <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Account Type</label>
            <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value as NestEggAccount['account_type'] }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="qualified">Qualified (401k, IRA)</option>
              <option value="non_qualified">Non-Qualified</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CurrencyInput label="Current Balance" value={form.current_balance_cents} onChange={v => setForm(f => ({ ...f, current_balance_cents: v }))} />
          <CurrencyInput label="Monthly Contribution" value={form.monthly_contribution_cents} onChange={v => setForm(f => ({ ...f, monthly_contribution_cents: v }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PercentInput label="Annual Rate of Return" value={form.rate_of_return_bps} onChange={v => setForm(f => ({ ...f, rate_of_return_bps: v }))} />
          <CurrencyInput label="Monthly Draw in Retirement" value={form.monthly_draw_cents} onChange={v => setForm(f => ({ ...f, monthly_draw_cents: v }))} />
        </div>
        <div className="flex justify-between">
          <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          <div className="flex gap-2">
            <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">Delete</button>
            <button onClick={() => onSave(form)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Save</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-lg p-2.5 bg-white hover:bg-slate-50 group cursor-pointer" onClick={onEdit}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 truncate">{account.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              account.account_type === 'qualified'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {account.account_type === 'qualified' ? 'Qualified' : 'Non-Qual'}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {(account.rate_of_return_bps / 100).toFixed(1)}% return • {formatCents(account.monthly_contribution_cents)}/mo contribution
          </div>
        </div>
        <div className="text-right ml-3 shrink-0">
          <div className="text-sm font-bold text-blue-700">{formatCents(account.current_balance_cents)}</div>
          {projectedBalance !== undefined && (
            <div className="text-xs text-slate-500">→ {formatCents(projectedBalance)} at retirement</div>
          )}
          {account.monthly_draw_cents > 0 && (
            <div className="text-xs text-blue-600 font-medium">Draw: {formatCents(account.monthly_draw_cents)}/mo</div>
          )}
        </div>
      </div>
    </div>
  )
}

function AddAccountForm({ clientId, onSave, onCancel }: {
  clientId: string
  onSave: (data: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    label: '',
    account_type: 'qualified',
    current_balance_cents: 0,
    monthly_contribution_cents: 0,
    rate_of_return_bps: 700,
    monthly_draw_cents: 0,
  })

  return (
    <div className="border-2 border-dashed border-blue-300 rounded-lg p-3 bg-blue-50 space-y-2">
      <p className="text-xs font-medium text-blue-800">New Account</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Label</label>
          <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="e.g. John's 401(k)"
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
          <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="qualified">Qualified (401k, IRA)</option>
            <option value="non_qualified">Non-Qualified</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CurrencyInput label="Current Balance" value={form.current_balance_cents} onChange={v => setForm(f => ({ ...f, current_balance_cents: v }))} />
        <CurrencyInput label="Monthly Contribution" value={form.monthly_contribution_cents} onChange={v => setForm(f => ({ ...f, monthly_contribution_cents: v }))} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PercentInput label="Annual Rate of Return" value={form.rate_of_return_bps} onChange={v => setForm(f => ({ ...f, rate_of_return_bps: v }))} />
        <CurrencyInput label="Monthly Draw in Retirement" value={form.monthly_draw_cents} onChange={v => setForm(f => ({ ...f, monthly_draw_cents: v }))} />
      </div>
      <div className="flex justify-between pt-1">
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
        <button
          onClick={() => onSave({ client_id: clientId, ...form })}
          disabled={!form.label}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:bg-blue-300"
        >
          Add Account
        </button>
      </div>
    </div>
  )
}
