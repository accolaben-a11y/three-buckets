/**
 * Retirement Phase Calculations
 * Models cash flow depletion from retirement age to planning horizon.
 * Uses per-age draw/deposit/repayment maps derived from age bands.
 */

export interface YearlySnapshot {
  age: number
  bucket1IncomeCents: number
  bucket2BalanceCents: number
  bucket2DrawCents: number
  bucket3BalanceCents: number
  bucket3DrawCents: number
  totalIncomeCents: number
  targetIncomeCents: number
  surplusCents: number  // positive = surplus over target, negative = shortfall
}

export interface RetirementProjectionInput {
  retirementAge: number
  planningHorizonAge: number

  // Bucket 1 — income streams with effective amounts per age
  bucket1MonthlyByAge: Record<number, number>

  // Bucket 2 — nest egg (per-age maps from age bands)
  bucket2StartBalanceCents: number
  bucket2AnnualRateBps: number
  bucket2DrawsByAge: Record<number, number>
  bucket2DepositsByAge: Record<number, number>

  // Bucket 3 — HECM (per-age maps from age bands)
  bucket3Type: 'none' | 'lump_sum' | 'loc' | 'tenure'
  bucket3StartBalanceCents: number
  bucket3LocGrowthRateBps: number
  bucket3DrawsByAge: Record<number, number>
  bucket3RepaymentsByAge: Record<number, number>

  // Income target
  targetMonthlyIncomeCents: number
  inflationRateBps: number

  // Survivor event (optional)
  survivorEventAge?: number
  survivorBucket1MonthlyByAge?: Record<number, number>

  // Age-triggered one-time reallocation events (legacy transition_events)
  ageTriggeredEvents?: Record<number, { bucket2Cents: number; bucket3Cents: number }>
}

/**
 * Run full retirement phase projection.
 * Returns yearly snapshots from retirement age to planning horizon.
 */
export function projectRetirementPhase(input: RetirementProjectionInput): YearlySnapshot[] {
  const {
    retirementAge,
    planningHorizonAge,
    bucket1MonthlyByAge,
    bucket2StartBalanceCents,
    bucket2AnnualRateBps,
    bucket2DrawsByAge,
    bucket2DepositsByAge,
    bucket3Type,
    bucket3StartBalanceCents,
    bucket3LocGrowthRateBps,
    bucket3DrawsByAge,
    bucket3RepaymentsByAge,
    targetMonthlyIncomeCents,
    inflationRateBps,
    survivorEventAge,
    survivorBucket1MonthlyByAge,
    ageTriggeredEvents,
  } = input

  const snapshots: YearlySnapshot[] = []
  const nest2MonthlyRate = (bucket2AnnualRateBps / 10000) / 12
  const locMonthlyRate = (bucket3LocGrowthRateBps / 10000) / 12

  let b2Bal = bucket2StartBalanceCents
  let b3Bal = bucket3StartBalanceCents
  let targetMonthly = targetMonthlyIncomeCents

  for (let year = 0; year <= planningHorizonAge - retirementAge; year++) {
    const age = retirementAge + year

    // Apply inflation to target (per year)
    if (year > 0) {
      targetMonthly = Math.floor(targetMonthly * Math.pow(1 + inflationRateBps / 10000, 1))
    }

    // Apply age-triggered one-time reallocation events (from legacy transition_events)
    if (ageTriggeredEvents?.[age]) {
      b2Bal += ageTriggeredEvents[age].bucket2Cents
      b3Bal += ageTriggeredEvents[age].bucket3Cents
    }

    const usesSurvivor = survivorEventAge !== undefined && age >= survivorEventAge
    const b1Map = usesSurvivor && survivorBucket1MonthlyByAge
      ? survivorBucket1MonthlyByAge
      : bucket1MonthlyByAge
    const b1Income = b1Map[age] ?? 0

    // Per-age draw/deposit/repayment values from age bands
    const b2Draw = bucket2DrawsByAge[age] ?? 0
    const b2Deposit = bucket2DepositsByAge[age] ?? 0
    const b3Draw = bucket3DrawsByAge[age] ?? 0
    const b3Repayment = bucket3RepaymentsByAge[age] ?? 0

    // Simulate 12 months for this year
    for (let m = 0; m < 12; m++) {
      if (b2Bal > 0) {
        b2Bal = Math.floor(b2Bal * (1 + nest2MonthlyRate))
        b2Bal = Math.max(0, b2Bal - b2Draw)
      }
      if (b3Bal > 0) {
        b3Bal = Math.floor(b3Bal * (1 + locMonthlyRate))
        b3Bal = Math.max(0, b3Bal - b3Draw)
      }
      // Deposits and repayments applied after draws
      if (b2Deposit > 0) b2Bal += b2Deposit
      if (b3Repayment > 0) b3Bal += b3Repayment
    }

    // Effective draw this year (capped at available balance)
    const effectiveB2Draw = b2Bal <= 0 ? 0 : b2Draw
    const effectiveB3Draw = bucket3Type === 'none' ? 0 : (b3Bal <= 0 ? 0 : b3Draw)

    const totalMonthlyIncome = b1Income + effectiveB2Draw + effectiveB3Draw
    const surplusCents = totalMonthlyIncome - targetMonthly

    snapshots.push({
      age,
      bucket1IncomeCents: b1Income,
      bucket2BalanceCents: b2Bal,
      bucket2DrawCents: effectiveB2Draw,
      bucket3BalanceCents: b3Bal,
      bucket3DrawCents: effectiveB3Draw,
      totalIncomeCents: totalMonthlyIncome,
      targetIncomeCents: targetMonthly,
      surplusCents,
    })

    if (age >= planningHorizonAge) break
  }

  return snapshots
}

/**
 * Determine when each bucket depletes (returns age, or null if it doesn't deplete)
 */
export function findDepletionAges(snapshots: YearlySnapshot[]): {
  bucket2DepletionAge: number | null
  bucket3DepletionAge: number | null
} {
  let bucket2DepletionAge: number | null = null
  let bucket3DepletionAge: number | null = null

  for (const snap of snapshots) {
    if (bucket2DepletionAge === null && snap.bucket2BalanceCents <= 0) {
      bucket2DepletionAge = snap.age
    }
    if (bucket3DepletionAge === null && snap.bucket3BalanceCents <= 0) {
      bucket3DepletionAge = snap.age
    }
  }

  return { bucket2DepletionAge, bucket3DepletionAge }
}
