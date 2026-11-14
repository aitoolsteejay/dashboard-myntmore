import { supabase } from '@/integrations/supabase/client'
import { SALES_SECTIONS } from '@/data/sales_metrics'
import { SALES_RATE_DEPENDENCIES } from './salesRates'
import { MEETING_TRACKER_AVG_DEAL } from '@/data/meetingTrackers'
import { CUMULATIVE_METRIC_IDS, AVERAGED_NUMBER_IDS } from '@/data/metricSemantics'
import { computeLifetimeHighs, type LifetimeHighs, type RatePair } from './lifetimeHighs'

const SALES_COLUMNS = ['tj_outreach', 'jahnvi_outreach', 'shirin_outreach', 'cold_email', 'enwil_meetings', 'tejas_meetings', 'meeting_tracker'] as const

export type SalesLifetimeHighs = LifetimeHighs

// Monthly rate bests come from the month's summed numerators/denominators,
// and Average Deal Size from month revenue / month conversions.
const RATE_PAIRS: Record<string, RatePair> = {
  ...Object.fromEntries(Object.entries(SALES_RATE_DEPENDENCIES).map(([id, [num, den]]) => [id, [num, den, 100] as RatePair])),
  SO48: ['SO49', 'SO46', 1],
  ...Object.fromEntries(MEETING_TRACKER_AVG_DEAL.map(([avg, revenue, conversions]) => [avg, [revenue, conversions, 1] as RatePair])),
}

export async function fetchSalesLifetimeHighs(): Promise<SalesLifetimeHighs> {
  const { data } = await supabase
    .from('sales_weekly_data')
    // '*' so this keeps working before the enwil/tejas meeting columns exist.
    .select('*')
  if (!data) return {}
  const percentageIds = new Set(
    SALES_SECTIONS.flatMap(s => s.metrics).filter(m => m.type === 'percentage').map(m => m.id)
  )
  return computeLifetimeHighs(data as any[], SALES_COLUMNS, { averagedIds: percentageIds, cumulativeIds: CUMULATIVE_METRIC_IDS, ratePairs: RATE_PAIRS })
}
