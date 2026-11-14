// The per-person Meeting Trackers (Enwil, Tejas). Each one has the same fields as the
// company-wide "Meeting Tracker (Company Total)" — meetings booked per source, a total, then
// completed / no-show / completion rate / proposals / follow-ups / conversions / conversion
// rate / average deal size / revenue — with its own list of sources.
//
// This is the single definition behind the Sales entry form, the dashboard blocks, the
// derived totals and rates, the records and the export, so they cannot drift apart.
// A retired source id (the old "Booked via Other") is kept in `retiredIds`: it is no longer
// shown or counted, but it is carried through saves so the stored number is never wiped.

export interface MeetingTrackerSource { id: string; label: string }

export interface MeetingTrackerConfig {
  key: 'enwil_meetings' | 'tejas_meetings'
  title: string
  sources: MeetingTrackerSource[]
  retiredIds: string[]
  totalId: string
  completedId: string
  noShowId: string
  completionRateId: string
  proposalsId: string
  followUpsId: string
  conversionsId: string
  conversionRateId: string
  avgDealId: string
  revenueId: string
}

export const ENWIL_MEETINGS: MeetingTrackerConfig = {
  key: 'enwil_meetings',
  title: 'Enwil Meetings',
  sources: [
    { id: 'SE01', label: 'Booked via LinkedIn' },
    { id: 'SE02', label: 'Booked via Cold Email' },
    { id: 'SE03', label: 'Booked via Referral' },
    { id: 'SE05', label: 'Booked via Website | AI' },
    { id: 'SE07', label: 'Booked via WA' },
  ],
  retiredIds: ['SE04'],
  totalId: 'SE06',
  completedId: 'SE08',
  noShowId: 'SE09',
  completionRateId: 'SE10',
  proposalsId: 'SE11',
  followUpsId: 'SE12',
  conversionsId: 'SE13',
  conversionRateId: 'SE14',
  avgDealId: 'SE15',
  revenueId: 'SE16',
}

export const TEJAS_MEETINGS: MeetingTrackerConfig = {
  key: 'tejas_meetings',
  title: 'Tejas Meetings',
  sources: [
    { id: 'ST01', label: 'Booked via LinkedIn' },
    { id: 'ST02', label: 'Booked via Cold Email' },
    { id: 'ST03', label: 'Booked via Referral' },
    { id: 'ST05', label: 'Booked via Website | AI' },
    { id: 'ST07', label: 'Booked via WA' },
    { id: 'ST08', label: 'Booked via TJ' },
  ],
  retiredIds: ['ST04'],
  totalId: 'ST06',
  completedId: 'ST09',
  noShowId: 'ST10',
  completionRateId: 'ST11',
  proposalsId: 'ST12',
  followUpsId: 'ST13',
  conversionsId: 'ST14',
  conversionRateId: 'ST15',
  avgDealId: 'ST16',
  revenueId: 'ST17',
}

export const MEETING_TRACKERS: MeetingTrackerConfig[] = [ENWIL_MEETINGS, TEJAS_MEETINGS]

export type MeetingTrackerFieldKind = 'input' | 'sum' | 'rate' | 'revenue'

export interface MeetingTrackerField {
  id: string
  label: string
  kind: MeetingTrackerFieldKind
  unit?: string
}

// Every field, in display order (same order as the company-total tracker).
export function meetingTrackerFields(cfg: MeetingTrackerConfig): MeetingTrackerField[] {
  return [
    ...cfg.sources.map(s => ({ id: s.id, label: s.label, kind: 'input' as const })),
    { id: cfg.totalId, label: 'Total Meetings Booked', kind: 'sum' },
    { id: cfg.completedId, label: 'Meetings Completed', kind: 'input' },
    { id: cfg.noShowId, label: 'No-Show / Rescheduled', kind: 'input' },
    { id: cfg.completionRateId, label: 'Completion Rate', kind: 'rate' },
    { id: cfg.proposalsId, label: 'Proposals Sent', kind: 'input' },
    { id: cfg.followUpsId, label: 'Follow-ups Sent', kind: 'input' },
    { id: cfg.conversionsId, label: 'Conversions (New Clients)', kind: 'input' },
    { id: cfg.conversionRateId, label: 'Conversion Rate', kind: 'rate' },
    { id: cfg.avgDealId, label: 'Average Deal Size', kind: 'input', unit: '₹' },
    { id: cfg.revenueId, label: 'Total Revenue Closed', kind: 'revenue', unit: '₹' },
  ]
}

// Ids this tracker saves: shown fields plus the retired ones (kept, never shown).
export function meetingTrackerStoredIds(cfg: MeetingTrackerConfig): string[] {
  return [...meetingTrackerFields(cfg).map(f => f.id), ...cfg.retiredIds]
}

const num = (v: unknown) => parseFloat(v as string) || 0
const rate = (n: unknown, d: unknown) => (num(d) > 0 ? Math.round((num(n) / num(d)) * 1000) / 10 : 0)

export function meetingTrackerTotal(cfg: MeetingTrackerConfig, d: Record<string, unknown>): number {
  return cfg.sources.reduce((sum, s) => sum + num(d[s.id]), 0)
}

// The values saved alongside whichever raw field was just edited (same rounding as the
// company-total tracker: rates to 1 decimal, 0 when the denominator is 0).
export function deriveMeetingTracker(cfg: MeetingTrackerConfig, d: Record<string, unknown>): Record<string, number> {
  const total = meetingTrackerTotal(cfg, d)
  return {
    [cfg.totalId]: total,
    [cfg.completionRateId]: rate(d[cfg.completedId], total),
    [cfg.conversionRateId]: rate(d[cfg.conversionsId], total),
    [cfg.revenueId]: num(d[cfg.conversionsId]) * num(d[cfg.avgDealId]),
  }
}

// [rate id, numerator id, denominator id] — used to recompute rates from summed weeks.
export const MEETING_TRACKER_RATE_PAIRS: Record<string, [string, string]> = Object.fromEntries(
  MEETING_TRACKERS.flatMap(cfg => [
    [cfg.completionRateId, [cfg.completedId, cfg.totalId]],
    [cfg.conversionRateId, [cfg.conversionsId, cfg.totalId]],
  ]),
)

// [average deal id, revenue id, conversions id] — a monthly average deal size is revenue ÷ conversions.
export const MEETING_TRACKER_AVG_DEAL: [string, string, string][] = MEETING_TRACKERS.map(
  cfg => [cfg.avgDealId, cfg.revenueId, cfg.conversionsId],
)

export const MEETING_TRACKER_NO_SHOW_IDS: string[] = MEETING_TRACKERS.map(cfg => cfg.noShowId)
