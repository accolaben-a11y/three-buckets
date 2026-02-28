'use client'
import { useState, useEffect } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import PercentInput from '@/components/ui/PercentInput'
import type { HomeEquityData } from '@/app/clients/[clientId]/page'
import type { FullCalculationResult } from '@/lib/calculations'

interface ClientData {
  id: string
  age: number
  spouse_age: number | null
  target_retirement_age: number
  home_equity: HomeEquityData | null
  nest_egg_accounts: Array<{ id: string; label: string }>
}

interface Props {
  client: ClientData
  calcResult: FullCalculationResult | null
  onUpdate: () => Promise<void>
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

const PAYOUT_OPTIONS = [
  { value: 'none', label: 'None', desc: 'No HECM' },
  { value: 'lump_sum', label: 'Lump Sum', desc: 'One-time draw' },
  { value: 'loc', label: 'Line of Credit', desc: 'Growing credit line' },
  { value: 'tenure', label: 'Monthly Tenure', desc: 'Guaranteed monthly' },
]

export default function Bucket3Panel({ client, calcResult, onUpdate }: Props) {
  const he = client.home_equity
  const hecm = calcResult?.hecm

  const [form, setForm] = useState({
    current_home_value_cents: he?.current_home_value_cents ?? 0,
    existing_mortgage_balance_cents: he?.existing_mortgage_balance_cents ?? 0,
    existing_mortgage_payment_cents: he?.existing_mortgage_payment_cents ?? 0,
    home_appreciation_rate_bps: he?.home_appreciation_rate_bps ?? 400,
    hecm_expected_rate_bps: he?.hecm_expected_rate_bps ?? 550,
    hecm_payout_type: he?.hecm_payout_type ?? 'none',
    hecm_tenure_monthly_cents: he?.hecm_tenure_monthly_cents ?? 0,
    hecm_loc_growth_rate_bps: he?.hecm_loc_growth_rate_bps ?? 600,
    hecm_payoff_mortgage: he?.hecm_payoff_mortgage ?? false,
    hecm_principal_limit_cents: he?.hecm_principal_limit_cents ?? 0,
    hecm_additional_lump_sum_cents: he?.hecm_additional_lump_sum_cents ?? 0,
    hecm_cash_to_close_account_id: he?.hecm_cash_to_close_account_id ?? null as string | null,
  })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (he) {
      setForm({
        current_home_value_cents: he.current_home_value_cents,
        existing_mortgage_balance_cents: he.existing_mortgage_balance_cents,
        existing_mortgage_payment_cents: he.existing_mortgage_payment_cents,
        home_appreciation_rate_bps: he.home_appreciation_rate_bps,
        hecm_expected_rate_bps: he.hecm_expected_rate_bps,
        hecm_payout_type: he.hecm_payout_type,
        hecm_tenure_monthly_cents: he.hecm_tenure_monthly_cents,
        hecm_loc_growth_rate_bps: he.hecm_loc_growth_rate_bps,
        hecm_payoff_mortgage: he.hecm_payoff_mortgage,
        hecm_principal_limit_cents: he.hecm_principal_limit_cents,
        hecm_additional_lump_sum_cents: he.hecm_additional_lump_sum_cents,
        hecm_cash_to_close_account_id: he.hecm_cash_to_close_account_id,
      })
    }
  }, [he])

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/home-equity/${client.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setDirty(false)
    await onUpdate()
  }

  const hasMortgage = form.existing_mortgage_payment_cents > 0
  const showMortgagePayoff = form.hecm_payout_type === 'lump_sum' && hasMortgage

  const netProceeds = hecm?.availableProceedsCents ?? 0
  const isNetPositive = netProceeds >= 0
  const additionalLumpSumError = form.hecm_additional_lump_sum_cents > netProceeds
    ? `Cannot exceed net proceeds of ${formatCents(netProceeds)}`
    : null

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <h2 className="font-semibold text-slate-800">Home Equity — Bucket 3 (HECM)</h2>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Home equity accessed via HECM reverse mortgage.</p>

      {/* Property Inputs */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-700">Property Details</h3>
        <div className="grid grid-cols-2 gap-3">
          <CurrencyInput
            label="Current Home Value"
            value={form.current_home_value_cents}
            onChange={v => update('current_home_value_cents', v)}
          />
          <PercentInput
            label="Home Appreciation Rate"
            value={form.home_appreciation_rate_bps}
            onChange={v => update('home_appreciation_rate_bps', v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CurrencyInput
            label="Existing Mortgage Balance"
            value={form.existing_mortgage_balance_cents}
            onChange={v => update('existing_mortgage_balance_cents', v)}
          />
          <CurrencyInput
            label="Monthly P&I Payment"
            value={form.existing_mortgage_payment_cents}
            onChange={v => update('existing_mortgage_payment_cents', v)}
          />
        </div>
        <PercentInput
          label="HECM Expected Interest Rate (changes weekly — enter current rate)"
          value={form.hecm_expected_rate_bps}
          onChange={v => update('hecm_expected_rate_bps', v)}
          step={0.125}
        />
      </div>

      {/* HECM Payout Type */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">HECM Payout Type</h3>
        <div className="grid grid-cols-2 gap-2">
          {PAYOUT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update('hecm_payout_type', opt.value as HomeEquityData['hecm_payout_type'])}
              className={`p-2.5 rounded-lg border-2 text-left transition-colors ${
                form.hecm_payout_type === opt.value
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`text-sm font-semibold ${form.hecm_payout_type === opt.value ? 'text-red-700' : 'text-slate-700'}`}>
                {opt.label}
              </div>
              <div className="text-xs text-slate-500">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* HECM Results */}
      {hecm && form.hecm_payout_type !== 'none' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <h3 className="text-sm font-semibold text-red-800">HECM Calculation</h3>

          {/* Principal Limit — manual input replacing PLF table */}
          <CurrencyInput
            label="Principal Limit"
            value={form.hecm_principal_limit_cents}
            onChange={v => update('hecm_principal_limit_cents', v)}
            helperText="Enter the principal limit from HUD tables or your lender quote"
          />

          {/* Lump Sum */}
          {form.hecm_payout_type === 'lump_sum' && (
            <div className="space-y-2 pt-1">
              {showMortgagePayoff && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hecm_payoff_mortgage}
                    onChange={e => update('hecm_payoff_mortgage', e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-red-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-700">Use lump sum to pay off existing mortgage</div>
                    <div className="text-xs text-slate-500">Full Principal Limit available (60% restriction waived for mortgage payoff)</div>
                  </div>
                </label>
              )}

              {/* Net Proceeds display — color-coded */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">
                    {isNetPositive ? 'Available Net Proceeds' : 'Cash to Close Required'}
                  </div>
                  <div className={`font-bold text-lg ${isNetPositive ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCents(Math.abs(netProceeds))}
                  </div>
                </div>
                {hecm.monthlyFreedCents > 0 && (
                  <div>
                    <div className="text-xs text-slate-500">Monthly Cash Flow Freed</div>
                    <div className="font-bold text-green-700 text-lg">{formatCents(hecm.monthlyFreedCents)}/mo</div>
                  </div>
                )}
              </div>

              {/* Cash-to-close alert — negative net proceeds */}
              {!isNetPositive && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠ Cash to close of {formatCents(Math.abs(netProceeds))} required. Select which Bucket 2 account this will be drawn from.
                  </p>
                  {client.nest_egg_accounts.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Source Account</label>
                      <select
                        value={form.hecm_cash_to_close_account_id ?? ''}
                        onChange={e => update('hecm_cash_to_close_account_id', e.target.value || null)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="">— Select account —</option>
                        {client.nest_egg_accounts.map(acct => (
                          <option key={acct.id} value={acct.id}>{acct.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Positive net proceeds → LOC conversion */}
              {isNetPositive && netProceeds > 0 && (
                <div className="space-y-2">
                  <CurrencyInput
                    label="Additional Lump Sum Draw"
                    value={form.hecm_additional_lump_sum_cents}
                    onChange={v => update('hecm_additional_lump_sum_cents', v)}
                    helperText="Amount taken as cash at closing before remainder converts to LOC"
                  />
                  {additionalLumpSumError && (
                    <p className="text-xs text-red-600">{additionalLumpSumError}</p>
                  )}
                  <div>
                    <div className="text-xs text-slate-500">Remaining proceeds convert to LOC</div>
                    <div className="font-bold text-red-700">
                      {formatCents(Math.max(0, netProceeds - form.hecm_additional_lump_sum_cents))}
                    </div>
                  </div>
                </div>
              )}

              {/* LOC projections when lump_sum has converted LOC */}
              {hecm.locProjections.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Projected LOC Balance (no draws)</div>
                  <div className="grid grid-cols-4 gap-2">
                    {hecm.locProjections.map(p => (
                      <div key={p.age} className="text-center bg-white rounded border border-red-200 p-1.5">
                        <div className="text-xs text-slate-500">Age {p.age}</div>
                        <div className="text-xs font-bold text-red-700">{formatCents(p.balanceCents)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LOC */}
          {form.hecm_payout_type === 'loc' && (
            <div className="space-y-2 pt-1">
              <PercentInput
                label="LOC Growth Rate"
                value={form.hecm_loc_growth_rate_bps}
                onChange={v => update('hecm_loc_growth_rate_bps', v)}
              />
              <div>
                <div className="text-xs text-slate-500">Initial LOC Balance</div>
                <div className="font-bold text-red-700 text-lg">{formatCents(hecm.locStartBalanceCents)}</div>
              </div>
              {hecm.locProjections.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Projected LOC Balance (no draws)</div>
                  <div className="grid grid-cols-4 gap-2">
                    {hecm.locProjections.map(p => (
                      <div key={p.age} className="text-center bg-white rounded border border-red-200 p-1.5">
                        <div className="text-xs text-slate-500">Age {p.age}</div>
                        <div className="text-xs font-bold text-red-700">{formatCents(p.balanceCents)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tenure */}
          {form.hecm_payout_type === 'tenure' && (
            <div className="space-y-2 pt-1">
              <CurrencyInput
                label="Monthly Tenure Payment (from lender quote)"
                value={form.hecm_tenure_monthly_cents}
                onChange={v => update('hecm_tenure_monthly_cents', v)}
              />
              <p className="text-xs text-slate-500 italic">
                Tenure payments are guaranteed as long as at least one borrower occupies the home as primary residence.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {saving ? 'Saving…' : 'Save Home Equity Data'}
        </button>
      )}
    </div>
  )
}
