import { supabase } from '@/integrations/supabase/client'
import { SALES_SECTIONS } from '@/data/sales_metrics'
import { SALES_RATE_DEPENDENCIES } from './salesRates'
import { computeLifetimeHighs, type LifetimeHighs, type RatePair } from './lifetimeHighs'

const SALES_COLUMNS = ['tj_outreach', 'jahnvi_outreach', 'shirin_outreach', 'cold_email', 'meeting_tracker'] as const

export type SalesLifetimeHighs = LifetimeHighs

// Monthly rate bests come from the month's summed numerators/denominators,
// and Average Deal Size from month revenue / month conversions.
const RATE_PAIRS: Record<string, RatePair> = {
  ...Object.fromEntries(Object.entries(SALES_RATE_DEPENDENCIES).map(([id, [num, den]]) => [id, [num, den, 100] as RatePair])),
  SO48: ['SO49', 'SO46', 1],
}

export async function fetchSalesLifetimeHighs(): Promise<SalesLifetimeHighs> {
  const { data } = await supabase
    .from('sales_weekly_data')
    .select(`week_start, ${SALES_COLUMNS.join(', ')}`)
  if (!data) return {}
  const percentageIds = new Set(
    SALES_SECTIONS.flatMap(s => s.metrics).filter(m => m.type === 'percentage').map(m => m.id)
  )
  return computeLifetimeHighs(data as any[], SALES_COLUMNS, { averagedIds: percentageIds, ratePairs: RATE_PAIRS })
}
