/**
 * Main calculation orchestrator
 * Combines all bucket calculations into a single result for the dashboard.
 */
import { projectAccountBalance, projectHomeValue } from './accumulation'
import { buildIncomeByAge, buildSurvivorIncomeByAge, calculateBridgePeriod, buildIncomeByAgePerSource } from './income'
import type { IncomeSourceMeta } from './income'
import { calculateHecm } from './hecm'
import { projectRetirementPhase, findDepletionAges, type YearlySnapshot } from './retirement'
import type { IncomeItemInput } from './income'
import type { AgeBands } from '@/types/age-bands'
import { buildAgeMap, getBandTransitionAges } from '@/types/age-bands'

export interface FullCalculationInput {
  // Client profile
  primaryAge: number
  spouseAge: number | null
  retirementAge: number
  planningHorizonAge: number

  // Bucket 1
  incomeItems: IncomeItemInput[]
  ssPrimaryClaimAge: number
  ssSpouseClaimAge: number

  // Bucket 2
  nestEggAccounts: Array<{
    id: string
    label: string
    accountType: 'qualified' | 'non_qualified'
    currentBalanceCents: number
    monthlyContributionCents: number
    rateOfReturnBps: number
    monthlyDrawCents: number
  }>

  // Bucket 3
  homeEquity: {
    currentHomeValueCents: number
    existingMortgageBalanceCents: number
    existingMortgagePaymentCents: number
    homeAppreciationRateBps: number
    hecmExpectedRateBps: number
    hecmPayoutType: 'none' | 'lump_sum' | 'loc' | 'tenure'
    hecmTenureMonthlyCents: number
    hecmLocGrowthRateBps: number
    hecmPayoffMortgage: boolean
    hecmPrincipalLimitCents: number
    hecmAdditionalLumpSumCents: number
  } | null

  // Scenario settings
  targetMonthlyIncomeCents: number
  // Age-banded draws (preferred)
  ageBands?: AgeBands | null
  // Legacy scalar fallbacks (used if ageBands is null)
  bucket1DrawCents: number
  bucket2DrawCents: number
  bucket3DrawCents: number
  inflationRateBps: number
  lendingLimitCents: number
  // Legacy scalar deposits/repayments (used if no bands)
  bucket2DepositCents?: number
  bucket3RepaymentCents?: number

  // Survivor
  survivorMode: boolean
  survivorSpouse?: 'primary' | 'spouse'
  survivorEventAge?: number

  // Age-triggered reallocation events (legacy transition_events)
  transitionEvents?: Record<string, { bucket2_deposit_cents: number; bucket3_repayment_cents: number; notes?: string }>

  // Global defaults
  globalLocGrowthRateBps?: number
}

export interface FullCalculationResult {
  // Accumulation phase
  accumulationPhase: {
    monthsToRetirement: number
    nestEggProjections: Array<{
      id: string
      label: string
      accountType: string
      currentBalanceCents: number
      projectedBalanceCents: number
    }>
    totalCurrentNestEggCents: number
    totalProjectedNestEggCents: number
    projectedHomeValueCents: number
  }

  // HECM results
  hecm: {
    projectedHomeValueCents: number
    principalLimitCents: number
    availableProceedsCents: number
    monthlyFreedCents: number
    lumpSumAvailableCents: number
    locStartBalanceCents: number
    locProjections: Array<{ age: number; balanceCents: number }>
    tenureMonthlyCents: number
  } | null

  // Bridge period
  bridgePeriod: {
    hasBridgePeriod: boolean
    bridgeStartAge: number
    bridgeEndAge: number
    monthlyGapCents: number
    totalBridgeCostCents: number
  }

  // Dashboard numbers (at retirement age)
  dashboard: {
    mortgageFreedCents: number
    totalMonthlyIncomeCents: number
    shortfallCents: number
    surplusCents: number
    bucket1MonthlyCents: number
    bucket2MonthlyCents: number
    bucket3MonthlyCents: number
    grossTargetCents: number
    adjustedTargetCents: number
  }

  // Longevity projection
  longevityProjection: YearlySnapshot[]
  depletionAges: {
    bucket2DepletionAge: number | null
    bucket3DepletionAge: number | null
  }

  // Per-source income breakdown for B1 stacked bar chart
  incomeByAgePerSource: {
    byAge: Record<number, Record<string, number>>
    sources: IncomeSourceMeta[]
  }

