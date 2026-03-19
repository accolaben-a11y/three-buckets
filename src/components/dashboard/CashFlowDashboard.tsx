'use client'
import { useState, useRef } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import LongevityChart from './LongevityChart'
import Bucket1Summary from './Bucket1Summary'
import IncomeByAgeChart from './IncomeByAgeChart'
import AgeBandEditor from './AgeBandEditor'
import PresentationBucketCard from './PresentationBucketCard'
import AllocationBanner from './AllocationBanner'
import AllocationDrawer from './AllocationDrawer'
import type { AllocationMap } from './AllocationDrawer'
import type { Scenario } from '@/app/clients/[clientId]/page'
import type { FullCalculationResult } from '@/lib/calculations'
import { defaultAgeBands, type AgeBands } from '@/types/age-bands'

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
    hecm_loc_growth_rate_bps: number
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
  presentationMode: boolean
  hasUnresolvedShortfalls: boolean
  onScenarioUpdate: (updates: Partial<Scenario>) => Promise<void>
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export default function CashFlowDashboard({
  client, scenario, calcResult, calcLoading, survivorMode, presentationMode, hasUnresolvedShortfalls, onScenarioUpdate,
}: Props) {
  const [editingTarget, setEditingTarget] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerAllocations, setDrawerAllocations] = useState<AllocationMap>({})
  const incomeChartRef = useRef<HTMLDivElement>(null)
  const longevityChartRef = useRef<HTMLDivElement>(null)

  const ageBands: AgeBands = scenario.age_bands ?? defaultAgeBands(client.target_retirement_age, scenario.planning_horizon_age)

  async function handleExportPDF() {
    if (!scenario || pdfLoading) return
    setPdfLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      await new Promise(r => setTimeout(r, 1000))
      let bucket1ChartImage: string | null = null
      let longevityChartImage: string | null = null
      if (incomeChartRef.current) {
        const canvas = await html2canvas(incomeChartRef.current, { scale: 2, useCORS: true })
        bucket1ChartImage = canvas.toDataURL('image/png')
      }
      if (longevityChartRef.current) {
        const canvas = await html2canvas(longevityChartRef.current, { scale: 2, useCORS: true })
        longevityChartImage = canvas.toDataURL('image/png')
      }
      const res = await fetch(`/api/pdf/${client.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: scenario.id, bucket1ChartImage, longevityChartImage }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const today = new Date().toISOString().slice(0, 10)
        a.download = `${client.last_name}_${client.first_name}_RetirementPlan_${today}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setPdfLoading(false)
    }
  }

  const grossTargetCents = calcResult?.dashboard.grossTargetCents ?? scenario.target_monthly_income_cents
  const adjustedTargetCents = calcResult?.dashboard.adjustedTargetCents ?? scenario.target_monthly_income_cents

  const hecmPayoffActive =
    (client.home_equity?.existing_mortgage_payment_cents ?? 0) > 0 &&
    client.home_equity?.hecm_payout_type === 'lump_sum' &&
    client.home_equity?.hecm_payoff_mortgage === true
  const mortgageFreed = calcResult?.dashboard.mortgageFreedCents ?? 0
  const showMortgageBanner = hecmPayoffActive && mortgageFreed > 0 && grossTargetCents !== adjustedTargetCents

  const totalIncome = calcResult?.dashboard.totalMonthlyIncomeCents ?? 0
  const target = adjustedTargetCents
  const shortfall = Math.max(0, target - totalIncome)
  const surplus = Math.max(0, totalIncome - target)

  const b3HasLoc = (calcResult?.hecm?.locStartBalanceCents ?? 0) > 0
  const b3IsTenure = client.home_equity?.hecm_payout_type === 'tenure'
  const b3LocGrowthRateBps = client.home_equity?.hecm_loc_growth_rate_bps ?? 600

  const nestEggAccounts = client.nest_egg_accounts.map(a => ({ id: a.id, label: a.label }))
  const depletionAges = calcResult?.depletionAges

  const showIncomeChart = calcResult && (
    calcResult.incomeByAgePerSource.sources.length > 0 ||
    Object.values(calcResult.bucket2DrawsByAge).some(v => v > 0) ||
    Object.values(calcResult.bucket3DrawsByAge).some(v => v > 0)
  )

  return (
    <div className="p-5 space-y-4">
      {/* ── HIDDEN CHART CAPTURE CONTAINERS ── */}
      <div style={{ position: 'absolute', left: -9999, top: 0, pointerEvents: 'none' }}>
        <div ref={incomeChartRef} style={{ width: 900, height: 400, background: '#fff', padding: 16 }}>
          {calcResult && showIncomeChart && (
            <IncomeByAgeChart
              incomeByAgePerSource={calcResult.incomeByAgePerSource}
              bucket2DrawsByAge={calcResult.bucket2DrawsByAge}
              bucket3DrawsByAge={calcResult.bucket3DrawsByAge}
              adjustedTargetCents={adjustedTargetCents}
              retirementAge={client.target_retirement_age}
              planningHorizonAge={scenario.planning_horizon_age}
              bandTransitionAges={calcResult.bandTransitionAges}
              surplusByAge={calcResult.surplusByAge}
            />
          )}
        </div>
        <div ref={longevityChartRef} style={{ width: 900, height: 400, background: '#fff', padding: 16 }}>
          {calcResult && calcResult.longevityProjection.length > 0 && (
            <LongevityChart
              data={calcResult.longevityProjection}
              retirementAge={client.target_retirement_age}
              depletionAges={calcResult.depletionAges}
            />
          )}
        </div>
      </div>

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
            {hasUnresolvedShortfalls ? (
              <div className="rounded-lg px-3 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                ⚠ Plan has unresolved shortfalls — review age bands below
              </div>
            ) : shortfall > 0 ? (
              <div className="rounded-lg px-3 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                ⚠ Shortfall at retirement: {formatCents(shortfall)}/month
              </div>
            ) : surplus > 0 ? (
              <div className="rounded-lg px-3 py-2 text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                ↑ Surplus at retirement: {formatCents(surplus)}/month — allocate in age bands below
              </div>
            ) : totalIncome >= target ? (
              <div className="rounded-lg px-3 py-2 text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                ✓ Fully allocated
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── ALLOCATION BANNER ── */}
      {calcResult && Object.keys(calcResult.surplusByAge).length > 0 && (
        <AllocationBanner
          surplusByAge={calcResult.surplusByAge}
          acknowledgedKeys={new Set(
            Object.entries(drawerAllocations)
              .filter(([, e]) => e.acknowledged)
              .map(([k]) => k)
          )}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
      )}

      {/* ── ALLOCATION DRAWER ── */}
      {calcResult && (
        <AllocationDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          surplusByAge={calcResult.surplusByAge}
          adjustedTargetCents={adjustedTargetCents}
          ageBands={ageBands}
          b3HasLoc={b3HasLoc}
          depletionAges={depletionAges}
          allocations={drawerAllocations}
          onAllocationsChange={setDrawerAllocations}
          onAgeBandsUpdate={bands => onScenarioUpdate({ age_bands: bands })}
        />
      )}

      {/* ── BUCKET 1 READ-ONLY SUMMARY ── */}
      <Bucket1Summary calcResult={calcResult} calcLoading={calcLoading} />

      {/* ── BUCKET 2 + 3 AGE-BAND EDITOR / PRESENTATION CARDS ── */}
      {presentationMode ? (
        <PresentationBucketCard
          ageBands={ageBands}
          calcResult={calcResult}
          planningHorizonAge={scenario.planning_horizon_age}
          b3HasLoc={b3HasLoc}
          b3IsTenure={b3IsTenure}
          b3LocGrowthRateBps={b3LocGrowthRateBps}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-3">Bucket 2 + 3 — Draw &amp; Allocation Bands</h3>
          <AgeBandEditor
            ageBands={ageBands}
            retirementAge={client.target_retirement_age}
            planningHorizonAge={scenario.planning_horizon_age}
            nestEggAccounts={nestEggAccounts}
            b3HasLoc={b3HasLoc}
            onUpdate={bands => onScenarioUpdate({ age_bands: bands })}
            bucket2DepletionAge={depletionAges?.bucket2DepletionAge ?? null}
            bucket3DepletionAge={depletionAges?.bucket3DepletionAge ?? null}
          />
        </div>
      )}

      {/* ── INCOME BY AGE CHART (All 3 Buckets) ── */}
      {calcResult && showIncomeChart && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-3">Monthly Income by Age — All Sources</h3>
          <IncomeByAgeChart
            incomeByAgePerSource={calcResult.incomeByAgePerSource}
            bucket2DrawsByAge={calcResult.bucket2DrawsByAge}
            bucket3DrawsByAge={calcResult.bucket3DrawsByAge}
            adjustedTargetCents={adjustedTargetCents}
            retirementAge={client.target_retirement_age}
            planningHorizonAge={scenario.planning_horizon_age}
            bandTransitionAges={calcResult.bandTransitionAges}
            surplusByAge={calcResult.surplusByAge}
          />
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
          onClick={handleExportPDF}
          disabled={pdfLoading}
          className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-500 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {pdfLoading ? 'Generating PDF…' : 'Export PDF Report'}
        </button>
      </div>
    </div>
  )
}
