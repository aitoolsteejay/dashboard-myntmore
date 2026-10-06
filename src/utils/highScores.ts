import { supabase } from '@/integrations/supabase/client'
import { readNum, readLinkedInImpressions, calcRateCapped } from './readMetric'
import { customMetricToMetric } from '@/hooks/useEffectiveMetrics'
import { ALL_METRICS } from '@/data/metrics'
import { RATE_DEPENDENCIES } from './rateAggregation'
import { getTodayIST } from './dateUtils'
import { CUMULATIVE_METRIC_IDS, LOWER_IS_BETTER_METRIC_IDS } from '@/data/metricSemantics'

const rateMetricName = (id: string) => ALL_METRICS.find(m => m.id === id)?.name ?? id

// Custom metrics are always number/percentage/textarea (never 'auto'), so unlike
// TRACKED_METRICS they need none of the special live-calc branches below — just
// a plain readNum(col, id) the same way most standard metrics already work.
async function fetchNumericCustomMetrics(clientId: string) {
  const { data, error } = await supabase
    .from('custom_metrics')
    .select('*')
    .eq('client_id', clientId)
    .eq('archived', false)
    .neq('type', 'textarea')
  if (error) throw error
  return (data ?? []).map(customMetricToMetric)
}

/**
 * Scans ALL historical weekly_data rows for a client and upserts true all-time highs.
 * Call this from the dashboard on load to self-heal any missing/stale high score records.
 */
