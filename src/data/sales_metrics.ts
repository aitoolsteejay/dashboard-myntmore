import type { CompanyMetric } from './company_metrics'

// Sales & Outreach metric catalog. Ids/labels mirror the inputs on SalesPage.tsx
// (the source of truth for what each SO## field means). Each section maps to one
// jsonb column of sales_weekly_data. Rates (type 'percentage') are persisted per
// week by SalesPage's DERIVED_FIELDS and recomputed from summed raw fields for
// any multi-week view (see utils/salesRates.ts).

export interface SalesSection {
  key: 'tj_outreach' | 'jahnvi_outreach' | 'shirin_outreach' | 'cold_email' | 'meeting_tracker'
  title: string
  metrics: CompanyMetric[]
}

const n = (id: string, name: string, extra: Partial<CompanyMetric> = {}): CompanyMetric => ({ id, name, type: 'number', ...extra })
// Free-text fields on the entry page (who was targeted) — not numbers.
const t = (id: string, name: string): CompanyMetric => ({ id, name, type: 'textarea' })
const p = (id: string, name: string): CompanyMetric => ({ id, name, type: 'percentage' })

export const SALES_SECTIONS: SalesSection[] = [
  {
    key: 'tj_outreach', title: 'TJ Outreach',
    metrics: [
      t('SO01', 'ICP Targeted This Week'), n('SO02', 'Conn Requests Sent'), n('SO03', 'Accepted Invitations'),
      p('SO04', 'Acceptance Rate'), n('SO05', 'Answered Messages'), p('SO06', 'Response Rate'),
      n('SO07', 'Hot Leads'), n('SO08', 'Negative Replies'), n('SO09', 'Meetings Booked'),
    ],
  },
  {
    key: 'jahnvi_outreach', title: 'Jahnvi Outreach',
    metrics: [
      t('SO10', 'ICP Targeted This Week'), n('SO11', 'Conn Requests Sent'), n('SO12', 'Accepted Invitations'),
      p('SO13', 'Acceptance Rate'), n('SO14', 'Answered Messages'), p('SO15', 'Response Rate'),
      n('SO16', 'Hot Leads'), n('SO17', 'Negative Replies'),
    ],
  },
  {
    key: 'shirin_outreach', title: 'Shirin Outreach',
    metrics: [
      t('SO18', 'InMail ICP Targeted'), n('SO19', 'InMails Sent'), n('SO20', 'InMails Accepted'),
      p('SO21', 'InMail Acceptance Rate'), n('SO22', 'LinkedIn Conn Requests Sent'), n('SO23', 'LinkedIn Accepted'),
      p('SO24', 'LinkedIn Acceptance Rate'), n('SO25', 'Answered Messages'), p('SO26', 'Response Rate'),
      n('SO27', 'Hot Leads'), n('SO28', 'Negative Replies'),
    ],
  },
  {
    key: 'cold_email', title: 'Cold Email (Waalaxy)',
    metrics: [
      n('SO29', 'Emails Sent'), n('SO30', 'Emails Opened'), p('SO31', 'Open Rate'),
      n('SO32', 'Replies Received'), n('SO33', 'Positive Replies (Hot Leads)'), n('SO34', 'Negative Replies'),
      p('SO35', 'Response Rate'),
    ],
  },
  {
    key: 'cold_email', title: 'Cold Emailing',
    metrics: [
      n('SO50', 'Emails Sent (Week)', { hasTarget: true }), n('SO51', 'Replies', { hasTarget: true }),
      p('SO52', 'Reply Rate'), n('SO53', 'Positive Replies', { hasTarget: true }),
      p('SO54', 'Positive Reply Rate'), n('SO55', 'Replied with OOO', { hasTarget: true }),
    ],
  },
  {
    key: 'meeting_tracker', title: 'Meeting Tracker',
    metrics: [
      n('SO36', 'Booked via LinkedIn'), n('SO37', 'Booked via Cold Email'), n('SO38', 'Booked via Referral'),
      n('SO39', 'Booked via Other'), n('SO56', 'Booked via Website | AI'), n('SO40', 'Total Meetings Booked'),
      n('SO41', 'Meetings Completed'), n('SO42', 'No-Show / Rescheduled'), p('SO43', 'Completion Rate'),
      n('SO44', 'Proposals Sent'), n('SO45', 'Follow-ups Sent'), n('SO46', 'Conversions (New Clients)'),
      p('SO47', 'Conversion Rate'), n('SO48', 'Average Deal Size', { unit: '₹' }), n('SO49', 'Total Revenue Closed', { unit: '₹' }),
    ],
  },
]
