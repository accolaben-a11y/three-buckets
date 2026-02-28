'use client'
import { useState, useCallback } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import LongevityChart from './LongevityChart'
import type { Scenario } from '@/app/clients/[clientId]/page'
import type { FullCalculationResult } from '@/lib/calculations'

interface ClientData {
  id: string
  first_name: string
  last_name: string
  age: number
  target_retirement_age: number
  home_equity: {
    existing_mortgage_payment_cents: number
    hecm_payout_type: string
    hecm_payoff_mortgage: boolean
  } | null
  nest_egg_accounts: Array<{ id: string; label: string; monthly_draw_cents: number }>
  income_items: Array<{
    type: string
    monthly_amount_cents: number
    ss_age62_cents: number | null
    ss_age67_cents: number | null
    ss_age70_cents: number | null
    ss_claim_age: number | null
  }>
}

interface Props {
  client: ClientData
  scenario: Scenario
  calcResult: FullCalculationResult | null
  calcLoading: boolean
  survivorMode: boolean
  onScenarioUpdate: (updates: Partial<Scenario>) => Promise<void>
  onExportPDF: () => void
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export default function CashFlowDashboard({
  client, scenario, calcResult, calcLoading, survivorMode, onScenarioUpdate, onExportPDF
}: Props) {
  const [editingTarget, setEditingTarget] = useState(false)

  const grossTargetCents = calcResult?.dashboard.grossTargetCents ?? scenario.target_monthly_income_cents
  const adjustedTargetCents = calcResult?.dashboard.adjustedTargetCents ?? scenario.target_monthly_income_cents

  const hecmPayoffActive =
    (client.home_equity?.existing_mortgage_payment_cents ?? 0) > 0 &&
    client.home_equity?.hecm_payout_type === 'lump_sum' &&
    client.home_equity?.hecm_payoff_mortgage === true
  const mortgageFreed = calcResult?.dashboard.mortgageFreedCents ?? 0

  // Show before/after banner when mortgage is being eliminated by HECM and it changes the target
  const showMortgageBanner = hecmPayoffActive && mortgageFreed > 0 && grossTargetCents !== adjustedTargetCents

  const totalIncome = calcResult?.dashboard.totalMonthlyIncomeCents ?? 0
  const target = adjustedTargetCents
  const shortfall = Math.max(0, target - totalIncome)
  const surplus = Math.max(0, totalIncome - target)

  const allocatedDeposits = (scenario.bucket2_deposit_cents ?? 0) + (scenario.bucket3_repayment_cents ?? 0)
  const unallocatedSurplus = Math.max(0, surplus - allocatedDeposits)

  const b1Max = client.income_items.reduce((sum, item) => {
    if (item.type === 'social_security') {
      const claimAge = scenario.ss_primary_claim_age
      const amount = claimAge === 62 ? item.ss_age62_cents
        : claimAge === 70 ? item.ss_age70_cents
        : item.ss_age67_cents
      return sum + (amount ?? item.monthly_amount_cents)
    }
    return sum + item.monthly_amount_cents
  }, 0)

  const b2Max = client.nest_egg_accounts.reduce((s, a) => s + a.monthly_draw_cents, 0)

  const b3HasLoc = (calcResult?.hecm?.locStartBalanceCents ?? 0) > 0
  const b3IsTenure = client.home_equity?.hecm_payout_type === 'tenure'

  const b3Max = b3IsTenure
    ? (calcResult?.hecm?.tenureMonthlyCents ?? 0)
    : b3HasLoc
      ? scenario.bucket3_draw_cents + 50000
      : 0

  const updateDraw = useCallback(async (bucket: 1 | 2 | 3, cents: number) => {
    const key = `bucket${bucket}_draw_cents` as keyof Scenario
    await onScenarioUpdate({ [key]: cents })
  }, [onScenarioUpdate])

  const depletionAges = calcResult?.depletionAges

  // Validate surplus deposits
  const depositTotal = (scenario.bucket2_deposit_cents ?? 0) + (scenario.bucket3_repayment_cents ?? 0)
  const depositExceedsSurplus = surplus > 0 && depositTotal > surplus

  return (
    <div className="p-5 space-y-4">
      {/* ── BEFORE/AFTER MORTGAGE BANNER ── */}
      {showMortgageBanner && (
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="bg-slate-100 px-5 py-3 flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 shrink-0">WITHOUT HECM</span>
            <span className="text-sm text-slate-700">
              Cash flow needed <span className="font-medium">(with mortgage): {formatCents(grossTargetCents)}/mo</span>
            </span>
          </div>
          <div className="bg-green-600 text-white px-5 py-3 flex items-start gap-3">
            <span className="text-xs font-semibold text-green-200 uppercase tracking-wider w-28 shrink-0 pt-0.5">✓ WITH HECM</span>
            <div>
              <div className="text-sm">
                Cash flow needed <span className="font-semibold">(after HECM — mortgage gone): {formatCents(adjustedTargetCents)}/mo</span>
              </div>
              <div className="text-green-200 text-xs mt-0.5">
                You free up {formatCents(mortgageFreed)}/mo — {formatCents(mortgageFreed * 12)}/yr
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TARGET INCOME ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
              {hecmPayoffActive ? 'Gross Monthly Income Target (incl. current mortgage)' : 'Target Monthly Income in Retirement'}
            </div>
            {editingTarget ? (
              <CurrencyInput
                value={scenario.target_monthly_income_cents}
                onChange={async v => { await onScenarioUpdate({ target_monthly_income_cents: v }); setEditingTarget(false) }}
                className="w-48"
              />
            ) : (
              <div
                className="text-3xl font-bold text-slate-800 cursor-pointer hover:text-blue-600"
                onClick={() => setEditingTarget(true)}
              >
                {formatCents(scenario.target_monthly_income_cents)}/mo
              </div>
            )}
            {hecmPayoffActive && adjustedTargetCents !== grossTargetCents && (
              <div className="text-xs text-green-700 font-medium mt-1">
                Adjusted Target with HECM: {formatCents(adjustedTargetCents)}/mo (mortgage eliminated)
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Total Sourced</div>
            <div className={`text-2xl font-bold ${calcLoading ? 'text-slate-400' : 'text-slate-800'}`}>
              {calcLoading ? '…' : formatCents(totalIncome)}/mo
            </div>
          </div>
        </div>

        {/* Shortfall / Surplus Indicator */}
        {!calcLoading && (
          <div className="mt-3">
            {shortfall > 0 ? (
              <div className="rounded-lg px-3 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                ⚠ Shortfall: {formatCents(shortfall)}/month
              </div>
            ) : unallocatedSurplus > 0 ? (
              <div className="rounded-lg px-3 py-2 text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                ↑ Surplus available to reinvest: {formatCents(unallocatedSurplus)}/month
              </div>
            ) : totalIncome >= target ? (
              <div className="rounded-lg px-3 py-2 text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                ✓ Fully allocated
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── THREE BUCKET SLIDERS ── */}
      <div className="grid grid-cols-3 gap-3">
        <BucketSlider
          bucket={1}
          label="Bucket 1 — Income"
          color="green"
          value={scenario.bucket1_draw_cents}
          maxValue={Math.max(b1Max, scenario.bucket1_draw_cents)}
          onChange={v => updateDraw(1, v)}
          depletionAge={null}
        />
        <BucketSlider
          bucket={2}
          label="Bucket 2 — Nest Egg"
          color="blue"
          value={scenario.bucket2_draw_cents}
          maxValue={Math.max(b2Max, scenario.bucket2_draw_cents)}
          onChange={v => updateDraw(2, v)}
          depletionAge={depletionAges?.bucket2DepletionAge ?? null}
          depositCents={scenario.bucket2_deposit_cents ?? 0}
          onDepositChange={v => onScenarioUpdate({ bucket2_deposit_cents: v })}
          depositAccounts={client.nest_egg_accounts.length > 1 ? client.nest_egg_accounts : undefined}
          depositAccountId={scenario.bucket2_deposit_account_id}
          onDepositAccountChange={id => onScenarioUpdate({ bucket2_deposit_account_id: id })}
          depositError={depositExceedsSurplus ? 'Deposit exceeds available surplus.' : undefined}
        />
        <BucketSlider
          bucket={3}
          label="Bucket 3 — Home Equity"
          color="red"
          value={scenario.bucket3_draw_cents}
          maxValue={Math.max(b3Max, scenario.bucket3_draw_cents)}
          onChange={v => updateDraw(3, v)}
          depletionAge={depletionAges?.bucket3DepletionAge ?? null}
          disabled={!b3HasLoc && !b3IsTenure}
          locStartBalanceCents={b3HasLoc ? (calcResult?.hecm?.locStartBalanceCents ?? 0) : undefined}
          repaymentCents={b3HasLoc ? (scenario.bucket3_repayment_cents ?? 0) : undefined}
          onRepaymentChange={b3HasLoc ? (v => onScenarioUpdate({ bucket3_repayment_cents: v })) : undefined}
          repaymentError={depositExceedsSurplus ? 'Deposit exceeds available surplus.' : undefined}
          noLocReason={
            !b3HasLoc && !b3IsTenure
              ? (client.home_equity?.hecm_payout_type === 'lump_sum'
                  ? 'No LOC — lump sum used for mortgage payoff'
                  : 'No HECM configured')
              : undefined
          }
        />
      </div>

      {/* Depletion Warnings */}
      {depletionAges?.bucket2DepletionAge && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
          ⚠ Bucket 2 (Nest Egg) depletes at age {depletionAges.bucket2DepletionAge}. Reallocate draw to continue meeting income target.
        </div>
      )}
      {depletionAges?.bucket3DepletionAge && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
          ⚠ Bucket 3 (Home Equity LOC) depletes at age {depletionAges.bucket3DepletionAge}. Reallocate draw to continue meeting income target.
        </div>
      )}

      {/* ── LONGEVITY CHART ── */}
      {calcResult && calcResult.longevityProjection.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-3">Longevity Projection — How Long Each Bucket Lasts</h3>
          <LongevityChart
            data={calcResult.longevityProjection}
            retirementAge={client.target_retirement_age}
            depletionAges={calcResult.depletionAges}
          />
        </div>
      )}

      {/* ── BRIDGE PERIOD ── */}
      {calcResult?.bridgePeriod.hasBridgePeriod && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-2">SS Deferral Bridge Period</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-center">
              <div className="text-xs text-slate-500">Bridge Duration</div>
              <div className="font-bold text-slate-800">
                {calcResult.bridgePeriod.bridgeEndAge - calcResult.bridgePeriod.bridgeStartAge} years
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500">Monthly Gap</div>
              <div className="font-bold text-amber-700">{formatCents(calcResult.bridgePeriod.monthlyGapCents)}/mo</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500">Total Bridge Cost</div>
              <div className="font-bold text-amber-700">{formatCents(calcResult.bridgePeriod.totalBridgeCostCents)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACCUMULATION PHASE ── */}
      {calcResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-3">
            Accumulation Phase — Age {client.age} to {client.target_retirement_age}
          </h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-center bg-slate-50 rounded-lg p-2">
              <div className="text-xs text-slate-500">Current Nest Egg</div>
              <div className="font-bold text-blue-700">{formatCents(calcResult.accumulationPhase.totalCurrentNestEggCents)}</div>
            </div>
            <div className="text-center bg-slate-50 rounded-lg p-2">
              <div className="text-xs text-slate-500">Projected at Age {client.target_retirement_age}</div>
              <div className="font-bold text-blue-700">{formatCents(calcResult.accumulationPhase.totalProjectedNestEggCents)}</div>
            </div>
            <div className="text-center bg-slate-50 rounded-lg p-2">
              <div className="text-xs text-slate-500">Projected Home Value</div>
              <div className="font-bold text-red-700">{formatCents(calcResult.accumulationPhase.projectedHomeValueCents)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT PDF ── */}
      <div className="flex justify-end pb-4">
        <button
          onClick={onExportPDF}
          className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export PDF Report
        </button>
      </div>
    </div>
  )
}

// Bucket Slider Component
function BucketSlider({ bucket, label, color, value, maxValue, onChange, depletionAge, disabled,
  locStartBalanceCents, repaymentCents, onRepaymentChange, repaymentError, noLocReason,
  depositCents, onDepositChange, depositAccounts, depositAccountId, onDepositAccountChange, depositError,
}: {
  bucket: 1 | 2 | 3
  label: string
  color: 'green' | 'blue' | 'red'
  value: number
  maxValue: number
  onChange: (cents: number) => void
  depletionAge: number | null
  disabled?: boolean
  locStartBalanceCents?: number
  repaymentCents?: number
  onRepaymentChange?: (v: number) => void
  repaymentError?: string
  noLocReason?: string
  depositCents?: number
  onDepositChange?: (v: number) => void
  depositAccounts?: Array<{ id: string; label: string }>
  depositAccountId?: string | null
  onDepositAccountChange?: (id: string | null) => void
  depositError?: string
}) {
  const colorMap = {
    green: { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-200', light: 'bg-green-50', track: '#16a34a' },
    blue: { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-200', light: 'bg-blue-50', track: '#2563eb' },
    red: { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-200', light: 'bg-red-50', track: '#dc2626' },
  }
  const c = colorMap[color]

  const safeMax = Math.max(maxValue, 100)
  const pct = Math.min(100, (value / safeMax) * 100)

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value)
    const snapped = Math.round(raw / 5000) * 5000
    onChange(snapped)
  }

  return (
    <div className={`${c.light} border ${c.border} rounded-xl p-3 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-2.5 h-2.5 rounded-full ${c.bg} shrink-0`} />
        <span className="text-xs font-semibold text-slate-700 truncate">{label}</span>
      </div>

      {/* LOC Balance display for bucket 3 */}
      {locStartBalanceCents !== undefined && locStartBalanceCents > 0 && (
        <div className="text-xs text-slate-500 mb-1">
          LOC Balance: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(locStartBalanceCents / 100)}
        </div>
      )}

      <div className={`text-xl font-bold ${c.text} mb-2`}>
        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value / 100)}/mo
      </div>

      <div className="relative mb-2">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-1">
          <div className={`h-full ${c.bg} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={safeMax}
          step={5000}
          value={value}
          onChange={handleSlider}
          disabled={disabled}
          style={{ color: c.track }}
          className="w-full absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed h-2"
        />
      </div>

      <CurrencyInput
        value={value}
        onChange={v => onChange(Math.round(v / 5000) * 5000)}
        className="text-xs"
      />

      {depletionAge && (
        <div className="mt-1.5 text-xs text-red-600 font-medium">
          ⚠ Depletes at age {depletionAge}
        </div>
      )}

      {disabled && bucket === 3 && (
        <div className="mt-1.5 text-xs text-slate-500 italic">
          {noLocReason ?? 'No LOC established'}
        </div>
      )}

      {/* Bucket 2: surplus deposit field */}
      {bucket === 2 && onDepositChange !== undefined && (
        <div className="mt-2 pt-2 border-t border-blue-200 space-y-1.5">
          <CurrencyInput
            label="Monthly Surplus Deposit"
            value={depositCents ?? 0}
            onChange={onDepositChange}
            className="text-xs"
          />
          {depositAccounts && onDepositAccountChange && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-0.5 block">Deposit to Account</label>
              <select
                value={depositAccountId ?? ''}
                onChange={e => onDepositAccountChange(e.target.value || null)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Any account —</option>
                {depositAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>
          )}
          {depositError && <p className="text-xs text-red-600">{depositError}</p>}
        </div>
      )}

      {/* Bucket 3: voluntary LOC repayment field */}
      {bucket === 3 && onRepaymentChange !== undefined && (
        <div className="mt-2 pt-2 border-t border-red-200 space-y-1.5">
          <CurrencyInput
            label="Monthly LOC Repayment"
            value={repaymentCents ?? 0}
            onChange={onRepaymentChange}
            className="text-xs"
          />
          <p className="text-xs text-slate-500">Voluntary payments restore your line of credit</p>
          {repaymentError && <p className="text-xs text-red-600">{repaymentError}</p>}
        </div>
      )}
    </div>
  )
}
