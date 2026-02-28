/**
 * Accumulation Phase Calculations
 * Models growth of nest egg accounts from current age to retirement age.
 */

export interface AccountAccumulation {
  accountId: string
  label: string
  currentBalanceCents: number
  projectedBalanceCents: number
  monthsToRetirement: number
}

/**
 * Project future value of a nest egg account.
 * FV = PV × (1 + r)^n + PMT × [((1 + r)^n - 1) / r]
 *
 * @param currentBalanceCents - Current account balance in cents
 * @param monthlyContributionCents - Monthly contribution in cents
 * @param annualRateBps - Annual rate of return in basis points
 * @param monthsToRetirement - Number of months until retirement age
 * @returns Projected balance in cents at retirement
 */
export function projectAccountBalance(
  currentBalanceCents: number,
  monthlyContributionCents: number,
  annualRateBps: number,
  monthsToRetirement: number
): number {
  if (monthsToRetirement <= 0) return currentBalanceCents

  const annualRate = annualRateBps / 10000
  const r = annualRate / 12

  if (r === 0) {
    return currentBalanceCents + monthlyContributionCents * monthsToRetirement
  }

  const growth = Math.pow(1 + r, monthsToRetirement)
  const fv = currentBalanceCents * growth + monthlyContributionCents * ((growth - 1) / r)
  return Math.floor(fv)
}

/**
 * Project home value at retirement.
 * FV = Current Value × (1 + appreciation_rate)^years
 */
export function projectHomeValue(
  currentValueCents: number,
  appreciationRateBps: number,
  yearsToRetirement: number
): number {
  if (yearsToRetirement <= 0) return currentValueCents
  const rate = appreciationRateBps / 10000
  return Math.floor(currentValueCents * Math.pow(1 + rate, yearsToRetirement))
}
