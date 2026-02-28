import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { runFullCalculation } from '@/lib/calculations'
import type { IncomeItemInput } from '@/lib/calculations/income'

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const scenarioId = searchParams.get('scenarioId')

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      income_items: true,
      nest_egg_accounts: true,
      home_equity: true,
      scenarios: true,
      advisor: true,
    },
  })

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.user.role !== 'admin' && client.advisor_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scenario = scenarioId
    ? client.scenarios.find(s => s.id === scenarioId)
    : client.scenarios.find(s => s.is_active) ?? client.scenarios[0]

  if (!scenario) return NextResponse.json({ error: 'No scenario' }, { status: 404 })

  const globalSettings = await prisma.globalSettings.findUnique({ where: { id: 'global' } })
  const lendingLimit = globalSettings?.hecm_lending_limit_cents ?? 120975000

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

  const calcResult = runFullCalculation({
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
    homeEquity: client.home_equity ? {
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
    } : null,
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
  })

  // Generate PDF using dynamic import to avoid SSR issues
  const { generatePDF } = await import('@/lib/pdf-generator')

  const pdfBytes = await generatePDF({
    client: {
      first_name: client.first_name,
      last_name: client.last_name,
      age: client.age,
      spouse_name: client.spouse_name,
      spouse_age: client.spouse_age,
      state: client.state,
      target_retirement_age: client.target_retirement_age,
    },
    advisor: {
      full_name: client.advisor.full_name,
      contact_info: client.advisor.contact_info ?? '',
    },
    scenario: {
      name: scenario.name,
      target_monthly_income_cents: scenario.target_monthly_income_cents,
      bucket1_draw_cents: scenario.bucket1_draw_cents,
      bucket2_draw_cents: scenario.bucket2_draw_cents,
      bucket3_draw_cents: scenario.bucket3_draw_cents,
      ss_primary_claim_age: scenario.ss_primary_claim_age,
      ss_spouse_claim_age: scenario.ss_spouse_claim_age,
      inflation_rate_bps: scenario.inflation_rate_bps,
      planning_horizon_age: scenario.planning_horizon_age,
      notes: scenario.notes,
    },
    incomeItems: client.income_items.map(i => ({
      label: i.label,
      type: i.type,
      monthly_amount_cents: i.monthly_amount_cents,
      start_age: i.start_age,
      end_age: i.end_age,
    })),
    nestEggAccounts: client.nest_egg_accounts.map(a => ({
      label: a.label,
      account_type: a.account_type,
      current_balance_cents: a.current_balance_cents,
      monthly_draw_cents: a.monthly_draw_cents,
      rate_of_return_bps: a.rate_of_return_bps,
    })),
    homeEquity: client.home_equity ? {
      current_home_value_cents: client.home_equity.current_home_value_cents,
      existing_mortgage_payment_cents: client.home_equity.existing_mortgage_payment_cents,
      hecm_payout_type: client.home_equity.hecm_payout_type,
      hecm_payoff_mortgage: client.home_equity.hecm_payoff_mortgage,
    } : null,
    calcResult,
    globalSettings: {
      inflation_rate_bps: globalSettings?.inflation_rate_bps ?? 300,
      home_appreciation_bps: globalSettings?.home_appreciation_bps ?? 400,
      loc_growth_rate_bps: globalSettings?.loc_growth_rate_bps ?? 600,
      hecm_lending_limit_cents: lendingLimit,
    },
    generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  })

  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${client.last_name}_${client.first_name}_Retirement_Plan.pdf"`,
    },
  })
}
