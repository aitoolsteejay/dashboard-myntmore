import { supabase } from '@/integrations/supabase/client'
import { calcAcceptanceRate, calcResponseRate, calcPositiveRate } from './metricCalculations'
import { readNum, readLinkedInImpressions } from './readMetric'

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

  if (error || !rows || rows.length === 0) return

  // Track best single-week value and which week it was achieved
  const best: Record<string, { value: number; week: string; name: string }> = {}
  // Track per-month sums of the raw underlying counters, to derive monthly bests
  const monthSums: Record<string, Record<string, number>> = {}

  const addToMonth = (month: string, id: string, val: number) => {
    if (!monthSums[month]) monthSums[month] = {}
    monthSums[month][id] = (monthSums[month][id] ?? 0) + val
  }

  for (const row of rows) {
    // Skip month-aggregate import rows (week_start = 1st of month)
    if (row.week_start && new Date(row.week_start).getUTCDate() === 1) continue

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
      if (val !== null && val > 0) {
        if (!best[id] || val > best[id].value) {
          best[id] = { value: val, week: weekStart, name }
        }
        // C26 is an average, not summable across weeks - skip it for monthly totals
        if (id !== 'C26') addToMonth(month, id, val)
      }
    })

    // Computed rates
    const L10 = readNum(lm, 'L10'), L11 = readNum(lm, 'L11')
    const L13 = readNum(lm, 'L13'), L15 = readNum(lm, 'L15')
    const accRate = calcAcceptanceRate(L11, L10)
    const respRate = calcResponseRate(L13, L11)
    const posRate = calcPositiveRate(L15, L13)
    if (accRate && accRate > 0 && (!best['L12'] || accRate > best['L12'].value))
      best['L12'] = { value: accRate, week: weekStart, name: 'Acceptance Rate' }
    if (respRate && respRate > 0 && (!best['L14'] || respRate > best['L14'].value))
      best['L14'] = { value: respRate, week: weekStart, name: 'Response Rate' }
    if (posRate && posRate > 0 && (!best['L17'] || posRate > best['L17'].value))
      best['L17'] = { value: posRate, week: weekStart, name: 'Positive Response Rate' }
  }

  // Derive monthly bests: sum of underlying counters per month, max across all months.
  // Rate metrics (L12/L14/L17) are derived from the monthly sums of their inputs,
  // since rates can't be summed across weeks.
  const bestMonth: Record<string, { value: number; month: string }> = {}
  for (const [month, sums] of Object.entries(monthSums)) {
    for (const [id, value] of Object.entries(sums)) {
      if (!bestMonth[id] || value > bestMonth[id].value) {
        bestMonth[id] = { value, month }
      }
    }
    const accRate = calcAcceptanceRate(sums['L11'] ?? null, sums['L10'] ?? null)
    const respRate = calcResponseRate(sums['L13'] ?? null, sums['L11'] ?? null)
    const posRate = calcPositiveRate(sums['L15'] ?? null, sums['L13'] ?? null)
    if (accRate && accRate > 0 && (!bestMonth['L12'] || accRate > bestMonth['L12'].value))
      bestMonth['L12'] = { value: accRate, month }
    if (respRate && respRate > 0 && (!bestMonth['L14'] || respRate > bestMonth['L14'].value))
      bestMonth['L14'] = { value: respRate, month }
    if (posRate && posRate > 0 && (!bestMonth['L17'] || posRate > bestMonth['L17'].value))
      bestMonth['L17'] = { value: posRate, month }
  }

  // Always overwrite with truth from weekly_data - this corrects any stale/garbage entries
  // First delete ALL existing high_scores for this client, then re-insert only what's real
  await supabase.from('high_scores').delete().eq('client_id', clientId)

  if (Object.keys(best).length === 0) return

  const upsertRows = Object.entries(best).map(([id, { value, week, name }]) => ({
    client_id: clientId,
    metric_id: id,
    metric_name: name,
    lifetime_high: value,
    achieved_week: week,
    lifetime_high_month: bestMonth[id]?.value ?? null,
    achieved_month: bestMonth[id]?.month ?? null,
    previous_high: null,
    updated_at: new Date().toISOString(),
  }))

  await supabase.from('high_scores').insert(upsertRows)
  console.log(`✅ Backfilled ${upsertRows.length} true high score(s) for client ${clientId}`)
}

const TRACKED_METRICS = [
  { id: 'C03', name: 'Posts Drafted', category: 'content' },
  { id: 'C06', name: 'Text + Image Posts Posted', category: 'content' },
  { id: 'C07', name: 'Carousels Posted', category: 'content' },
  { id: 'C08', name: 'Videos Posted', category: 'content' },
  { id: 'C09', name: 'Total Posts Posted', category: 'content' },
  { id: 'C36', name: 'In-Network Impressions', category: 'content' },
  { id: 'C37', name: 'Out-of-Network Impressions', category: 'content' },
  { id: 'C10', name: 'Total Impressions', category: 'content' },
  { id: 'C11', name: 'Likes', category: 'content' },
  { id: 'C12', name: 'Comments', category: 'content' },
  { id: 'C13', name: 'Engagement Total', category: 'content' },
  { id: 'C14', name: 'Profile Views', category: 'content' },
  { id: 'C15', name: 'New Followers', category: 'content' },
  { id: 'C17', name: 'Engagement on Other Profiles', category: 'content' },
  { id: 'C26', name: 'Avg Impressions Per Post', category: 'content' },
  { id: 'C27', name: 'Video Views', category: 'content' },
  { id: 'L10', name: 'Connection Requests Sent', category: 'leadgen' },
  { id: 'L11', name: 'Accepted Invitations', category: 'leadgen' },
  { id: 'L13', name: 'Answered Messages', category: 'leadgen' },
  { id: 'L15', name: 'Positive Replies', category: 'leadgen' },
  { id: 'L16', name: 'Negative Replies', category: 'leadgen' },
  { id: 'L19', name: 'Existing Conn Messages Sent', category: 'leadgen' },
  { id: 'L20', name: 'Existing Conn Answered', category: 'leadgen' },
  { id: 'L24', name: 'Meetings Booked', category: 'leadgen' },
]

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

  // Add live-calculated rates
  const L10 = readNum(leadgenMetrics, 'L10')
  const L11 = readNum(leadgenMetrics, 'L11')
  const L13 = readNum(leadgenMetrics, 'L13')
  const L15 = readNum(leadgenMetrics, 'L15')

  const accRate = calcAcceptanceRate(L11, L10)
  const respRate = calcResponseRate(L13, L11)
  const posRate = calcPositiveRate(L15, L13)

  if (accRate && accRate > 0) values['L12'] = { value: accRate, name: 'Acceptance Rate' }
  if (respRate && respRate > 0) values['L14'] = { value: respRate, name: 'Response Rate' }
  if (posRate && posRate > 0) values['L17'] = { value: posRate, name: 'Positive Response Rate' }

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
      newRecords.push(name)
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
