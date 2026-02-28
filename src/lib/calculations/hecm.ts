/**
 * HECM Calculation Logic
 */
import { projectHomeValue } from './accumulation'

export interface HecmCalculationInput {
  currentHomeValueCents: number
  existingMortgageBalanceCents: number
  existingMortgagePaymentCents: number
  homeAppreciationRateBps: number
  hecmExpectedRateBps: number
  hecmPayoutType: 'none' | 'lump_sum' | 'loc' | 'tenure'
  hecmTenureMonthlysCents: number
  hecmLocGrowthRateBps: number
  hecmPayoffMortgage: boolean
  youngestBorrowerAge: number
  yearsToRetirement: number
  lendingLimitCents: number
  hecmPrincipalLimitCents: number
  hecmAdditionalLumpSumCents: number
}

export interface HecmResult {
  projectedHomeValueCents: number
  principalLimitCents: number
  availableProceedsCents: number  // after mortgage payoff if applicable (can be negative = cash to close)
  monthlyFreedCents: number        // mortgage payment freed (if payoff)
  lumpSumAvailableCents: number    // respects 60% rule unless mortgage payoff
  locStartBalanceCents: number
  locProjections: Array<{ age: number; balanceCents: number }>
  tenureMonthlyCents: number
}

/**
 * Calculate all HECM figures for a client
 */
export function calculateHecm(input: HecmCalculationInput): HecmResult {
  const {
    currentHomeValueCents,
    existingMortgageBalanceCents,
    existingMortgagePaymentCents,
    homeAppreciationRateBps,
    hecmPayoutType,
    hecmTenureMonthlysCents,
    hecmLocGrowthRateBps,
    hecmPayoffMortgage,
    youngestBorrowerAge,
    yearsToRetirement,
    hecmPrincipalLimitCents,
    hecmAdditionalLumpSumCents,
  } = input

  // Project home value at retirement
  const projectedHomeValueCents = projectHomeValue(
    currentHomeValueCents,
    homeAppreciationRateBps,
    yearsToRetirement
  )

  // Use manually entered principal limit
  const principalLimitCents = hecmPrincipalLimitCents

  // Retirement age (still needed for LOC projection ages)
  const retirementAge = youngestBorrowerAge + yearsToRetirement

  // Mortgage payoff logic
  const monthlyFreedCents = (hecmPayoffMortgage && existingMortgagePaymentCents > 0)
    ? existingMortgagePaymentCents
    : 0

  const mortgagePayoffAmountCents = (hecmPayoffMortgage && existingMortgageBalanceCents > 0)
    ? existingMortgageBalanceCents
    : 0

  // Available proceeds after mortgage payoff (can be negative = cash to close)
  const availableProceedsCents = principalLimitCents - mortgagePayoffAmountCents

  // Lump sum: 60% rule applies UNLESS mortgage payoff
  let lumpSumAvailableCents: number
  if (hecmPayoffMortgage && existingMortgageBalanceCents > 0) {
    // Full principal limit available for mortgage payoff scenario
    lumpSumAvailableCents = availableProceedsCents
  } else {
    // 60% rule applies
    const sixtyPctLimit = Math.floor(principalLimitCents * 0.60)
    lumpSumAvailableCents = Math.min(availableProceedsCents, sixtyPctLimit)
  }

  // LOC starting balance:
  // - For 'loc' type: full available proceeds
  // - For 'lump_sum' with positive net proceeds: remainder after additional lump sum draw converts to LOC
  const locStartBalanceCents =
    hecmPayoutType === 'loc'
      ? Math.max(0, availableProceedsCents)
      : (hecmPayoutType === 'lump_sum' && availableProceedsCents > 0)
        ? Math.max(0, availableProceedsCents - hecmAdditionalLumpSumCents)
        : 0

  // LOC projections at ages 70, 75, 80, 85
  const locProjections: Array<{ age: number; balanceCents: number }> = []
  if (locStartBalanceCents > 0) {
    const locGrowthAnnual = hecmLocGrowthRateBps / 10000
    const projectionAges = [70, 75, 80, 85].filter(a => a > retirementAge)

    for (const projAge of projectionAges) {
      const yearsOfGrowth = projAge - retirementAge
      // Simplified: just show growth without draws for the projection table
      const projectedLoc = Math.floor(locStartBalanceCents * Math.pow(1 + locGrowthAnnual, yearsOfGrowth))
      locProjections.push({ age: projAge, balanceCents: projectedLoc })
    }
  }

  return {
    projectedHomeValueCents,
    principalLimitCents,
    availableProceedsCents,
    monthlyFreedCents,
    lumpSumAvailableCents,
    locStartBalanceCents,
    locProjections,
    tenureMonthlyCents: hecmPayoutType === 'tenure' ? hecmTenureMonthlysCents : 0,
  }
}
