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

    const linkedin = row.linkedin as Record<string, { value?: unknown }> | null
    if (linkedin) {
      const read = (id: string) => {
        const value = linkedin[id]?.value
        if (value === null || value === undefined || value === '') return null
        const number = Number(value)
        return Number.isFinite(number) ? number : null
      }
      const inNetwork = read('MML10')
      const outOfNetwork = read('MML11')
      const total = inNetwork !== null || outOfNetwork !== null
        ? (inNetwork ?? 0) + (outOfNetwork ?? 0)
        : read('MML02')
      const posts = read('MML01')
      const average = posts && posts > 0 && total !== null ? Math.round((total / posts) * 100) / 100 : null
      for (const [metricId, value] of [['MML02', total], ['MML12', average]] as const) {
        if (value !== null && (!highs[metricId] || value > highs[metricId].value)) {
          highs[metricId] = { value, week: row.week_start }
        }
      }
    }
  }
  return highs
}
