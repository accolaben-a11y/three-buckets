import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { runFullCalculation } from '@/lib/calculations'
import type { IncomeItemInput } from '@/lib/calculations/income'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId, scenarioId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Load client with all data
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      income_items: true,
      nest_egg_accounts: true,
      home_equity: true,
      scenarios: true,
    },
  })

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.user.role !== 'admin' && client.advisor_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get scenario (active or specified)
  const scenario = scenarioId
    ? client.scenarios.find(s => s.id === scenarioId)
    : client.scenarios.find(s => s.is_active) ?? client.scenarios[0]

  if (!scenario) return NextResponse.json({ error: 'No scenario found' }, { status: 404 })

  // Load global settings
  const globalSettings = await prisma.globalSettings.findUnique({ where: { id: 'global' } })
  const lendingLimit = globalSettings?.hecm_lending_limit_cents ?? 120975000

  // Build income items input
  const incomeItems: IncomeItemInput[] = client.income_items.map(item => ({
    id: item.id,
    owner: item.owner as 'primary' | 'spouse' | 'joint',
    type: item.type as IncomeItemInput['type'],
    label: item.label,
    monthlyAmountCents: item.monthly_amount_cents,
    startAge: item.start_age,
    endAge: item.end_age,
    ssAge62Cents: item.ss_age62_cents,
    ssAge67Cents: item.ss_age67_cents,
    ssAge70Cents: item.ss_age70_cents,
    ssClaimAge: item.ss_claim_age,
    pensionSurvivorPct: item.pension_survivor_pct,
  }))

  const result = runFullCalculation({
    primaryAge: client.age,
    spouseAge: client.spouse_age,
    retirementAge: client.target_retirement_age,
    planningHorizonAge: scenario.planning_horizon_age,
    incomeItems,
    ssPrimaryClaimAge: scenario.ss_primary_claim_age,
    ssSpouseClaimAge: scenario.ss_spouse_claim_age,
    nestEggAccounts: client.nest_egg_accounts.map(a => ({
      id: a.id,
      label: a.label,
      accountType: a.account_type as 'qualified' | 'non_qualified',
      currentBalanceCents: a.current_balance_cents,
      monthlyContributionCents: a.monthly_contribution_cents,
      rateOfReturnBps: a.rate_of_return_bps,
      monthlyDrawCents: a.monthly_draw_cents,
    })),
    homeEquity: client.home_equity
      ? {
          currentHomeValueCents: client.home_equity.current_home_value_cents,
          existingMortgageBalanceCents: client.home_equity.existing_mortgage_balance_cents,
          existingMortgagePaymentCents: client.home_equity.existing_mortgage_payment_cents,
          homeAppreciationRateBps: client.home_equity.home_appreciation_rate_bps,
          hecmExpectedRateBps: client.home_equity.hecm_expected_rate_bps,
          hecmPayoutType: client.home_equity.hecm_payout_type as 'none' | 'lump_sum' | 'loc' | 'tenure',
          hecmTenureMonthlyCents: client.home_equity.hecm_tenure_monthly_cents,
          hecmLocGrowthRateBps: client.home_equity.hecm_loc_growth_rate_bps,
          hecmPayoffMortgage: client.home_equity.hecm_payoff_mortgage,
          hecmPrincipalLimitCents: client.home_equity.hecm_principal_limit_cents,
          hecmAdditionalLumpSumCents: client.home_equity.hecm_additional_lump_sum_cents,
        }
      : null,
    targetMonthlyIncomeCents: scenario.target_monthly_income_cents,
    bucket1DrawCents: scenario.bucket1_draw_cents,
    bucket2DrawCents: scenario.bucket2_draw_cents,
    bucket3DrawCents: scenario.bucket3_draw_cents,
    inflationRateBps: scenario.inflation_rate_bps,
    lendingLimitCents: lendingLimit,
    bucket2DepositCents: scenario.bucket2_deposit_cents,
    bucket3RepaymentCents: scenario.bucket3_repayment_cents,
    survivorMode: scenario.survivor_mode,
    survivorSpouse: client.survivor_spouse as 'primary' | 'spouse' | undefined,
    survivorEventAge: client.survivor_event_age ?? undefined,
    globalLocGrowthRateBps: globalSettings?.loc_growth_rate_bps,
  })

  return NextResponse.json({ scenario, result })
}