export async function backfillHighScores(clientId: string): Promise<void> {
  // Fetch every weekly row for this client
  const { data: rows, error } = await supabase
    .from('weekly_data')
    .select('week_start, content_metrics, leadgen_metrics')
    .eq('client_id', clientId)

  if (error) throw error
  if (!rows || rows.length === 0) return

  const customMetrics = await fetchNumericCustomMetrics(clientId)
  // Any percentage-type metric (standard or custom) is a per-week rate: a
  // recorded 0% is a meaningful, real week (unlike a volume metric, where 0
  // usually just means "no data entered") and must count toward the monthly
  // average — see the two uses below.
  // Sliders (Happiness Index) are per-week scores, so they average like rates.
  const percentageIds = new Set(
    [...ALL_METRICS, ...customMetrics].filter(m => m.type === 'percentage' || m.type === 'slider').map(m => m.id)
  )

  // Track best single-week value and which week it was achieved
  const best: Record<string, { value: number; week: string; name: string }> = {}
  // Track per-month sums of the raw underlying counters, to derive monthly bests
  const monthSums: Record<string, Record<string, number>> = {}
  const monthCounts: Record<string, Record<string, number>> = {}

  const addToMonth = (month: string, id: string, val: number) => {
    if (!monthSums[month]) monthSums[month] = {}
    if (!monthCounts[month]) monthCounts[month] = {}
    monthSums[month][id] = CUMULATIVE_METRIC_IDS.has(id)
      ? Math.max(monthSums[month][id] ?? 0, val)
      : (monthSums[month][id] ?? 0) + val
    monthCounts[month][id] = (monthCounts[month][id] ?? 0) + 1
  }

  for (const row of rows) {
    const cm = row.content_metrics as Record<string, any> ?? {}
    const lm = row.leadgen_metrics as Record<string, any> ?? {}
    const weekStart = row.week_start
    const month = weekStart.slice(0, 7)

    // Compute auto-calculated metrics that may not be stored directly
    const C06 = readNum(cm, 'C06'), C07 = readNum(cm, 'C07'), C08 = readNum(cm, 'C08')
    const C09stored = readNum(cm, 'C09')
    const C09computed = (C06 ?? 0) + (C07 ?? 0) + (C08 ?? 0)
    const C09 = C09stored ?? (C09computed > 0 ? C09computed : null)
    const C10 = readLinkedInImpressions(cm)
    const C26 = C09 && C09 > 0 && C10 ? Math.round((C10 / C09) * 100) / 100 : null

    TRACKED_METRICS.forEach(({ id, name, category }) => {
      const col = category === 'content' ? cm : lm
      // Use computed values for auto metrics
      let val: number | null = null
      if (id === 'C09') val = C09
      else if (id === 'C10') val = C10
      else if (id === 'C26') val = C26
      else val = readNum(col, id)
      if (val !== null) {
        if (val > 0 && (!best[id] || val > best[id].value)) {
          best[id] = { value: val, week: weekStart, name }
        }
        // Percentage-type metrics are averaged monthly, so a recorded 0% is
        // meaningful and must count as a week. C26 is derived separately and
        // not summed.
        if (id !== 'C26' && (val > 0 || percentageIds.has(id))) addToMonth(month, id, val)
      }
    })

    customMetrics.forEach(m => {
      const col = m.category === 'content' ? cm : lm
      const val = readNum(col, m.id)
      if (val !== null) {
        if (val > 0 && (!best[m.id] || val > best[m.id].value)) {
          best[m.id] = { value: val, week: weekStart, name: m.name }
        }
        if (val > 0 || percentageIds.has(m.id)) addToMonth(month, m.id, val)
      }
    })

    // Computed rates — every id in RATE_DEPENDENCIES (not just L12/L14/L17),
    // or L05/L18/L21/L26 silently never got a "best week" record at all.
    Object.entries(RATE_DEPENDENCIES).forEach(([id, [numId, denId]]) => {
      const rate = calcRateCapped(readNum(lm, numId), readNum(lm, denId))
      if (rate !== null && rate > 0 && (!best[id] || rate > best[id].value)) {
        best[id] = { value: rate, week: weekStart, name: rateMetricName(id) }
      }
    })
  }

  // Derive monthly bests: sum of underlying counters per month, max across all months.
  // Rate metrics (L12/L14/L17) are derived from the monthly sums of their inputs,
  // since rates can't be summed across weeks.
  //
  // A volume metric (posts, impressions, etc.) is naturally disadvantaged by a
  // partial, still-in-progress month — fewer weeks means a smaller sum, so it
  // can't unfairly win a "best month" record. A RATE is a valid ratio no
  // matter how few weeks contributed, though, so without this guard a strong
  // week or two early in the current month could set a "Best Month" record
  // that hasn't actually been earned yet — and would silently vanish (revert
  // to the true historical best) the next time this runs, once the rest of
  // the month's weaker weeks are counted.
  const currentMonth = getTodayIST().slice(0, 7)
  const bestMonth: Record<string, { value: number; month: string }> = {}
  for (const [month, sums] of Object.entries(monthSums)) {
    for (const [id, value] of Object.entries(sums)) {
      // An averaged metric is "valid" after a single week (one week's score
      // is a perfectly good-looking average), so — like the rates below — the
      // still-in-progress month must not set a Best Month for it; volume
      // metrics are naturally short and can't unfairly win.
      if (month === currentMonth && percentageIds.has(id)) continue
      const monthlyValue = percentageIds.has(id)
        ? value / (monthCounts[month]?.[id] ?? 1)
        : value
      if (!bestMonth[id] || monthlyValue > bestMonth[id].value) {
        bestMonth[id] = { value: monthlyValue, month }
      }
    }
    if (month === currentMonth) continue
    // C26 (Avg Impressions Per Post) is a ratio: month impressions / month
    // posts. It was skipped in the weekly sums above, so it never got a
    // Best Month at all.
    if ((sums.C09 ?? 0) > 0 && sums.C10 !== undefined) {
      const c26 = Math.round((sums.C10 / sums.C09) * 100) / 100
      if (!bestMonth.C26 || c26 > bestMonth.C26.value) bestMonth.C26 = { value: c26, month }
    }
    // Every id in RATE_DEPENDENCIES (not just L12/L14/L17), or L05/L18/L21/L26
    // silently never got a "best month" record at all.
    Object.entries(RATE_DEPENDENCIES).forEach(([id, [numId, denId]]) => {
      const rate = calcRateCapped(sums[numId] ?? null, sums[denId] ?? null)
      if (rate !== null && rate > 0 && (!bestMonth[id] || rate > bestMonth[id].value)) {
        bestMonth[id] = { value: rate, month }
      }
    })
  }

  if (Object.keys(best).length === 0) return

  const upsertRows = Object.entries(best).map(([id, { value, week, name }]) => ({
    client_id: clientId,
    metric_id: id,
    metric_name: name,
    lifetime_high: value,
    achieved_week: week,
    lifetime_high_month: bestMonth[id]?.value ?? null,
    achieved_month: bestMonth[id]?.month ?? null,
    updated_at: new Date().toISOString(),
  }))

  // Never delete the existing records before their replacements are safely
  // persisted. A failed insert previously left the client's entire high-score
  // history empty. Upsert updates the calculated truth in one request while
  // preserving the last known records if the request fails.
  const { error: upsertError } = await supabase
    .from('high_scores')
    .upsert(upsertRows, { onConflict: 'client_id,metric_id' })
  if (upsertError) throw upsertError
  console.log(`✅ Backfilled ${upsertRows.length} true high score(s) for client ${clientId}`)
}

