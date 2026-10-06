import { supabase } from '@/integrations/supabase/client'
import { MM_LINKEDIN_METRICS, MM_INSTAGRAM_METRICS, MM_WEBSITE_METRICS, MM_SEO_METRICS, MM_OTHER_METRICS, MM_ADS_METRICS } from '@/data/company_metrics'
import { CUMULATIVE_METRIC_IDS, AVERAGED_NUMBER_IDS } from '@/data/metricSemantics'
import { computeLifetimeHighs, type LifetimeHighs, type RatePair } from './lifetimeHighs'

// The JSON columns in mm_weekly_data that hold {metricId: {value, target}} maps —
// scanned across every week's history. No highscores table exists for MM (unlike
// per-client metrics), so this is computed on the fly.
const MM_METRIC_COLUMNS = ['linkedin', 'instagram', 'website', 'quora', 'reddit', 'ads'] as const

export type MMLifetimeHighs = LifetimeHighs

const ALL_MM_METRICS = [...MM_LINKEDIN_METRICS, ...MM_INSTAGRAM_METRICS, ...MM_WEBSITE_METRICS, ...MM_SEO_METRICS, ...MM_OTHER_METRICS, ...MM_ADS_METRICS]

// A boolean field's Number(true) would register a fake numeric "high" of 1.
const MM_BOOLEAN_IDS = new Set(ALL_MM_METRICS.filter(m => m.type === 'boolean').map(m => m.id))
const MM_PERCENTAGE_IDS = new Set(ALL_MM_METRICS.filter(m => m.type === 'percentage').map(m => m.id))

// Average Impressions Per Post is a ratio — a month's value is month
// impressions / month posts, not a sum or average of weekly ratios.
const RATE_PAIRS: Record<string, RatePair> = { MML12: ['MML02', 'MML01', 1] }

export async function fetchMMLifetimeHighs(): Promise<MMLifetimeHighs> {
  const { data } = await supabase
    .from('mm_weekly_data')
    .select(`week_start, ${MM_METRIC_COLUMNS.join(', ')}`)
  if (!data) return {}

  // Legacy weeks tracked Total Impressions as an In-Network + Out-of-Network
  // split (MML10/MML11) with no stored MML02 — derive a per-week total (and
  // average per post) first, so those weeks still count toward the highs.
  const rows = (data as any[]).map(row => {
    const linkedin = row.linkedin as Record<string, { value?: unknown }> | null
    if (!linkedin) return row
    const read = (id: string) => {
      const value = linkedin[id]?.value
      if (value === null || value === undefined || value === '') return null
      const number = Number(value)
      return Number.isFinite(number) ? number : null
    }
    const inNetwork = read('MML10')
    const outOfNetwork = read('MML11')
    const total = inNetwork !== null || outOfNetwork !== null ? (inNetwork ?? 0) + (outOfNetwork ?? 0) : read('MML02')
    const posts = read('MML01')
    const average = posts && posts > 0 && total !== null ? Math.round((total / posts) * 100) / 100 : null
    const patched: Record<string, unknown> = { ...linkedin }
    if (total !== null) patched.MML02 = { value: total }
    if (average !== null) patched.MML12 = { value: average }
    return { ...row, linkedin: patched }
  })

  return computeLifetimeHighs(rows, MM_METRIC_COLUMNS, {
    averagedIds: new Set([...MM_PERCENTAGE_IDS, ...AVERAGED_NUMBER_IDS]),
    cumulativeIds: CUMULATIVE_METRIC_IDS,
    excludeIds: MM_BOOLEAN_IDS,
    ratePairs: RATE_PAIRS,
  })
}
