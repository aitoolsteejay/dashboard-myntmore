import { supabase } from "@/integrations/supabase/client"
import { getWeekOptions } from "@/utils/weekUtils"

// Serialize rollups for the same client+week. A previous implementation simply
// dropped a sync request while another was running. When two campaign autosaves
// landed together, the first rollup could read before the second upsert completed
// and the second rollup would never run, leaving the aggregate totals stale.
const syncQueues = new Map<string, Promise<void>>()

// markSubmitted must only be true when this call is a direct consequence of a real
// user save (submitting a campaign week, or the Save Draft/Submit Week buttons).
// It defaults to false because this function is also called from purely passive
// contexts -- opening the Lead Gen tab, expanding a client's dashboard card -- just
// to keep the rollup numbers fresh. Those must never flip a week to "submitted":
// doing so previously created a fake, zero-value "submission" for a week nobody
// had actually touched, the instant anyone merely looked at it.
export const syncAllCampaignTotals = async (clientId: string, weekStart: string, markSubmitted = false) => {
  const key = `${clientId}:${weekStart}`
  const previous = syncQueues.get(key) ?? Promise.resolve()
  const current = previous
    .catch(() => undefined)
    .then(() => _syncAllCampaignTotalsInner(clientId, weekStart, markSubmitted))
  syncQueues.set(key, current)
  try {
    await current
  } finally {
    if (syncQueues.get(key) === current) syncQueues.delete(key)
  }
}

const _syncAllCampaignTotalsInner = async (clientId: string, weekStart: string, markSubmitted: boolean) => {
  // Fetch all campaign data for this client + week
  const { data: campaignRows, error: campaignRowsError } = await supabase
    .from('campaign_weekly_data')
    .select('*')
    .eq('client_id', clientId)
    .eq('week_start', weekStart)

  if (campaignRowsError) throw campaignRowsError
  if (!campaignRows || campaignRows.length === 0) return

  // Sum across all campaigns
  let connReq = 0, accepted = 0, answered = 0
  let positive = 0, negative = 0, hotLeads = 0
  let meetings = 0, existSent = 0, existRply = 0

  const numberOrZero = (value: unknown) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
  }

  campaignRows.forEach((row: any) => {
    connReq   += numberOrZero(row.conn_requests_sent)
    accepted  += numberOrZero(row.accepted)
    answered  += numberOrZero(row.answered)
    positive  += numberOrZero(row.positive_replies)
    negative  += numberOrZero(row.negative_replies)
    hotLeads  += numberOrZero(row.hot_leads)
    meetings  += numberOrZero(row.meetings_booked)
    existSent += numberOrZero(row.existing_conn_sent)
    existRply += numberOrZero(row.existing_conn_replied)
  })

  // Get existing weekly_data to preserve qualitative fields
  const { data: existing } = await supabase
    .from('weekly_data')
    .select('leadgen_metrics')
    .eq('client_id', clientId)
    .eq('week_start', weekStart)
    .maybeSingle()

  const current = (existing?.leadgen_metrics as Record<string, any>) ?? {}

  // Merge - only update numeric fields, keep text/qualitative untouched
  const merged = {
    ...current,
    L10: { ...(typeof current.L10 === 'object' ? current.L10 : {}), value: connReq },
    L11: { ...(typeof current.L11 === 'object' ? current.L11 : {}), value: accepted },
    L13: { ...(typeof current.L13 === 'object' ? current.L13 : {}), value: answered },
    L15: { ...(typeof current.L15 === 'object' ? current.L15 : {}), value: positive },
    L16: { ...(typeof current.L16 === 'object' ? current.L16 : {}), value: negative },
    L22: { ...(typeof current.L22 === 'object' ? current.L22 : {}), value: hotLeads },
    L24: { ...(typeof current.L24 === 'object' ? current.L24 : {}), value: meetings },
    L19: { ...(typeof current.L19 === 'object' ? current.L19 : {}), value: existSent },
    L20: { ...(typeof current.L20 === 'object' ? current.L20 : {}), value: existRply },
  }
  
  const weekOptions = getWeekOptions(52)
  const weekInfo = weekOptions.find((w: any) => w.weekStart === weekStart)

  // Write back to weekly_data. leadgen_submitted_at is only included (and so only
  // ever updated) when this sync was triggered by a genuine save -- see the
  // markSubmitted doc comment on syncAllCampaignTotals above.
  const { error } = await supabase
    .from('weekly_data')
    .upsert({
      client_id: clientId,
      week_start: weekStart,
      week_end: weekInfo?.weekEnd ?? (() => {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + 6)
        return d.toISOString().split('T')[0]
      })(),
      week_label: weekInfo?.label ?? (() => {
        const start = new Date(weekStart)
        const end = new Date(weekStart)
        end.setDate(end.getDate() + 6)
        const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`
      })(),
      leadgen_metrics: merged,
      ...(markSubmitted ? { leadgen_submitted_at: new Date().toISOString() } : {}),
    }, { onConflict: 'client_id,week_start' })

  if (error) {
    console.error('campaignSync: failed to write weekly_data totals:', error.message)
    throw error
  }
}
