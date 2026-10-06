import { getTodayIST } from './dateUtils'

// Shared engine for the "Best Ever Week / Best Ever Month" columns of the
// company-wide (non-client) dashboard sections — TJ, MM Company Content and
// Sales & Outreach each store one jsonb object per channel/section per week
// and have no persisted high_scores table, so highs are computed on the fly
// by scanning history. (Per-client highs live in utils/highScores.ts.)

export interface HighEntry {
  value: number
  week: string
  monthValue: number | null
  month: string | null
}
export type LifetimeHighs = Record<string, HighEntry>

// [numeratorId, denominatorId, scale]: scale 100 = percentage (1 decimal),
// scale 1 = plain ratio (2 decimals, e.g. average impressions per post).
export type RatePair = [string, string, 100 | 1]

export interface LifetimeHighOptions {
  // Per-week rates/scores: a month's value is the average across its weeks.
  averagedIds?: ReadonlySet<string>
  // Running totals/snapshots: a month's value is the highest weekly reading,
  // not the sum.
  cumulativeIds?: ReadonlySet<string>
  // Never tracked (e.g. booleans — Number(true) would register a fake "1").
  excludeIds?: ReadonlySet<string>
  // Derived from the month's summed raw fields instead of summed/averaged
  // (a true rate can't be summed, and averaging weekly rates overweights
  // low-volume weeks).
  ratePairs?: Record<string, RatePair>
}

function readScalar(field: unknown): number | null {
  const raw = typeof field === 'object' && field !== null && 'value' in (field as object)
    ? (field as { value: unknown }).value
    : field
  // Number('') is 0, not NaN — a cleared field must read as "no data".
  if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null
  if (typeof raw === 'string' && raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function computeLifetimeHighs(
  rows: any[],
  columns: readonly string[],
  { averagedIds = new Set(), cumulativeIds = new Set(), excludeIds = new Set(), ratePairs = {} }: LifetimeHighOptions = {},
): LifetimeHighs {
  const weeklyBest: Record<string, { value: number; week: string }> = {}
  const monthSums: Record<string, Record<string, number>> = {}
  const monthCounts: Record<string, Record<string, number>> = {}

  for (const row of rows) {
    const month = String(row.week_start).slice(0, 7)
    for (const column of columns) {
      const metrics = row[column] as Record<string, unknown> | null
      if (!metrics) continue
      for (const [metricId, field] of Object.entries(metrics)) {
        if (excludeIds.has(metricId)) continue
        const n = readScalar(field)
        if (n === null) continue
        // A best of 0 is not a record (matches the per-client path, which
        // requires > 0) — it would just show "Best ever 0" with a date.
        if (n > 0 && (!weeklyBest[metricId] || n > weeklyBest[metricId].value)) {
          weeklyBest[metricId] = { value: n, week: row.week_start }
        }
        monthSums[month] = monthSums[month] ?? {}
        monthCounts[month] = monthCounts[month] ?? {}
        monthSums[month][metricId] = cumulativeIds.has(metricId)
          ? Math.max(monthSums[month][metricId] ?? 0, n)
          : (monthSums[month][metricId] ?? 0) + n
        monthCounts[month][metricId] = (monthCounts[month][metricId] ?? 0) + 1
      }
    }
  }

  // The still-in-progress month is excluded from "best month": a volume
  // metric is naturally short, a rate is incomplete — either could set a
  // record that hasn't been earned yet.
  const currentMonth = getTodayIST().slice(0, 7)
  const monthlyBest: Record<string, { value: number; month: string }> = {}
  const consider = (id: string, value: number, month: string) => {
    if (!monthlyBest[id] || value > monthlyBest[id].value) monthlyBest[id] = { value, month }
  }
  for (const [month, sums] of Object.entries(monthSums)) {
    if (month === currentMonth) continue
    for (const [id, sum] of Object.entries(sums)) {
      if (ratePairs[id]) continue
      consider(id, averagedIds.has(id) ? sum / monthCounts[month][id] : sum, month)
    }
    for (const [id, [numId, denId, scale]] of Object.entries(ratePairs)) {
      if (sums[numId] === undefined || !(sums[denId] > 0)) continue
      const ratio = sums[numId] / sums[denId]
      consider(id, scale === 100 ? Math.round(ratio * 1000) / 10 : Math.round(ratio * 100) / 100, month)
    }
  }

  const highs: LifetimeHighs = {}
  for (const id of new Set([...Object.keys(weeklyBest), ...Object.keys(monthlyBest)])) {
    // A metric that has only ever been 0 has no record to show.
    if (!weeklyBest[id] && !(monthlyBest[id]?.value > 0)) continue
    highs[id] = {
      value: weeklyBest[id]?.value ?? 0,
      week: weeklyBest[id]?.week ?? '',
      monthValue: monthlyBest[id]?.value ?? null,
      month: monthlyBest[id]?.month ?? null,
    }
  }
  return highs
}
