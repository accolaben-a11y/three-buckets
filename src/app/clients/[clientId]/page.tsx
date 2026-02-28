'use client'
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import Bucket1Panel from '@/components/buckets/Bucket1Panel'
import Bucket2Panel from '@/components/buckets/Bucket2Panel'
import Bucket3Panel from '@/components/buckets/Bucket3Panel'
import CashFlowDashboard from '@/components/dashboard/CashFlowDashboard'
import type { FullCalculationResult } from '@/lib/calculations'

interface ClientData {
  id: string
  first_name: string
  last_name: string
  age: number
  spouse_name: string | null
  spouse_age: number | null
  marital_status: string
  state: string
  target_retirement_age: number
  planning_horizon_age: number
  model_survivor: boolean
  survivor_spouse: string | null
  survivor_event_age: number | null
  income_items: IncomeItem[]
  nest_egg_accounts: NestEggAccount[]
  home_equity: HomeEquityData | null
  scenarios: Scenario[]
  advisor: { full_name: string; contact_info: string | null }
}

export interface IncomeItem {
  id: string
  client_id: string
  owner: 'primary' | 'spouse' | 'joint'
  type: 'social_security' | 'wage' | 'commission' | 'business' | 'pension' | 'other'
  label: string
  monthly_amount_cents: number
  start_age: number
  end_age: number | null
  ss_age62_cents: number | null
  ss_age67_cents: number | null
  ss_age70_cents: number | null
  ss_claim_age: number | null
  pension_survivor_pct: number | null
  sort_order: number
}

export interface NestEggAccount {
  id: string
  client_id: string
  label: string
  account_type: 'qualified' | 'non_qualified'
  current_balance_cents: number
  monthly_contribution_cents: number
  rate_of_return_bps: number
  monthly_draw_cents: number
  sort_order: number
}

export interface HomeEquityData {
  id: string
  client_id: string
  current_home_value_cents: number
  existing_mortgage_balance_cents: number
  existing_mortgage_payment_cents: number
  home_appreciation_rate_bps: number
  hecm_expected_rate_bps: number
  hecm_payout_type: 'none' | 'lump_sum' | 'loc' | 'tenure'
  hecm_tenure_monthly_cents: number
  hecm_loc_growth_rate_bps: number
  hecm_payoff_mortgage: boolean
}

export interface Scenario {
  id: string
  client_id: string
  name: string
  is_active: boolean
  target_monthly_income_cents: number
  bucket1_draw_cents: number
  bucket2_draw_cents: number
  bucket3_draw_cents: number
  bridge_funding_source: string | null
  ss_primary_claim_age: number
  ss_spouse_claim_age: number
  inflation_rate_bps: number
  planning_horizon_age: number
  notes: string | null
  survivor_mode: boolean
}

