import { supabase } from '@/integrations/supabase/client'
import { TJ_INSTAGRAM_METRICS, TJ_YOUTUBE_METRICS, TJ_PODCAST_METRICS, TJ_VIDEO_METRICS } from '@/data/company_metrics'
import { getTodayIST } from './dateUtils'

// The JSON columns in tj_weekly_data that hold {metricId: {value, target}} maps —
// used to scan every week's history for each metric's all-time high. There's no
// separate highscores table for TJ's own metrics (unlike per-client metrics, which
// use `high_scores`), so this is computed on the fly instead of stored.
const TJ_METRIC_COLUMNS = ['instagram', 'youtube', 'linkedin_newsletter', 'email_newsletter', 'podcast', 'video_pipeline'] as const

export interface TJHighScoreEntry {
  value: number
  week: string
  monthValue: number | null
  month: string | null
}
export type TJLifetimeHighs = Record<string, TJHighScoreEntry>

export async function fetchTJLifetimeHighs(): Promise<TJLifetimeHighs> {
  const [{ data }, { data: customMetrics }] = await Promise.all([
    supabase.from('tj_weekly_data').select(`week_start, ${TJ_METRIC_COLUMNS.join(', ')}`),
    supabase.from('tj_custom_metrics').select('metric_key, type').eq('archived', false),
  ])
  if (!data) return {}

  // A percentage-type metric (standard or custom) is a per-week rate — a
  // month's value must be the average across its weeks, not the sum, or a
  // "Best Month" would read as an impossible 300%+ for a metric like
  // Delivery Rate. Standard TJ metrics have no separate raw numerator/
  // denominator pair to volume-weight (they're entered as rates directly,
  // same as the per-client C34/C35 Newsletter rates), so a plain average
  // matches how those are already treated.
  const percentageIds = new Set([
    ...[...TJ_INSTAGRAM_METRICS, ...TJ_YOUTUBE_METRICS, ...TJ_PODCAST_METRICS, ...TJ_VIDEO_METRICS]
      .filter(m => m.type === 'percentage').map(m => m.id),
    ...(customMetrics ?? []).filter(m => m.type === 'percentage').map(m => m.metric_key),
  ])

  const weeklyBest: Record<string, { value: number; week: string }> = {}
  const monthSums: Record<string, Record<string, number>> = {}
  const monthCounts: Record<string, Record<string, number>> = {}

  for (const row of data as any[]) {
    const month = String(row.week_start).slice(0, 7)
    for (const column of TJ_METRIC_COLUMNS) {
      const metrics = row[column] as Record<string, { value?: unknown }> | null
      if (!metrics) continue
      for (const [metricId, field] of Object.entries(metrics)) {
        const n = Number(field?.value)
        if (isNaN(n)) continue
        if (!weeklyBest[metricId] || n > weeklyBest[metricId].value) {
          weeklyBest[metricId] = { value: n, week: row.week_start }
        }
        monthSums[month] = monthSums[month] ?? {}
        monthCounts[month] = monthCounts[month] ?? {}
        monthSums[month][metricId] = (monthSums[month][metricId] ?? 0) + n
        monthCounts[month][metricId] = (monthCounts[month][metricId] ?? 0) + 1
      }
    }
  }

  // A still-in-progress month is naturally disadvantaged (volume metrics) or
  // simply incomplete (rate metrics) — excluding it from the "best month"
  // comparison matches the same guard already used for per-client metrics
  // in highScores.ts, so a strong week or two early in the current month
  // can't set a record that hasn't actually been earned yet.
  const currentMonth = getTodayIST().slice(0, 7)
  const monthlyBest: Record<string, { value: number; month: string }> = {}
  for (const [month, sums] of Object.entries(monthSums)) {
    if (month === currentMonth) continue
    for (const [metricId, sum] of Object.entries(sums)) {
      const value = percentageIds.has(metricId) ? sum / monthCounts[month][metricId] : sum
      if (!monthlyBest[metricId] || value > monthlyBest[metricId].value) {
        monthlyBest[metricId] = { value, month }
      }
    }
  }

  const highs: TJLifetimeHighs = {}
  const allMetricIds = new Set([...Object.keys(weeklyBest), ...Object.keys(monthlyBest)])
  for (const metricId of allMetricIds) {
    highs[metricId] = {
      value: weeklyBest[metricId]?.value ?? 0,
      week: weeklyBest[metricId]?.week ?? '',
      monthValue: monthlyBest[metricId]?.value ?? null,
      month: monthlyBest[metricId]?.month ?? null,
    }
  }
  return highs
}
