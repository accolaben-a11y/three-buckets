export interface AgeBand {
  id: string
  start_age: number
  end_age: number
  monthly_amount_cents: number
}

export interface AgeBandWithMeta extends AgeBand {
  account_id?: string | null
  auto_created: boolean
  needs_review: boolean
}

export interface SurplusAck {
  start_age: number
  end_age: number
  amount_cents: number
  acknowledged: boolean
  acknowledged_at?: string
}

export interface AgeBands {
  bucket2: {
    draws: AgeBand[]
    deposits: AgeBandWithMeta[]
  }
  bucket3: {
    draws: AgeBand[]
    repayments: AgeBandWithMeta[]
  }
  surplus_acknowledgments: SurplusAck[]
}

/** Look up the band amount for a given age from an array of bands. Returns 0 if no band covers this age. */
export function getBandAmount(bands: AgeBand[], age: number): number {
  const band = bands.find(b => age >= b.start_age && age <= b.end_age)
  return band?.monthly_amount_cents ?? 0
}

/** Build a per-age record from an array of age bands */
export function buildAgeMap(bands: AgeBand[], fromAge: number, toAge: number): Record<number, number> {
  const result: Record<number, number> = {}
  for (let age = fromAge; age <= toAge; age++) {
    result[age] = getBandAmount(bands, age)
  }
  return result
}

/** Find all ages where any band in the list starts (excluding fromAge) */
export function getBandTransitionAges(bandsLists: AgeBand[][], fromAge: number, toAge: number): number[] {
  const ages = new Set<number>()
  for (const bands of bandsLists) {
    for (const band of bands) {
      if (band.start_age > fromAge && band.start_age <= toAge) {
        ages.add(band.start_age)
      }
    }
  }
  return Array.from(ages).sort((a, b) => a - b)
}

/** Return a default AgeBands with a single band covering retirement to planning horizon */
export function defaultAgeBands(retirementAge: number, planningHorizonAge: number): AgeBands {
  const bandId = () => Math.random().toString(36).slice(2)
  return {
    bucket2: {
      draws: [{ id: bandId(), start_age: retirementAge, end_age: planningHorizonAge, monthly_amount_cents: 0 }],
      deposits: [],
    },
    bucket3: {
      draws: [{ id: bandId(), start_age: retirementAge, end_age: planningHorizonAge, monthly_amount_cents: 0 }],
      repayments: [],
    },
    surplus_acknowledgments: [],
  }
}
