/**
 * Income (Bucket 1) Calculations
 * Builds per-age monthly income maps for the retirement projection.
 */

export interface IncomeItemInput {
  id: string
  owner: 'primary' | 'spouse' | 'joint'
  type: 'social_security' | 'wage' | 'commission' | 'business' | 'pension' | 'other'
  label: string
  monthlyAmountCents: number
  startAge: number
  endAge: number | null
  ssAge62Cents?: number | null
  ssAge67Cents?: number | null
  ssAge70Cents?: number | null
  ssClaimAge?: number | null
  pensionSurvivorPct?: number | null // basis points
}

export interface SurvivorConfig {
  survivorEventAge: number
  survivorSpouse: 'primary' | 'spouse'
}

/**
 * Get the effective monthly SS amount for a given claim age and item
 */
export function getSsMonthlyAmount(item: IncomeItemInput, claimAge: number): number {
  if (item.type !== 'social_security') return item.monthlyAmountCents

  switch (claimAge) {
    case 62: return item.ssAge62Cents ?? item.monthlyAmountCents
    case 67: return item.ssAge67Cents ?? item.monthlyAmountCents
    case 70: return item.ssAge70Cents ?? item.monthlyAmountCents
    default: return item.ssAge67Cents ?? item.monthlyAmountCents
  }
}

/**
 * Build a per-age monthly income map from income items.
 * Returns: Record<age, totalMonthlyCents> from retirementAge to planningHorizonAge
 */
export function buildIncomeByAge(
  items: IncomeItemInput[],
  retirementAge: number,
  planningHorizonAge: number,
  ssPrimaryClaimAge: number,
  ssSpouseClaimAge: number,
  survivorConfig?: SurvivorConfig
): Record<number, number> {
  const result: Record<number, number> = {}

  for (let age = retirementAge; age <= planningHorizonAge; age++) {
    let total = 0
    for (const item of items) {
      const effectiveStart = Math.max(item.startAge, retirementAge)
      const effectiveEnd = item.endAge ?? planningHorizonAge

      if (age < effectiveStart || age > effectiveEnd) continue

      // Skip income belonging to the deceased spouse in survivor scenario
      if (survivorConfig && age >= survivorConfig.survivorEventAge) {
        if (survivorConfig.survivorSpouse === 'primary' && item.owner === 'spouse') {
          // primary predeceased, skip spouse income that doesn't have survivor benefit
          if (item.type !== 'pension') continue
        }
        if (survivorConfig.survivorSpouse === 'spouse' && item.owner === 'primary') {
          if (item.type !== 'pension') continue
        }
      }

      if (item.type === 'social_security') {
        const claimAge = item.owner === 'spouse' ? ssSpouseClaimAge : ssPrimaryClaimAge
        if (age < claimAge) continue // SS not yet claimed

        // Survivor SS: pay higher of two benefits
        if (survivorConfig && age >= survivorConfig.survivorEventAge) {
          // This is handled separately — skip individual SS items for survivor
          continue
        }

        total += getSsMonthlyAmount(item, claimAge)
      } else if (item.type === 'pension' && survivorConfig && age >= survivorConfig.survivorEventAge) {
        // Apply survivor pension percentage
        const survivorPct = item.pensionSurvivorPct ?? 0
        total += Math.floor(item.monthlyAmountCents * survivorPct / 10000)
      } else {
        total += item.monthlyAmountCents
      }
    }
    result[age] = total
  }

  return result
}

/**
 * Build income map for survivor scenario — applies SS survivor rules (higher of two)
 */
export function buildSurvivorIncomeByAge(
  items: IncomeItemInput[],
  retirementAge: number,
  planningHorizonAge: number,
  ssPrimaryClaimAge: number,
  ssSpouseClaimAge: number,
  survivorConfig: SurvivorConfig
): Record<number, number> {
  const result: Record<number, number> = {}

  // Find SS items for both spouses
  const primarySsItems = items.filter(i => i.type === 'social_security' && i.owner === 'primary')
  const spouseSsItems = items.filter(i => i.type === 'social_security' && i.owner === 'spouse')

  for (let age = survivorConfig.survivorEventAge; age <= planningHorizonAge; age++) {
    let total = 0

    // Non-SS income for the surviving spouse
    for (const item of items) {
      if (item.type === 'social_security') continue

      const effectiveEnd = item.endAge ?? planningHorizonAge
      if (age < item.startAge || age > effectiveEnd) continue

      const deceasedOwner = survivorConfig.survivorSpouse === 'primary' ? 'spouse' : 'primary'
      if (item.owner === deceasedOwner) {
        // Apply pension survivor pct
        if (item.type === 'pension') {
          const pct = item.pensionSurvivorPct ?? 0
          total += Math.floor(item.monthlyAmountCents * pct / 10000)
        }
        // Skip other income from deceased
        continue
      }

      total += item.monthlyAmountCents
    }

    // SS survivor benefit: higher of primary or spousal SS
    const primarySsMonthly = primarySsItems.reduce((sum, item) => {
      if (age < ssPrimaryClaimAge) return sum
      return sum + getSsMonthlyAmount(item, ssPrimaryClaimAge)
    }, 0)

    const spouseSsMonthly = spouseSsItems.reduce((sum, item) => {
      if (age < ssSpouseClaimAge) return sum
      return sum + getSsMonthlyAmount(item, ssSpouseClaimAge)
    }, 0)

    // SS survivor rule: surviving spouse receives higher of their own or deceased's benefit
    const survivorSs = Math.max(primarySsMonthly, spouseSsMonthly)
    total += survivorSs

    result[age] = total
  }

  return result
}

/**
 * Calculate bridge period cost when SS is deferred past retirement age.
 */
export function calculateBridgePeriod(
  items: IncomeItemInput[],
  retirementAge: number,
  ssPrimaryClaimAge: number,
  ssSpouseClaimAge: number
): {
  hasBridgePeriod: boolean
  bridgeStartAge: number
  bridgeEndAge: number
  monthlyGapCents: number
  totalBridgeCostCents: number
} {
  const latestClaimAge = Math.max(ssPrimaryClaimAge, ssSpouseClaimAge)

  if (latestClaimAge <= retirementAge) {
    return {
      hasBridgePeriod: false,
      bridgeStartAge: retirementAge,
      bridgeEndAge: retirementAge,
      monthlyGapCents: 0,
      totalBridgeCostCents: 0,
    }
  }

  // Income gap = SS benefits not being received during deferral
  let monthlyGap = 0
  const ssItems = items.filter(i => i.type === 'social_security')

  for (const item of ssItems) {
    const claimAge = item.owner === 'spouse' ? ssSpouseClaimAge : ssPrimaryClaimAge
    if (claimAge > retirementAge) {
      monthlyGap += getSsMonthlyAmount(item, claimAge)
    }
  }

  const bridgeMonths = (latestClaimAge - retirementAge) * 12

  return {
    hasBridgePeriod: true,
    bridgeStartAge: retirementAge,
    bridgeEndAge: latestClaimAge,
    monthlyGapCents: monthlyGap,
    totalBridgeCostCents: monthlyGap * bridgeMonths,
  }
}
