// Targets are stored one row per (client, metric, period) — teams don't re-enter
// a target every single week/month, so most periods have no exact row. Every
// caller should fetch a range of periods (e.g. `.lte('period', currentPeriod)`)
// rather than an exact match, then use findTarget() to prefer an exact match
// for the period being viewed and otherwise fall back to the most recently
// set target for that metric. Skipping the fallback silently treats "no target
// re-entered this period" as "target is 0", which cascades into wrong
// achievement percentages and — in health.ts — a corrupted stored health score.
export function findTarget(rows: any[], metricId: string, period?: string): number | null {
  let t = period
    ? rows.find(r => r.metric_id === metricId && r.period === period)
    : null
  if (!t) {
    const all = rows
      .filter(r => r.metric_id === metricId && r.target_value !== null && r.target_value !== undefined)
      .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
    t = all[0] ?? null
  }
  if (!t || t.target_value === null || t.target_value === undefined) return null
  const n = Number(t.target_value)
  return isNaN(n) ? null : n
}
