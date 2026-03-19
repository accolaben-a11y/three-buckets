'use client'

interface AgeRange {
  startAge: number
  endAge: number
  avgCents: number
}

function groupAges(surplusByAge: Record<number, number>, negative: boolean): AgeRange[] {
  const ages = Object.keys(surplusByAge).map(Number).sort((a, b) => a - b)
  const ranges: AgeRange[] = []
  let current: { start: number; end: number; vals: number[] } | null = null

  for (const age of ages) {
    const val = surplusByAge[age]
    const matches = negative ? val < 0 : val > 0
    if (matches) {
      if (current && age === current.end + 1) {
        current.end = age
        current.vals.push(Math.abs(val))
      } else {
        if (current) ranges.push({ startAge: current.start, endAge: current.end, avgCents: Math.round(current.vals.reduce((a, b) => a + b, 0) / current.vals.length) })
        current = { start: age, end: age, vals: [Math.abs(val)] }
      }
    } else {
      if (current) {
        ranges.push({ startAge: current.start, endAge: current.end, avgCents: Math.round(current.vals.reduce((a, b) => a + b, 0) / current.vals.length) })
        current = null
      }
    }
  }
  if (current) ranges.push({ startAge: current.start, endAge: current.end, avgCents: Math.round(current.vals.reduce((a, b) => a + b, 0) / current.vals.length) })
  return ranges
}

interface Props {
  surplusByAge: Record<number, number>
  acknowledgedKeys?: Set<string>
  onOpenDrawer: () => void
}

export default function AllocationBanner({ surplusByAge, acknowledgedKeys, onOpenDrawer }: Props) {
  const shortfallRanges = groupAges(surplusByAge, true).filter(r => !acknowledgedKeys?.has(`${r.startAge}-${r.endAge}`))
  const surplusRanges = groupAges(surplusByAge, false).filter(r => !acknowledgedKeys?.has(`${r.startAge}-${r.endAge}`))

  if (shortfallRanges.length === 0 && surplusRanges.length === 0) return null

  const hasShortfalls = shortfallRanges.length > 0
  const hasSurpluses = surplusRanges.length > 0

  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-4 shadow-sm cursor-pointer transition-colors ${
        hasShortfalls
          ? 'bg-red-50 border-red-200 hover:bg-red-100'
          : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
      }`}
      onClick={onOpenDrawer}
    >
      <div className="flex flex-wrap gap-3 text-sm">
        {hasShortfalls && (
          <span className="text-red-700 font-medium">
            ⚠ Shortfall in {shortfallRanges.length} age range{shortfallRanges.length > 1 ? 's' : ''}
            {' '}({shortfallRanges.map(r => r.startAge === r.endAge ? `${r.startAge}` : `${r.startAge}–${r.endAge}`).join(', ')})
          </span>
        )}
        {hasSurpluses && (
          <span className="text-amber-700 font-medium">
            ↑ Surplus in {surplusRanges.length} age range{surplusRanges.length > 1 ? 's' : ''}
            {' '}({surplusRanges.map(r => r.startAge === r.endAge ? `${r.startAge}` : `${r.startAge}–${r.endAge}`).join(', ')})
          </span>
        )}
      </div>
      <button className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
        hasShortfalls
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-amber-600 text-white hover:bg-amber-700'
      }`}>
        View Details
      </button>
    </div>
  )
}

export { groupAges }
export type { AgeRange }