// Derived from the catalog, not a hand-maintained id list — a hardcoded list
// silently never tracked any metric added after it was written (newsletter
// fields, InMail counts, Meetings Attended, ...). Every number/percentage/
// slider metric is tracked; C09 and C26 are 'auto' but need special handling
// below, and the 'auto' rate metrics come from RATE_DEPENDENCIES. Booleans and
// text have no meaningful "high".
const TRACKED_METRICS = [
  ...ALL_METRICS.filter(m => m.type === 'number' || m.type === 'percentage' || m.type === 'slider'),
  ...ALL_METRICS.filter(m => m.id === 'C09' || m.id === 'C26'),
].map(m => ({ id: m.id, name: m.name, category: m.category }))

export async function detectAndUpdateHighScores(
  clientId: string,
  weekStart: string,
  contentMetrics: Record<string, any>,
  leadgenMetrics: Record<string, any>
): Promise<string[]> {

  // Build values map
  const values: Record<string, { value: number; name: string }> = {}

  // Pre-compute auto metrics
  const _C06 = readNum(contentMetrics, 'C06'), _C07 = readNum(contentMetrics, 'C07'), _C08 = readNum(contentMetrics, 'C08')
  const _C09stored = readNum(contentMetrics, 'C09')
  const _C09computed = (_C06 ?? 0) + (_C07 ?? 0) + (_C08 ?? 0)
  const _C09 = _C09stored ?? (_C09computed > 0 ? _C09computed : null)
  const _C10 = readLinkedInImpressions(contentMetrics)
  const _C26 = _C09 && _C09 > 0 && _C10 ? Math.round((_C10 / _C09) * 100) / 100 : null

  TRACKED_METRICS.forEach(({ id, name, category }) => {
    const col = category === 'content' ? contentMetrics : leadgenMetrics
    let val: number | null = null
    if (id === 'C09') val = _C09
    else if (id === 'C10') val = _C10
    else if (id === 'C26') val = _C26
    else val = readNum(col, id)
    if (val !== null && val > 0) {
      values[id] = { value: val, name }
    }
  })

  // Add live-calculated rates — every id in RATE_DEPENDENCIES (not just
  // L12/L14/L17), or L05/L18/L21/L26 silently never got a high-score record
  // updated on save.
  Object.entries(RATE_DEPENDENCIES).forEach(([id, [numId, denId]]) => {
    const rate = calcRateCapped(readNum(leadgenMetrics, numId), readNum(leadgenMetrics, denId))
    if (rate !== null && rate > 0) values[id] = { value: rate, name: rateMetricName(id) }
  })

  const customMetrics = await fetchNumericCustomMetrics(clientId)
  customMetrics.forEach(m => {
    const col = m.category === 'content' ? contentMetrics : leadgenMetrics
    const val = readNum(col, m.id)
    if (val !== null && val > 0) values[m.id] = { value: val, name: m.name }
  })

  if (Object.keys(values).length === 0) return []

  // Fetch all existing high scores for this client in ONE query
  const { data: existing } = await supabase
    .from('high_scores')
    .select('metric_id, lifetime_high, achieved_week')
    .eq('client_id', clientId)

  const existingMap: Record<string, { lifetime_high: number | null; achieved_week: string | null }> = {}
  existing?.forEach(s => { existingMap[s.metric_id] = s })

  // Find which ones are new records
  const newRecords: string[] = []
  const upsertRows: any[] = []

  for (const [metricId, { value, name }] of Object.entries(values)) {
    const current = existingMap[metricId]
    if (!current || current.lifetime_high === null || value > current.lifetime_high) {
      upsertRows.push({
        client_id: clientId,
        metric_id: metricId,
        metric_name: name,
        lifetime_high: value,
        achieved_week: weekStart,
        previous_high: current?.lifetime_high ?? null,
        updated_at: new Date().toISOString()
      })
      // Still stored as the record, but a higher Negative Replies / Bounce
      // Rate / cost is not something to celebrate.
      if (!LOWER_IS_BETTER_METRIC_IDS.has(metricId)) newRecords.push(name)
    }
  }

  // Batch upsert in one query
  if (upsertRows.length > 0) {
    const { error } = await supabase
      .from('high_scores')
      .upsert(upsertRows, { onConflict: 'client_id,metric_id' })

    if (error) {
      console.error('High score upsert failed:', error.message)
    } else {
      console.log(`✅ High scores updated: ${upsertRows.length} records checked, ${newRecords.length} new highs`)
    }
  }

  return newRecords
}

// PostgREST caps a plain select at 1000 rows. With ~50+ tracked metrics per
// client the high_scores table passes that at roughly 18 clients, and the
// rows beyond the cap are silently dropped — so read it in pages.
export async function fetchAllHighScores(): Promise<any[]> {
  const pageSize = 1000
  const all: any[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('high_scores')
      .select('*')
      .order('client_id', { ascending: true })
      .order('metric_id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return all
}