  // Ages where bucket1 income steps up (SS kicks in, etc.)
  transitionAges: number[]

  // Per-age draws for all buckets (used by IncomeByAgeChart)
  bucket2DrawsByAge: Record<number, number>
  bucket3DrawsByAge: Record<number, number>

  // Per-age surplus/shortfall vs adjusted target
  surplusByAge: Record<number, number>

  // Ages where any age band transitions (for chart step markers)
  bandTransitionAges: number[]
}

export function runFullCalculation(input: FullCalculationInput): FullCalculationResult {
  const {
    primaryAge,
    spouseAge,
    retirementAge,
    planningHorizonAge,
    incomeItems,
    ssPrimaryClaimAge,
    ssSpouseClaimAge,
    nestEggAccounts,
    homeEquity,
    targetMonthlyIncomeCents,
    ageBands,
    bucket1DrawCents,
    bucket2DrawCents,
    bucket3DrawCents,
    inflationRateBps,
    lendingLimitCents,
    bucket2DepositCents = 0,
    bucket3RepaymentCents = 0,
    survivorMode,
    survivorSpouse,
    survivorEventAge,
    transitionEvents,
    globalLocGrowthRateBps = 600,
  } = input

  const monthsToRetirement = Math.max(0, (retirementAge - primaryAge) * 12)
  const yearsToRetirement = Math.max(0, retirementAge - primaryAge)

  const youngestCurrentAge = spouseAge !== null && spouseAge !== undefined
    ? Math.min(primaryAge, spouseAge)
    : primaryAge

  // ─── Accumulation Phase ───
  const nestEggProjections = nestEggAccounts.map(acct => ({
    id: acct.id,
    label: acct.label,
    accountType: acct.accountType,
    currentBalanceCents: acct.currentBalanceCents,
    projectedBalanceCents: projectAccountBalance(
      acct.currentBalanceCents,
      acct.monthlyContributionCents,
      acct.rateOfReturnBps,
      monthsToRetirement
    ),
  }))

  const totalCurrentNestEggCents = nestEggAccounts.reduce((s, a) => s + a.currentBalanceCents, 0)
  const totalProjectedNestEggCents = nestEggProjections.reduce((s, a) => s + a.projectedBalanceCents, 0)

  const projectedHomeValueCents = homeEquity
    ? projectHomeValue(homeEquity.currentHomeValueCents, homeEquity.homeAppreciationRateBps, yearsToRetirement)
    : 0

  // ─── HECM ───
  let hecmResult = null
  if (homeEquity) {
    hecmResult = calculateHecm({
      currentHomeValueCents: homeEquity.currentHomeValueCents,
      existingMortgageBalanceCents: homeEquity.existingMortgageBalanceCents,
      existingMortgagePaymentCents: homeEquity.existingMortgagePaymentCents,
      homeAppreciationRateBps: homeEquity.homeAppreciationRateBps,
      hecmExpectedRateBps: homeEquity.hecmExpectedRateBps,
      hecmPayoutType: homeEquity.hecmPayoutType,
      hecmTenureMonthlysCents: homeEquity.hecmTenureMonthlyCents,
      hecmLocGrowthRateBps: homeEquity.hecmLocGrowthRateBps,
      hecmPayoffMortgage: homeEquity.hecmPayoffMortgage,
      youngestBorrowerAge: youngestCurrentAge,
      yearsToRetirement,
      lendingLimitCents,
      hecmPrincipalLimitCents: homeEquity.hecmPrincipalLimitCents,
      hecmAdditionalLumpSumCents: homeEquity.hecmAdditionalLumpSumCents,
    })
  }

  // ─── Adjusted Target ───
  const hecmPayoffActive = homeEquity?.hecmPayoffMortgage === true && homeEquity?.hecmPayoutType === 'lump_sum'
  const mortgagePaymentCents = homeEquity?.existingMortgagePaymentCents ?? 0
  const adjustedTargetCents = (hecmPayoffActive && mortgagePaymentCents > 0)
    ? Math.max(0, targetMonthlyIncomeCents - mortgagePaymentCents)
    : targetMonthlyIncomeCents

  // ─── Income by Age (Bucket 1) ───
  const bucket1MonthlyByAge = buildIncomeByAge(
    incomeItems,
    retirementAge,
    planningHorizonAge,
    ssPrimaryClaimAge,
    ssSpouseClaimAge
  )

  const incomeByAgePerSource = buildIncomeByAgePerSource(
    incomeItems,
    retirementAge,
    planningHorizonAge,
    ssPrimaryClaimAge,
    ssSpouseClaimAge
  )

  const survivorConfig = (survivorMode && survivorSpouse && survivorEventAge)
    ? { survivorEventAge, survivorSpouse }
    : undefined

  const survivorBucket1MonthlyByAge = survivorConfig
    ? buildSurvivorIncomeByAge(
        incomeItems,
        retirementAge,
        planningHorizonAge,
        ssPrimaryClaimAge,
        ssSpouseClaimAge,
        survivorConfig
      )
    : undefined

  // ─── Bridge Period ───
  const bridgePeriod = calculateBridgePeriod(
    incomeItems,
    retirementAge,
    ssPrimaryClaimAge,
    ssSpouseClaimAge
  )

  // ─── Build per-age draw/deposit maps from age bands (or scalar fallback) ───
  let b2DrawsByAge: Record<number, number>
  let b2DepositsByAge: Record<number, number>
  let b3DrawsByAge: Record<number, number>
  let b3RepaymentsByAge: Record<number, number>
  let bandTransitionAges: number[]

  if (ageBands) {
    b2DrawsByAge = buildAgeMap(ageBands.bucket2.draws, retirementAge, planningHorizonAge)
    b2DepositsByAge = buildAgeMap(ageBands.bucket2.deposits, retirementAge, planningHorizonAge)
    b3DrawsByAge = buildAgeMap(ageBands.bucket3.draws, retirementAge, planningHorizonAge)
    b3RepaymentsByAge = buildAgeMap(ageBands.bucket3.repayments, retirementAge, planningHorizonAge)
    bandTransitionAges = getBandTransitionAges(
      [ageBands.bucket2.draws, ageBands.bucket2.deposits, ageBands.bucket3.draws, ageBands.bucket3.repayments],
      retirementAge,
      planningHorizonAge
    )
  } else {
    // Scalar fallback (pre-migration scenarios)
    const uniformMap = (val: number) => {
      const m: Record<number, number> = {}
      for (let a = retirementAge; a <= planningHorizonAge; a++) m[a] = val
      return m
    }
    b2DrawsByAge = uniformMap(bucket2DrawCents)
    b2DepositsByAge = uniformMap(bucket2DepositCents)
    b3DrawsByAge = uniformMap(bucket3DrawCents)
    b3RepaymentsByAge = uniformMap(bucket3RepaymentCents)
    bandTransitionAges = []
  }

  // For tenure bucket3, override draws with tenure monthly amount
  const isTenure = homeEquity?.hecmPayoutType === 'tenure'
  if (isTenure && hecmResult) {
    const tenureAmount = hecmResult.tenureMonthlyCents
    for (const age in b3DrawsByAge) {
      b3DrawsByAge[age] = tenureAmount
    }
  }

  // ─── Age-Triggered Events (legacy transition_events) ───
  const ageTriggeredEvents: Record<number, { bucket2Cents: number; bucket3Cents: number }> | undefined =
    transitionEvents
      ? Object.fromEntries(
          Object.entries(transitionEvents).map(([ageStr, ev]) => [
            Number(ageStr),
            { bucket2Cents: ev.bucket2_deposit_cents, bucket3Cents: ev.bucket3_repayment_cents },
          ])
        )
      : undefined

  // ─── Dashboard Numbers (at retirement age) ───
  const mortgageFreedCents = hecmResult?.monthlyFreedCents ?? 0
  const b1AtRetirement = bucket1MonthlyByAge[retirementAge] ?? 0
  const b2DrawAtRetirement = b2DrawsByAge[retirementAge] ?? 0
  const b3DrawAtRetirement = b3DrawsByAge[retirementAge] ?? 0
  const b2DepAtRetirement = b2DepositsByAge[retirementAge] ?? 0
  const b3RepAtRetirement = b3RepaymentsByAge[retirementAge] ?? 0

  const totalMonthlyIncomeCents = b1AtRetirement + b2DrawAtRetirement - b2DepAtRetirement + b3DrawAtRetirement - b3RepAtRetirement
  const shortfallCents = Math.max(0, adjustedTargetCents - totalMonthlyIncomeCents)
  const surplusCents = Math.max(0, totalMonthlyIncomeCents - adjustedTargetCents)

  // ─── Longevity Projection ───
  const cashToClose = hecmResult ? Math.max(0, -hecmResult.availableProceedsCents) : 0
  const bucket2StartBalance = Math.max(0, totalProjectedNestEggCents - cashToClose)
  const bucket3StartBalance = hecmResult?.locStartBalanceCents ?? 0
  const bucket3LocGrowth = homeEquity?.hecmLocGrowthRateBps ?? globalLocGrowthRateBps
  const bucket2AnnualRate = nestEggAccounts.length > 0
    ? Math.floor(nestEggAccounts.reduce((s, a) => s + a.rateOfReturnBps, 0) / nestEggAccounts.length)
    : 600

  const longevityProjection = projectRetirementPhase({
    retirementAge,
    planningHorizonAge,
    bucket1MonthlyByAge,
    bucket2StartBalanceCents: bucket2StartBalance,
    bucket2AnnualRateBps: bucket2AnnualRate,
    bucket2DrawsByAge: b2DrawsByAge,
    bucket2DepositsByAge: b2DepositsByAge,
    bucket3Type: homeEquity?.hecmPayoutType ?? 'none',
    bucket3StartBalanceCents: bucket3StartBalance,
    bucket3LocGrowthRateBps: bucket3LocGrowth,
    bucket3DrawsByAge: b3DrawsByAge,
    bucket3RepaymentsByAge: b3RepaymentsByAge,
    targetMonthlyIncomeCents: adjustedTargetCents,
    inflationRateBps,
    survivorEventAge: survivorConfig?.survivorEventAge,
    survivorBucket1MonthlyByAge,
    ageTriggeredEvents,
  })

  const depletionAges = findDepletionAges(longevityProjection)

  // ─── Transition Ages (Bucket 1 income steps) ───
  const transitionAges: number[] = []
  for (let i = 1; i < longevityProjection.length; i++) {
    if (longevityProjection[i].bucket1IncomeCents !== longevityProjection[i - 1].bucket1IncomeCents) {
      transitionAges.push(longevityProjection[i].age)
    }
  }

  // ─── Per-age surplus/shortfall ───
  const surplusByAge: Record<number, number> = {}
  for (const snap of longevityProjection) {
    surplusByAge[snap.age] = snap.surplusCents
  }

  return {
    accumulationPhase: {
      monthsToRetirement,
      nestEggProjections,
      totalCurrentNestEggCents,
      totalProjectedNestEggCents,
      projectedHomeValueCents,
    },
    hecm: hecmResult
      ? {
          projectedHomeValueCents: hecmResult.projectedHomeValueCents,
          principalLimitCents: hecmResult.principalLimitCents,
          availableProceedsCents: hecmResult.availableProceedsCents,
          monthlyFreedCents: hecmResult.monthlyFreedCents,
          lumpSumAvailableCents: hecmResult.lumpSumAvailableCents,
          locStartBalanceCents: hecmResult.locStartBalanceCents,
          locProjections: hecmResult.locProjections,
          tenureMonthlyCents: hecmResult.tenureMonthlyCents,
        }
      : null,
    bridgePeriod,
    dashboard: {
      mortgageFreedCents,
      totalMonthlyIncomeCents,
      shortfallCents,
      surplusCents,
      bucket1MonthlyCents: b1AtRetirement,
      bucket2MonthlyCents: b2DrawAtRetirement,
      bucket3MonthlyCents: b3DrawAtRetirement,
      grossTargetCents: targetMonthlyIncomeCents,
      adjustedTargetCents,
    },
    longevityProjection,
    depletionAges,
    incomeByAgePerSource,
    transitionAges,
    bucket2DrawsByAge: b2DrawsByAge,
    bucket3DrawsByAge: b3DrawsByAge,
    surplusByAge,
    bandTransitionAges,
  }
}

export type { YearlySnapshot }
export { projectAccountBalance, projectHomeValue } from './accumulation'
export { calculateHecm } from './hecm'
export { buildIncomeByAge, calculateBridgePeriod } from './income'
export type { IncomeItemInput, IncomeSourceMeta } from './income'
export type { AgeBands, AgeBand, AgeBandWithMeta } from '@/types/age-bands'
