/**
 * Retirement Phase Calculations
 * Models cash flow depletion from age 62 to planning horizon.
 */

export interface MonthlySnapshot {
  age: number
  month: number // month index from retirement start
  bucket1IncomeCents: number
  bucket2BalanceCents: number
  bucket2DrawCents: number
  bucket3BalanceCents: number
  bucket3DrawCents: number
  totalIncomeCents: number
  targetIncomeCents: number
  shortfallCents: number
  surplusCents: number
}

export interface YearlySnapshot {
  age: number
  bucket1IncomeCents: number
  bucket2BalanceCents: number
  bucket3BalanceCents: number
  totalIncomeCents: number
  targetIncomeCents: number
}

export interface RetirementProjectionInput {
  retirementAge: number
  planningHorizonAge: number

  // Bucket 1 — income streams with effective amounts per age
  bucket1MonthlyByAge: Record<number, number> // age -> monthly income cents

  // Bucket 2 — nest egg
  bucket2StartBalanceCents: number
  bucket2MonthlyDrawCents: number
  bucket2AnnualRateBps: number

  // Bucket 3 — HECM
  bucket3Type: 'none' | 'lump_sum' | 'loc' | 'tenure'
  bucket3StartBalanceCents: number   // LOC starting balance (after any mortgage payoff)
  bucket3MonthlyDrawCents: number    // LOC draw or tenure payment
  bucket3LocGrowthRateBps: number

  // Income target
  targetMonthlyIncomeCents: number
  inflationRateBps: number

  // Survivor event (optional)
  survivorEventAge?: number
  survivorBucket1MonthlyByAge?: Record<number, number>
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
    bucket2MonthlyDrawCents,
    bucket2AnnualRateBps,
    bucket3Type,
    bucket3StartBalanceCents,
    bucket3MonthlyDrawCents,
    bucket3LocGrowthRateBps,
    targetMonthlyIncomeCents,
    inflationRateBps,
    survivorEventAge,
    survivorBucket1MonthlyByAge,
  } = input

  const snapshots: YearlySnapshot[] = []
  const totalMonths = (planningHorizonAge - retirementAge) * 12
  const inflationMonthlyRate = Math.pow(1 + inflationRateBps / 10000, 1 / 12) - 1
  const nest2MonthlyRate = (bucket2AnnualRateBps / 10000) / 12
  const locMonthlyRate = (bucket3LocGrowthRateBps / 10000) / 12

  let bucket2Balance = bucket2StartBalanceCents
  let bucket3Balance = bucket3Type === 'loc' ? bucket3StartBalanceCents : 0
  let currentTargetMonthly = targetMonthlyIncomeCents

  // Accumulate monthly for yearly snapshots
  const ageMonthlyB1: Record<number, number[]> = {}

  for (let m = 0; m < totalMonths; m++) {
    const currentAge = retirementAge + Math.floor(m / 12)
    if (currentAge > planningHorizonAge) break

    // Inflation adjusts target annually
    if (m > 0 && m % 12 === 0) {
      for (let i = 0; i < 12; i++) {
        currentTargetMonthly = Math.floor(currentTargetMonthly * (1 + inflationMonthlyRate))
      }
    }

    // Determine active income streams for this age
    const usesSurvivor = survivorEventAge !== undefined && currentAge >= survivorEventAge
    const b1Map = usesSurvivor && survivorBucket1MonthlyByAge
      ? survivorBucket1MonthlyByAge
      : bucket1MonthlyByAge
    const b1Income = b1Map[currentAge] ?? 0

    if (!ageMonthlyB1[currentAge]) ageMonthlyB1[currentAge] = []
    ageMonthlyB1[currentAge].push(b1Income)

    // Bucket 2: grow then draw
    if (bucket2Balance > 0) {
      bucket2Balance = Math.floor(bucket2Balance * (1 + nest2MonthlyRate))
      bucket2Balance = Math.max(0, bucket2Balance - bucket2MonthlyDrawCents)
    }

    // Bucket 3 LOC: grow then draw
    if (bucket3Type === 'loc' && bucket3Balance > 0) {
      bucket3Balance = Math.floor(bucket3Balance * (1 + locMonthlyRate))
      bucket3Balance = Math.max(0, bucket3Balance - bucket3MonthlyDrawCents)
    }
  }

  // Build yearly snapshots
  let b2Bal = bucket2StartBalanceCents
  let b3Bal = bucket3Type === 'loc' ? bucket3StartBalanceCents : 0
  let targetMonthly = targetMonthlyIncomeCents

  for (let year = 0; year <= planningHorizonAge - retirementAge; year++) {
    const age = retirementAge + year

    // Apply inflation to target (per year)
    if (year > 0) {
      targetMonthly = Math.floor(targetMonthly * Math.pow(1 + inflationRateBps / 10000, 1))
    }

    const usesSurvivor = survivorEventAge !== undefined && age >= survivorEventAge
    const b1Map = usesSurvivor && survivorBucket1MonthlyByAge
      ? survivorBucket1MonthlyByAge
      : bucket1MonthlyByAge
    const b1Income = b1Map[age] ?? 0

    // Simulate 12 months for this year
    for (let m = 0; m < 12; m++) {
      if (b2Bal > 0) {
        b2Bal = Math.floor(b2Bal * (1 + nest2MonthlyRate))
        b2Bal = Math.max(0, b2Bal - bucket2MonthlyDrawCents)
      }
      if (bucket3Type === 'loc' && b3Bal > 0) {
        b3Bal = Math.floor(b3Bal * (1 + locMonthlyRate))
        b3Bal = Math.max(0, b3Bal - bucket3MonthlyDrawCents)
      }
    }

    const b3Draw = bucket3Type === 'tenure' ? bucket3MonthlyDrawCents : bucket3MonthlyDrawCents
    const totalMonthlyIncome = b1Income + bucket2MonthlyDrawCents + b3Draw

    snapshots.push({
      age,
      bucket1IncomeCents: b1Income,
      bucket2BalanceCents: b2Bal,
      bucket3BalanceCents: b3Bal,
      totalIncomeCents: totalMonthlyIncome,
      targetIncomeCents: targetMonthly,
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
