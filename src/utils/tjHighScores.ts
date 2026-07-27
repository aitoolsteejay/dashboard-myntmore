import { supabase } from '@/integrations/supabase/client'

// The JSON columns in tj_weekly_data that hold {metricId: {value, target}} maps —
// used to scan every week's history for each metric's all-time high. There's no
// separate highscores table for TJ's own metrics (unlike per-client metrics, which
// use `high_scores`), so this is computed on the fly instead of stored.
const TJ_METRIC_COLUMNS = ['instagram', 'youtube', 'linkedin_newsletter', 'email_newsletter', 'podcast', 'video_pipeline'] as const

export type TJLifetimeHighs = Record<string, { value: number; week: string }>

export async function fetchTJLifetimeHighs(): Promise<TJLifetimeHighs> {
  const { data } = await supabase
    .from('tj_weekly_data')
    .select(`week_start, ${TJ_METRIC_COLUMNS.join(', ')}`)
  if (!data) return {}

  const highs: TJLifetimeHighs = {}
  for (const row of data as any[]) {
    for (const column of TJ_METRIC_COLUMNS) {
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
