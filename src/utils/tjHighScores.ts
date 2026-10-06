import { supabase } from '@/integrations/supabase/client'
import { TJ_INSTAGRAM_METRICS, TJ_YOUTUBE_METRICS, TJ_PODCAST_METRICS, TJ_VIDEO_METRICS } from '@/data/company_metrics'
import { CUMULATIVE_METRIC_IDS, AVERAGED_NUMBER_IDS } from '@/data/metricSemantics'
import { computeLifetimeHighs, type HighEntry, type LifetimeHighs } from './lifetimeHighs'

// The JSON columns in tj_weekly_data that hold {metricId: {value, target}} maps —
// scanned across every week's history for each metric's all-time highs. There's no
// separate highscores table for TJ's own metrics (unlike per-client metrics, which
// use `high_scores`), so this is computed on the fly instead of stored.
const TJ_METRIC_COLUMNS = ['instagram', 'youtube', 'linkedin_newsletter', 'email_newsletter', 'podcast', 'video_pipeline'] as const

export type TJHighScoreEntry = HighEntry
export type TJLifetimeHighs = LifetimeHighs

export async function fetchTJLifetimeHighs(): Promise<TJLifetimeHighs> {
  const [{ data }, { data: customMetrics }] = await Promise.all([
    supabase.from('tj_weekly_data').select(`week_start, ${TJ_METRIC_COLUMNS.join(', ')}`),
    // No `archived` filter — this set decides how to derive a HISTORICAL
    // month's value (average vs sum), which must hold for every week that
    // ever existed, not just currently-visible metrics. Excluding an
    // archived percentage metric would make its past weeks sum instead of
    // average, corrupting its Best Ever Month into an impossible >100%.
    supabase.from('tj_custom_metrics').select('metric_key, type'),
  ])
  if (!data) return {}

  // A percentage-type metric (standard or custom) is a per-week rate — a
  // month's value is the average across its weeks, never the sum.
  const percentageIds = new Set([
    ...[...TJ_INSTAGRAM_METRICS, ...TJ_YOUTUBE_METRICS, ...TJ_PODCAST_METRICS, ...TJ_VIDEO_METRICS]
      .filter(m => m.type === 'percentage').map(m => m.id),
    ...(customMetrics ?? []).filter(m => m.type === 'percentage').map(m => m.metric_key),
  ])

  return computeLifetimeHighs(data as any[], TJ_METRIC_COLUMNS, {
    averagedIds: new Set([...percentageIds, ...AVERAGED_NUMBER_IDS]),
    cumulativeIds: CUMULATIVE_METRIC_IDS,
  })
}