export default function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const { data: session } = useSession()
  const router = useRouter()

  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'bucket1' | 'bucket2' | 'bucket3'>('bucket1')
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null)
  const [calcResult, setCalcResult] = useState<FullCalculationResult | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [scenarioName, setScenarioName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [survivorMode, setSurvivorMode] = useState(false)

  const loadClient = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}`)
    if (!res.ok) { router.push('/clients'); return }
    const data: ClientData = await res.json()
    setClient(data)
    const active = data.scenarios.find(s => s.is_active) ?? data.scenarios[0] ?? null
    setActiveScenario(active)
    if (active) {
      setScenarioName(active.name)
      setSurvivorMode(active.survivor_mode)
    }
    setLoading(false)
  }, [clientId, router])

  useEffect(() => { loadClient() }, [loadClient])

  const runCalculations = useCallback(async (scenarioId?: string) => {
    setCalcLoading(true)
    const res = await fetch('/api/calculations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, scenarioId: scenarioId ?? activeScenario?.id }),
    })
    if (res.ok) {
      const data = await res.json()
      setCalcResult(data.result)
    }
    setCalcLoading(false)
  }, [clientId, activeScenario?.id])

  useEffect(() => {
    if (activeScenario) runCalculations(activeScenario.id)
  }, [activeScenario, runCalculations])

  async function saveScenario(updates: Partial<Scenario>) {
    if (!activeScenario) return
    await fetch(`/api/scenarios/${activeScenario.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    await loadClient()
    await runCalculations(activeScenario.id)
  }

  async function newScenario() {
    if (!client) return
    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: client.id,
        name: 'New Scenario',
        is_active: true,
        target_monthly_income_cents: activeScenario?.target_monthly_income_cents ?? 0,
        ss_primary_claim_age: activeScenario?.ss_primary_claim_age ?? 67,
        ss_spouse_claim_age: activeScenario?.ss_spouse_claim_age ?? 67,
        inflation_rate_bps: activeScenario?.inflation_rate_bps ?? 300,
        planning_horizon_age: activeScenario?.planning_horizon_age ?? 90,
      }),
    })
    if (res.ok) {
      const newS = await res.json()
      await loadClient()
      setActiveScenario(newS)
    }
  }

  async function cloneScenario() {
    if (!activeScenario) return
    const res = await fetch(`/api/scenarios/${activeScenario.id}`, { method: 'POST' })
    if (res.ok) {
      await loadClient()
    }
  }

  async function exportPDF() {
    if (!activeScenario) return
    const res = await fetch(`/api/pdf/${clientId}?scenarioId=${activeScenario.id}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${client?.last_name}_${client?.first_name}_Retirement_Plan.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async function toggleSurvivor() {
    const newMode = !survivorMode
    setSurvivorMode(newMode)
    await saveScenario({ survivor_mode: newMode })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading client data…</div>
      </div>
    )
  }

  if (!client || !activeScenario) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Client not found.</p>
          <Link href="/clients" className="text-blue-600 hover:text-blue-700">← Back to Clients</Link>
        </div>
      </div>
    )
  }

  const isMarried = client.marital_status !== 'single'

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* ── HEADER ── */}
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center gap-4 shrink-0 z-10">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-0.5">
            <div className="w-2.5 h-6 rounded-sm bg-green-500" />
            <div className="w-2.5 h-6 rounded-sm bg-blue-500" />
            <div className="w-2.5 h-6 rounded-sm bg-red-500" />
          </div>
          <Link href="/clients" className="text-slate-400 hover:text-white text-sm ml-1">← Clients</Link>
        </div>

        {/* Client Name */}
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold truncate">
            {client.first_name} {client.last_name}
            {client.spouse_name && (
              <span className="text-slate-400 font-normal text-sm ml-2">& {client.spouse_name}</span>
            )}
          </h1>
          <p className="text-slate-400 text-xs">
            Age {client.age}{client.spouse_age ? ` / ${client.spouse_age}` : ''} • {client.state} • Retirement age {client.target_retirement_age}
          </p>
        </div>

        {/* Scenario Selector */}
        <div className="flex items-center gap-2 shrink-0">
          {editingName ? (
            <input
              type="text"
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              onBlur={async () => {
                setEditingName(false)
                await saveScenario({ name: scenarioName })
              }}
              onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              autoFocus
              className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600 focus:outline-none focus:border-blue-400 w-48"
            />
          ) : (
            <select
              value={activeScenario.id}
              onChange={async e => {
                const s = client.scenarios.find(s => s.id === e.target.value)
                if (s) {
                  setActiveScenario(s)
                  setScenarioName(s.name)
                  await fetch(`/api/scenarios/${s.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: true }),
                  })
                  await loadClient()
                }
              }}
              className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600 focus:outline-none focus:border-blue-400"
            >
              {client.scenarios.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setEditingName(true)}
            className="text-slate-400 hover:text-white"
            title="Rename scenario"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        {/* Survivor Toggle */}
        {isMarried && (
          <button
            onClick={toggleSurvivor}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              survivorMode ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {survivorMode ? 'Survivor View' : 'Survivor'}
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={newScenario} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded border border-slate-700 hover:border-slate-500">
            + Scenario
          </button>
          <button onClick={cloneScenario} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded border border-slate-700 hover:border-slate-500">
            Clone
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-slate-500 hover:text-slate-300 text-xs ml-2"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── SURVIVOR BANNER ── */}
      {survivorMode && (
        <div className="bg-amber-500 text-white text-center text-sm font-medium py-2 shrink-0">
          SURVIVOR SCENARIO — {client.survivor_spouse === 'spouse' ? client.first_name : client.spouse_name} as surviving spouse at age {client.survivor_event_age ?? '?'}
        </div>
      )}

      {/* ── MAIN SPLIT PANEL ── */}
      <div className="flex-1 flex min-h-0">

        {/* ── LEFT PANEL — Bucket Entry ── */}
        <div className="w-[40%] min-w-[420px] flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          {/* Bucket Tabs */}
          <div className="flex border-b border-slate-200 shrink-0">
            {[
              { key: 'bucket1', label: 'Bucket 1', sublabel: 'Income', color: 'text-green-600 border-green-500 bg-green-50' },
              { key: 'bucket2', label: 'Bucket 2', sublabel: 'Nest Egg', color: 'text-blue-600 border-blue-500 bg-blue-50' },
              { key: 'bucket3', label: 'Bucket 3', sublabel: 'Home Equity', color: 'text-red-600 border-red-500 bg-red-50' },
            ].map(({ key, label, sublabel, color }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? `${color} border-current`
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="font-semibold">{label}</div>
                <div className="text-xs opacity-75">{sublabel}</div>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'bucket1' && (
              <Bucket1Panel
                client={client}
                scenario={activeScenario}
                onUpdate={async () => { await loadClient(); await runCalculations() }}
                onScenarioUpdate={saveScenario}
              />
            )}
            {activeTab === 'bucket2' && (
              <Bucket2Panel
                client={client}
                scenario={activeScenario}
                calcResult={calcResult}
                onUpdate={async () => { await loadClient(); await runCalculations() }}
              />
            )}
            {activeTab === 'bucket3' && (
              <Bucket3Panel
                client={client}
                calcResult={calcResult}
                onUpdate={async () => { await loadClient(); await runCalculations() }}
              />
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — Live Cash Flow Dashboard ── */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-slate-50">
          <CashFlowDashboard
            client={client}
            scenario={activeScenario}
            calcResult={calcResult}
            calcLoading={calcLoading}
            survivorMode={survivorMode}
            onScenarioUpdate={saveScenario}
            onExportPDF={exportPDF}
          />
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-slate-200 px-6 py-2 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <div className="flex gap-4">
          <span>Inflation: {(activeScenario.inflation_rate_bps / 100).toFixed(1)}%</span>
          <span>Planning to age: {activeScenario.planning_horizon_age}</span>
          {client.home_equity && (
            <>
              <span>Home Apprec: {(client.home_equity.home_appreciation_rate_bps / 100).toFixed(1)}%</span>
              <span>LOC Growth: {(client.home_equity.hecm_loc_growth_rate_bps / 100).toFixed(1)}%</span>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportPDF}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded font-medium flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </footer>
    </div>
  )
}
