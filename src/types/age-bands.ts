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

/** Return a default AgeBands with a single band covering age 62 to planning horizon */
export function defaultAgeBands(_retirementAge: number, planningHorizonAge: number): AgeBands {
  const bandId = () => Math.random().toString(36).slice(2)
  return {
    bucket2: {
      draws: [{ id: bandId(), start_age: 62, end_age: planningHorizonAge, monthly_amount_cents: 0 }],
      deposits: [],
    },
    bucket3: {
      draws: [{ id: bandId(), start_age: 62, end_age: planningHorizonAge, monthly_amount_cents: 0 }],
      repayments: [],
    },
    surplus_acknowledgments: [],
  }
}

/**
 * Add `addCents` to all bands that overlap the age range [startAge, endAge].
 * Splits bands at the boundaries so the target range gets its own segments.
 */
export function autoFillRange<T extends AgeBand>(
  bands: T[],
  startAge: number,
  endAge: number,
  addCents: number,
): T[] {
  if (addCents === 0) return bands
  const result: T[] = []
  for (const band of bands) {
    if (band.end_age < startAge || band.start_age > endAge) {
      result.push(band)
      continue
    }
    const newId = () => Math.random().toString(36).slice(2, 10)
    if (band.start_age < startAge) {
      result.push({ ...band, id: newId(), end_age: startAge - 1 })
    }
    result.push({
      ...band,
      id: newId(),
      start_age: Math.max(band.start_age, startAge),
      end_age: Math.min(band.end_age, endAge),
      monthly_amount_cents: band.monthly_amount_cents + addCents,
    })
    if (band.end_age > endAge) {
      result.push({ ...band, id: newId(), start_age: endAge + 1 })
    }
  }
  return result.sort((a, b) => a.start_age - b.start_age)
}
