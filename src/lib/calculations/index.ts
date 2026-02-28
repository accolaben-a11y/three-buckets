/**
 * Main calculation orchestrator
 * Combines all bucket calculations into a single result for the dashboard.
 */
import { projectAccountBalance, projectHomeValue } from './accumulation'
import { buildIncomeByAge, buildSurvivorIncomeByAge, calculateBridgePeriod } from './income'
import { calculateHecm } from './hecm'
import { projectRetirementPhase, findDepletionAges, type YearlySnapshot } from './retirement'
import type { IncomeItemInput } from './income'

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
  bucket1DrawCents: number
  bucket2DrawCents: number
  bucket3DrawCents: number
  inflationRateBps: number
  lendingLimitCents: number
  bucket2DepositCents?: number
  bucket3RepaymentCents?: number

  // Survivor
  survivorMode: boolean
  survivorSpouse?: 'primary' | 'spouse'
  survivorEventAge?: number

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

  // Dashboard numbers
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
    globalLocGrowthRateBps = 600,
  } = input

  const monthsToRetirement = Math.max(0, (retirementAge - primaryAge) * 12)
  const yearsToRetirement = Math.max(0, retirementAge - primaryAge)

  // Youngest borrower age at retirement for LOC projections
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

  // ─── Adjusted Target (mortgage eliminated by HECM payoff) ───
  const hecmPayoffActive = homeEquity?.hecmPayoffMortgage === true && homeEquity?.hecmPayoutType === 'lump_sum'
  const mortgagePaymentCents = homeEquity?.existingMortgagePaymentCents ?? 0
  const adjustedTargetCents = (hecmPayoffActive && mortgagePaymentCents > 0)
    ? Math.max(0, targetMonthlyIncomeCents - mortgagePaymentCents)
    : targetMonthlyIncomeCents

  // ─── Income by Age ───
  const bucket1MonthlyByAge = buildIncomeByAge(
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

  // ─── Dashboard Numbers ───
  const mortgageFreedCents = hecmResult?.monthlyFreedCents ?? 0
  const b3Monthly = homeEquity?.hecmPayoutType === 'tenure'
    ? (hecmResult?.tenureMonthlyCents ?? 0)
    : bucket3DrawCents

  const totalMonthlyIncomeCents = bucket1DrawCents + bucket2DrawCents + b3Monthly
  const shortfallCents = Math.max(0, adjustedTargetCents - totalMonthlyIncomeCents)
  const surplusCents = Math.max(0, totalMonthlyIncomeCents - adjustedTargetCents)

  // ─── Longevity Projection ───
  // Deduct cash-to-close from bucket 2 start balance if needed
  const cashToClose = hecmResult ? Math.max(0, -hecmResult.availableProceedsCents) : 0
  const bucket2StartBalance = Math.max(0, totalProjectedNestEggCents - cashToClose)

  const bucket2MonthlyDraw = bucket2DrawCents
  const bucket2AnnualRate = nestEggAccounts.length > 0
    ? Math.floor(nestEggAccounts.reduce((s, a) => s + a.rateOfReturnBps, 0) / nestEggAccounts.length)
    : 600

  const bucket3StartBalance = hecmResult?.locStartBalanceCents ?? 0
  const bucket3Monthly = bucket3DrawCents
  const bucket3LocGrowth = homeEquity?.hecmLocGrowthRateBps ?? globalLocGrowthRateBps

  const longevityProjection = projectRetirementPhase({
    retirementAge,
    planningHorizonAge,
    bucket1MonthlyByAge,
    bucket2StartBalanceCents: bucket2StartBalance,
    bucket2MonthlyDrawCents: bucket2MonthlyDraw,
    bucket2AnnualRateBps: bucket2AnnualRate,
    bucket3Type: homeEquity?.hecmPayoutType ?? 'none',
    bucket3StartBalanceCents: bucket3StartBalance,
    bucket3MonthlyDrawCents: bucket3Monthly,
    bucket3LocGrowthRateBps: bucket3LocGrowth,
    targetMonthlyIncomeCents: adjustedTargetCents,
    inflationRateBps,
    survivorEventAge: survivorConfig?.survivorEventAge,
    survivorBucket1MonthlyByAge,
    bucket2DepositCents,
    bucket3RepaymentCents,
  })

  const depletionAges = findDepletionAges(longevityProjection)

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
      bucket1MonthlyCents: bucket1DrawCents,
      bucket2MonthlyCents: bucket2DrawCents,
      bucket3MonthlyCents: b3Monthly,
      grossTargetCents: targetMonthlyIncomeCents,
      adjustedTargetCents,
    },
    longevityProjection,
    depletionAges,
  }
}

export type { YearlySnapshot }
export { projectAccountBalance, projectHomeValue } from './accumulation'
export { calculateHecm } from './hecm'
export { buildIncomeByAge, calculateBridgePeriod } from './income'
export type { IncomeItemInput } from './income'
