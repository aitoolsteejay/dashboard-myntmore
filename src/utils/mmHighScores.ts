import { supabase } from '@/integrations/supabase/client'

// The JSON columns in mm_weekly_data that hold {metricId: {value, target}} maps —
// used to scan every week's history for each metric's all-time high. There's no
// separate highscores table for MM's own metrics (unlike per-client metrics, which
// use `high_scores`), so this is computed on the fly instead of stored.
const MM_METRIC_COLUMNS = ['linkedin', 'instagram', 'website', 'quora', 'reddit', 'ads'] as const

export type MMLifetimeHighs = Record<string, { value: number; week: string }>

export async function fetchMMLifetimeHighs(): Promise<MMLifetimeHighs> {
  const { data } = await supabase
    .from('mm_weekly_data')
    .select(`week_start, ${MM_METRIC_COLUMNS.join(', ')}`)
  if (!data) return {}

  const highs: MMLifetimeHighs = {}
  for (const row of data as any[]) {
    for (const column of MM_METRIC_COLUMNS) {
      const metrics = row[column] as Record<string, { value?: unknown }> | null
      if (!metrics) continue
      for (const [metricId, field] of Object.entries(metrics)) {
        const n = Number(field?.value)
        if (isNaN(n)) continue
        if (!highs[metricId] || n > highs[metricId].value) {
          highs[metricId] = { value: n, week: row.week_start }
        }
      }
    }
  }
  return highs
}
