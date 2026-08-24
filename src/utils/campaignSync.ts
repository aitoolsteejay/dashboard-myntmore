import { supabase } from "@/integrations/supabase/client"
import { getWeekOptions } from "@/utils/weekUtils"
import { mergeCampaignRollupMetrics } from "@/utils/campaignRollup"

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
  let positive = 0, negative = 0
  let meetings = 0

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
    meetings  += numberOrZero(row.meetings_booked)
  })

  const weekOptions = getWeekOptions(52)
  const weekInfo = weekOptions.find((w: any) => w.weekStart === weekStart)

  const metadata = {
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
    ...(markSubmitted ? { leadgen_submitted_at: new Date().toISOString() } : {}),
  }

  // A campaign rollup and a teammate's metric edit can hit the same JSON column
  // simultaneously. Compare the section's submission timestamp before writing;
  // if it changed, re-read, merge the campaign totals into the newer value, and retry. This keeps
  // every non-rollup metric intact instead of restoring a stale whole-object copy.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: existing, error: readError } = await supabase
      .from('weekly_data')
      .select('id, leadgen_submitted_at, leadgen_metrics')
      .eq('client_id', clientId)
      .eq('week_start', weekStart)
      .maybeSingle()
    if (readError) throw readError

    const previousMetrics = (existing?.leadgen_metrics as Record<string, any>) ?? null
    const merged = mergeCampaignRollupMetrics(previousMetrics ?? {}, {
      connRequestsSent: connReq,
      accepted,
      answered,
      positiveReplies: positive,
      negativeReplies: negative,
      meetingsBooked: meetings,
    })

    if (!existing) {
      const { error: insertError } = await supabase.from('weekly_data').insert({
        client_id: clientId,
        week_start: weekStart,
        ...metadata,
        leadgen_metrics: merged,
      })
      if (!insertError) return
      if (insertError.code === '23505') continue
      throw insertError
    }

    let updateQuery = supabase
      .from('weekly_data')
      .update({ ...metadata, leadgen_metrics: merged })
      .eq('id', existing.id)
    // Compare a scalar row version; passing a JSON object to `.eq()` becomes
    // `eq.[object Object]` and PostgREST rejects the rollup update.
    updateQuery = existing.leadgen_submitted_at === null
      ? updateQuery.is('leadgen_submitted_at', null)
      : updateQuery.eq('leadgen_submitted_at', existing.leadgen_submitted_at)
    const { data: updated, error: updateError } = await updateQuery.select('id').maybeSingle()
    if (updateError) throw updateError
    if (updated) return
  }

  throw new Error('Campaign totals could not be merged because this week was updated repeatedly. Please retry.')
}
