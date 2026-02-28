/**
 * HECM Calculation Logic
 */
import { calculatePrincipalLimit } from '@/lib/plf-tables'
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
}

export interface HecmResult {
  projectedHomeValueCents: number
  principalLimitCents: number
  availableProceedsCents: number  // after mortgage payoff if applicable
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
    hecmExpectedRateBps,
    hecmPayoutType,
    hecmTenureMonthlysCents,
    hecmLocGrowthRateBps,
    hecmPayoffMortgage,
    youngestBorrowerAge,
    yearsToRetirement,
    lendingLimitCents,
  } = input

  // Project home value at retirement
  const projectedHomeValueCents = projectHomeValue(
    currentHomeValueCents,
    homeAppreciationRateBps,
    yearsToRetirement
  )

  // Calculate principal limit at retirement age
  const retirementAge = youngestBorrowerAge + yearsToRetirement
  const principalLimitCents = calculatePrincipalLimit(
    projectedHomeValueCents,
    retirementAge,
    hecmExpectedRateBps,
    lendingLimitCents
  )

  // Mortgage payoff logic
  const monthlyFreedCents = (hecmPayoffMortgage && existingMortgagePaymentCents > 0)
    ? existingMortgagePaymentCents
    : 0

  const mortgagePayoffAmountCents = (hecmPayoffMortgage && existingMortgageBalanceCents > 0)
    ? existingMortgageBalanceCents
    : 0

  // Available proceeds after mortgage payoff
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

  // LOC starting balance
  const locStartBalanceCents = hecmPayoutType === 'loc'
    ? Math.max(0, availableProceedsCents)
    : 0

  // LOC projections at ages 70, 75, 80, 85
  const locProjections: Array<{ age: number; balanceCents: number }> = []
  if (hecmPayoutType === 'loc' && locStartBalanceCents > 0) {
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
