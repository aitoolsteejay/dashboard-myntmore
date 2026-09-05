import { jsPDF } from 'jspdf'
import { supabase } from '@/integrations/supabase/client'
import { buildWeekMetrics } from '@/utils/metricCalculations'
import { assertClientRows } from '@/utils/clientScope'
import { Metric } from '@/data/metrics'
import { customMetricToMetric } from '@/hooks/useEffectiveMetrics'
import { calcRateCapped } from '@/utils/readMetric'

type EomClient = { id: string; name: string; company: string | null }

type GenerateEomReportOptions = {
  client: EomClient
  month: string
  logoUrl: string
  download?: boolean
}

type MetricMap = Record<string, number | null>

const NAVY = '#08245f'
const GOLD = '#fbbb2f'
const PURPLE = '#44339a'
const INK = '#172033'
const MUTED = '#687386'
const PALE = '#f4f6fb'
const LAVENDER = '#eeecff'
const GREEN = '#179c63'
const RED = '#df4e55'

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
  }
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7)
}

function monthLabel(month: string, short = false) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: short ? 'short' : 'long', year: short ? undefined : 'numeric', timeZone: 'UTC',
  })
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Counts (posts, requests, replies, etc.) should never be negative -- a stray
// negative entry (data-entry mistake) would otherwise render as an impossible
// number like "-1 positive replies" in a client-facing report.
function count(value: unknown) {
  return Math.max(0, num(value))
}

// Qualitative notes are typed by the team week-to-week and pulled in verbatim;
// this only fixes obviously broken presentation (no capital, no terminal
// punctuation) without rewriting what was actually said.
function cleanNote(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`
}

function aggregateWeeks(rows: any[], extraMetrics: Metric[] = []): MetricMap {
  const builtRows = rows
    .slice()
    .sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)))
    .map(row => buildWeekMetrics(row, extraMetrics))
    .filter(Boolean) as Record<string, any>[]
  const total: MetricMap = {}
  const latest = new Set(['C16', 'C32'])
  const averages = new Set(['C34', 'C35', 'C36', 'C37'])
  const ids = new Set(builtRows.flatMap(row => Object.keys(row)))

  ids.forEach(id => {
    const values = builtRows.map(row => Number(row[id])).filter(Number.isFinite)
    if (!values.length) return
    // None of these business metrics are ever legitimately negative -- clamp so
    // a stray data-entry mistake can't surface as an impossible number here.
    total[id] = Math.max(0, latest.has(id)
      ? values[values.length - 1]
      : averages.has(id)
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : values.reduce((sum, value) => sum + value, 0))
  })

  total.C09 = num(total.C06) + num(total.C07) + num(total.C08)
  total.C26 = num(total.C09) > 0 ? num(total.C10) / num(total.C09) : null
  // Use the app-wide rate helper (caps at 100% for bad data instead of
  // showing an impossible rate in this client-facing PDF, matching every
  // other rate computation in the app) instead of an uncapped inline formula.
  total.L12 = calcRateCapped(total.L11, total.L10)
  total.L14 = calcRateCapped(total.L13, total.L11)
  total.L17 = calcRateCapped(total.L15, total.L13)
  total.L18 = calcRateCapped(total.L16, total.L13)
  total.L21 = calcRateCapped(total.L20, total.L19)
  total.L26 = calcRateCapped(total.L25, total.L24)
  return total
}

function fmt(value: unknown, percentage = false) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-'
  const rounded = Math.round(Number(value) * 10) / 10
  return `${rounded.toLocaleString('en-IN')}${percentage ? '%' : ''}`
}

async function imageData(url: string) {
  if (url.startsWith('data:')) return url
  const blob = await fetch(url).then(response => response.blob())
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function generateEomReport({ client, month, logoUrl, download = true }: GenerateEomReportOptions) {
  const current = monthBounds(month)
  const previousMonths = [shiftMonth(month, -2), shiftMonth(month, -1), month]
  const historyStart = monthBounds(previousMonths[0]).start
  const [{ data: weeksRaw, error: weeksError }, { data: campaignsRaw, error: campaignsError }, { data: campaignRowsRaw, error: campaignRowsError }, { data: momentsRaw }, { data: customMetricsRaw }] = await Promise.all([
    supabase.from('weekly_data').select('client_id, week_start, week_label, content_metrics, leadgen_metrics, content_submitted_at, leadgen_submitted_at')
      .eq('client_id', client.id).gte('week_start', historyStart).lte('week_start', current.end).order('week_start'),
    supabase.from('campaigns').select('id, client_id, name, status, icp_description, message_narrative, started_date')
      .eq('client_id', client.id).order('started_date'),
    supabase.from('campaign_weekly_data').select('campaign_id, client_id, week_start, conn_requests_sent, accepted, answered, positive_replies, negative_replies, hot_leads, meetings_booked, existing_conn_sent, existing_conn_replied, notes')
      .eq('client_id', client.id).gte('week_start', current.start).lte('week_start', current.end).order('week_start'),
    (supabase as any).from('aha_moments').select('client_id, title, description, created_at').eq('client_id', client.id)
      .gte('created_at', `${current.start}T00:00:00Z`).lte('created_at', `${current.end}T23:59:59Z`).order('created_at'),
    supabase.from('custom_metrics').select('*').eq('client_id', client.id).eq('archived', false).order('sort_order', { ascending: true }),
  ])
  if (weeksError) throw weeksError
  if (campaignsError) throw campaignsError
  if (campaignRowsError) throw campaignRowsError

  const weeks = assertClientRows(weeksRaw, client.id, 'EOM weekly data')
  const campaigns = assertClientRows(campaignsRaw, client.id, 'EOM campaigns')
  const campaignRows = assertClientRows(campaignRowsRaw, client.id, 'EOM campaign data')
  const moments = assertClientRows(momentsRaw, client.id, 'EOM highlights')
  const customMetrics = assertClientRows(customMetricsRaw, client.id, 'EOM custom metrics').map(customMetricToMetric)
  const monthRows = weeks.filter(row => String(row.week_start).slice(0, 7) === month)
  if (!monthRows.length) throw new Error(`No submitted dashboard data is available for ${monthLabel(month)}.`)

  const monthly = Object.fromEntries(previousMonths.map(period => [
    period,
    aggregateWeeks(weeks.filter(row => String(row.week_start).slice(0, 7) === period), customMetrics),
  ])) as Record<string, MetricMap>
  const currentMetrics = monthly[month]
  const campaignSummaries = campaigns.map(campaign => {
    const rows = campaignRows.filter(row => row.campaign_id === campaign.id)
    return {
      ...campaign,
      sent: rows.reduce((sum, row) => sum + count(row.conn_requests_sent), 0),
      accepted: rows.reduce((sum, row) => sum + count(row.accepted), 0),
      answered: rows.reduce((sum, row) => sum + count(row.answered), 0),
      positive: rows.reduce((sum, row) => sum + count(row.positive_replies), 0),
      negative: rows.reduce((sum, row) => sum + count(row.negative_replies), 0),
      hotLeads: rows.reduce((sum, row) => sum + count(row.hot_leads), 0),
      meetings: rows.reduce((sum, row) => sum + count(row.meetings_booked), 0),
      notes: rows.map(row => cleanNote(row.notes)).filter(Boolean).join(' '),
    }
  }).filter(campaign => campaign.sent || campaign.accepted || campaign.answered || campaign.hotLeads || campaign.meetings)

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const width = 210, height = 297, margin = 15, contentWidth = width - margin * 2
  const logo = await imageData(logoUrl)
  let page = 1

  const text = (value: string | string[], x: number, y: number, size = 10, color = INK, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal', maxWidth?: number) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color)
    doc.text(value, x, y, maxWidth ? { maxWidth } : undefined)
  }
  const rounded = (x: number, y: number, w: number, h: number, fill = '#ffffff', stroke = '#dfe3ec', radius = 3) => {
    doc.setFillColor(fill); doc.setDrawColor(stroke); doc.setLineWidth(0.35); doc.roundedRect(x, y, w, h, radius, radius, 'FD')
  }
  const footer = () => {
    doc.setDrawColor('#e3e6ed'); doc.line(margin, 283, width - margin, 283)
    text('MYNTMORE  |  CONFIDENTIAL CLIENT REPORT', margin, 289, 7, MUTED, 'bold')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(NAVY)
    doc.text(String(page), width - margin, 289, { align: 'right' })
  }
  const header = (title: string, kicker: string) => {
    doc.addPage()
    page += 1
    doc.setFillColor(PALE); doc.rect(0, 0, width, height, 'F')
    doc.addImage(logo, 'PNG', width - 40, 10, 25, 15)
    text(kicker.toUpperCase(), margin, 19, 8, GOLD, 'bold')
    text(title, margin, 31, 22, NAVY, 'bold')
    doc.setDrawColor(GOLD); doc.setLineWidth(1.2); doc.line(margin, 37, width - margin, 37)
  }
  const finish = () => footer()
  const kpi = (x: number, y: number, w: number, label: string, value: string, note: string) => {
    rounded(x, y, w, 31, '#ffffff', '#dde2eb')
    text(label.toUpperCase(), x + 5, y + 7, 7, MUTED, 'bold')
    text(value, x + 5, y + 19, 18, NAVY, 'bold')
    text(note, x + 5, y + 26, 7.5, MUTED)
  }
  const sectionTitle = (title: string, y: number, subtitle?: string) => {
    text(title.toUpperCase(), margin, y, 12, NAVY, 'bold')
    if (subtitle) text(subtitle, margin, y + 6, 8.5, MUTED, 'normal', contentWidth)
  }
  const wrappedLines = (body: string, maxWidth: number, size = 9, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal') => {
    // jsPDF measures wrapping with the currently selected font. Set the exact
    // render font first or text measured at 7pt can overflow when drawn at 9pt.
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    return doc.splitTextToSize(body, maxWidth) as string[]
  }
  const limitedLines = (body: string, maxWidth: number, maxLines: number, size = 9, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal') => {
    const lines = wrappedLines(body, maxWidth, size, style)
    if (lines.length <= maxLines) return lines
    const visible = lines.slice(0, maxLines)
    visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[.,;:]?$/, '')}...`
    return visible
  }
  const barChart = (x: number, y: number, w: number, h: number, title: string, metricId: string, percentage = false) => {
    rounded(x, y, w, h, '#ffffff', '#d9deea')
    text(title.toUpperCase(), x + 5, y + 8, 9, NAVY, 'bold')
    const values = previousMonths.map(period => num(monthly[period][metricId]))
    const max = Math.max(...values, 1)
    const colors = [PURPLE, '#ff7828', GOLD]
    values.forEach((value, index) => {
      const bx = x + 9 + index * ((w - 18) / 3)
      const bw = (w - 28) / 3
      const bh = Math.max(2, (value / max) * (h - 25))
      doc.setFillColor(colors[index]); doc.roundedRect(bx, y + h - 10 - bh, bw, bh, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(INK)
      doc.text(fmt(value, percentage), bx + bw / 2, y + h - 12 - bh, { align: 'center' })
      doc.setFontSize(6.5); doc.setTextColor(MUTED)
      doc.text(monthLabel(previousMonths[index], true), bx + bw / 2, y + h - 4, { align: 'center' })
    })
  }
  const insightBox = (y: number, title: string, body: string, minHeight = 23) => {
    const lines = wrappedLines(body, contentWidth - 12)
    const h = Math.max(minHeight, 18 + lines.length * 4.2)
    rounded(margin, y, contentWidth, h, LAVENDER, '#8073d5')
    text(title.toUpperCase(), margin + 6, y + 8, 8, PURPLE, 'bold')
    text(lines, margin + 6, y + 15, 9, INK, 'normal')
    return h
  }

  // Page 1 - Executive summary
  doc.setFillColor(PALE); doc.rect(0, 0, width, height, 'F')
  doc.addImage(logo, 'PNG', width - 45, 12, 30, 18)
  text('MONTHLY PERFORMANCE REPORT', margin, 28, 9, GOLD, 'bold')
  text(monthLabel(month).toUpperCase(), margin, 45, 28, NAVY, 'bold')
  text(client.name, margin, 58, 18, INK, 'bold')
  if (client.company) text(client.company, margin, 66, 10, MUTED)
  text('Content, audience growth, outreach performance and next actions.', margin, 77, 9.5, MUTED)
  kpi(margin, 88, 42, 'Posts published', fmt(currentMetrics.C09), `${fmt(currentMetrics.C10)} impressions`)
  kpi(margin + 46, 88, 42, 'New followers', fmt(currentMetrics.C15), `${fmt(currentMetrics.C16)} total audience`)
  kpi(margin + 92, 88, 42, 'Positive replies', fmt(currentMetrics.L15), `${fmt(currentMetrics.L17, true)} positive rate`)
  kpi(margin + 138, 88, 42, 'Meetings booked', fmt(currentMetrics.L24), `${fmt(currentMetrics.L27)} total leads`)
  sectionTitle('Executive snapshot', 132)
  // Presence check, not a truthy check — a genuine "0" for C13 (e.g. no
  // engagement this month) must not fall back to C11+C12, the same class of
  // fallback bug already fixed for MM Content's impressions total.
  const totalEngagement = currentMetrics.C13 !== null && currentMetrics.C13 !== undefined
    ? num(currentMetrics.C13)
    : num(currentMetrics.C11) + num(currentMetrics.C12)
  let snapshotY = 140
  snapshotY += insightBox(snapshotY, 'Content', `${fmt(currentMetrics.C09)} posts generated ${fmt(currentMetrics.C10)} impressions and ${fmt(totalEngagement)} engagements, averaging ${fmt(currentMetrics.C26)} impressions per post.`, 27) + 6
  snapshotY += insightBox(snapshotY, 'Outreach', `${fmt(currentMetrics.L10)} connection requests produced ${fmt(currentMetrics.L11)} acceptances (${fmt(currentMetrics.L12, true)}), ${fmt(currentMetrics.L13)} replies and ${fmt(currentMetrics.L15)} positive conversations.`, 27) + 6
  const highlightLines = moments.slice(0, 3).map((moment: any) => moment.title || moment.description).filter(Boolean)
  const highlightBody = highlightLines.length ? highlightLines.join('  |  ') : 'See the following sections for monthly trends, campaign outcomes and recommended next actions.'
  insightBox(snapshotY, 'Highlights', limitedLines(highlightBody, contentWidth - 12, 4, 9).join(' '), 27)
  finish()

  // Page 2 - Content
  header('Content performance', 'Growth and publishing')
  sectionTitle('Monthly outcomes', 49, 'Reach, engagement and audience growth compared across the last three months.')
  barChart(margin, 62, 86, 66, 'Impressions', 'C10')
  barChart(109, 62, 86, 66, 'Engagement', 'C13')
  barChart(margin, 135, 86, 66, 'Profile viewers', 'C14')
  barChart(109, 135, 86, 66, 'New followers', 'C15')
  sectionTitle('Publishing output', 218)
  const output = [
    ['Text + image posts', currentMetrics.C06], ['Carousels', currentMetrics.C07],
    ['Videos', currentMetrics.C08], ['Newsletters drafted', currentMetrics.C28],
  ] as const
  output.forEach(([label, value], index) => {
    const x = margin + (index % 2) * 92, y = 226 + Math.floor(index / 2) * 20
    rounded(x, y, 87, 15, '#ffffff', '#dfe3ec')
    text(label, x + 4, y + 9.5, 8.5, MUTED, 'bold')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(NAVY)
    doc.text(fmt(value), x + 82, y + 9.5, { align: 'right' })
  })
  finish()

  // Page 3 - Lead generation
  header('Lead generation', 'Outreach and conversion')
  sectionTitle('Connection request funnel', 49, 'How prospecting activity converted into conversations and opportunities.')
  const funnel = [
    ['Requests sent', currentMetrics.L10, PURPLE], ['Accepted', currentMetrics.L11, '#776be8'],
    ['Answered', currentMetrics.L13, GOLD], ['Positive replies', currentMetrics.L15, '#ff7828'],
    ['Meetings', currentMetrics.L24, GREEN],
  ] as const
  const maxFunnel = Math.max(num(currentMetrics.L10), 1)
  funnel.forEach(([label, value, color], index) => {
    const y = 66 + index * 20
    text(label, margin, y + 7, 8.5, MUTED, 'bold')
    doc.setFillColor('#e9ecf3'); doc.roundedRect(55, y, 125, 11, 2, 2, 'F')
    doc.setFillColor(color); doc.roundedRect(55, y, Math.max(2, 125 * num(value) / maxFunnel), 11, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(NAVY)
    doc.text(fmt(value), 187, y + 7.5, { align: 'right' })
  })
  kpi(margin, 176, 54, 'Acceptance rate', fmt(currentMetrics.L12, true), `${fmt(currentMetrics.L11)} accepted`)
  kpi(margin + 63, 176, 54, 'Response rate', fmt(currentMetrics.L14, true), `${fmt(currentMetrics.L13)} answered`)
  kpi(margin + 126, 176, 54, 'Positive rate', fmt(currentMetrics.L17, true), `${fmt(currentMetrics.L15)} positive`)
  sectionTitle('Existing network', 222)
  insightBox(230, 'Warm outreach', `${fmt(currentMetrics.L19)} messages were sent to existing connections, generating ${fmt(currentMetrics.L20)} replies (${fmt(currentMetrics.L21, true)}) and ${fmt(currentMetrics.L22)} hot leads.`, 34)
  finish()

  // Page 3b - Custom metrics (only when this client has any numeric ones defined)
  const numericCustomMetrics = customMetrics.filter(m => m.type !== 'textarea')
  if (numericCustomMetrics.length > 0) {
    header('Custom metrics', 'Specific to this client')
    sectionTitle('This month', 49, 'Metrics tracked specifically for this client, not part of the standard package.')
    numericCustomMetrics.slice(0, 12).forEach((metric, index) => {
      const x = margin + (index % 2) * 92, y = 62 + Math.floor(index / 2) * 20
      rounded(x, y, 87, 15, '#ffffff', '#dfe3ec')
      text(metric.name, x + 4, y + 9.5, 8.5, MUTED, 'bold')
      const value = currentMetrics[metric.id]
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(NAVY)
      doc.text(fmt(value, metric.type === 'percentage'), x + 82, y + 9.5, { align: 'right' })
    })
    finish()
  }

  // Page 4+ - Campaigns
  header('Campaign performance', 'ICP-level analysis')
  sectionTitle('Campaign breakdown', 49, 'Results for campaigns with activity recorded during this month.')
  let campaignY = 62
  const addCampaignPage = () => {
    finish(); header('Campaign performance', 'Continued'); campaignY = 50
  }
  if (!campaignSummaries.length) insightBox(65, 'Campaign data', 'No campaign-level activity was recorded for this month. Aggregate lead-generation results are available on the previous page.', 36)
  campaignSummaries.forEach((campaign, index) => {
    const rate = campaign.sent > 0 ? campaign.accepted / campaign.sent * 100 : 0
    const narrativeParts = [
      `${fmt(rate, true)} acceptance rate`,
      campaign.message_narrative ? `Messaging: ${String(campaign.message_narrative).replace(/\s+/g, ' ').trim()}` : null,
      campaign.notes ? `Monthly notes: ${campaign.notes}` : null,
    ].filter(Boolean).join('\n')
    const summaryLines = limitedLines(narrativeParts, contentWidth - 10, 11, 7)
    const icpLines = limitedLines(campaign.icp_description || 'ICP not specified', 88, 4, 7.5, 'italic')
    // The second KPI row ends around y + 38. Keep the narrative in a dedicated
    // band below it; positioning it at y + 35 made the text run through the
    // Positive / Hot Leads / Meetings values.
    const summaryY = campaignY + 45
    const cardHeight = Math.max(54, 49 + Math.max(summaryLines.length, 1) * 3.3, 20 + icpLines.length * 3.5)
    if (campaignY + cardHeight > 270) addCampaignPage()
    rounded(margin, campaignY, contentWidth, cardHeight, '#ffffff', '#d9deea')
    text(campaign.name, margin + 5, campaignY + 8, 10, NAVY, 'bold')
    text(icpLines, margin + 5, campaignY + 15, 7.5, MUTED, 'italic')
    const cells = [
      ['Sent', campaign.sent], ['Accepted', campaign.accepted], ['Answered', campaign.answered],
      ['Positive', campaign.positive], ['Hot leads', campaign.hotLeads], ['Meetings', campaign.meetings],
    ] as const
    cells.forEach(([label, value], cellIndex) => {
      const x = margin + 98 + (cellIndex % 3) * 27, y = campaignY + 4 + Math.floor(cellIndex / 3) * 18
      text(label.toUpperCase(), x, y + 4, 5.5, MUTED, 'bold')
      text(fmt(value), x, y + 12, 10, cellIndex >= 4 ? GREEN : NAVY, 'bold')
    })
    doc.setDrawColor('#edf0f5')
    doc.setLineWidth(0.25)
    doc.line(margin + 5, campaignY + 41, margin + contentWidth - 5, campaignY + 41)
    text(summaryLines, margin + 5, summaryY, 7, MUTED, 'normal', contentWidth - 10)
    campaignY += cardHeight + 6
    if (index === campaignSummaries.length - 1) {
      const strongest = [...campaignSummaries].sort((a, b) => b.positive - a.positive)[0]
      const accountManagerBody = strongest ? `${strongest.name} generated the most positive replies (${fmt(strongest.positive)}). Use reply quality and conversion to hot leads to decide where to scale next.` : 'Continue testing targeting and messaging using response quality as the primary signal.'
      const accountManagerHeight = Math.max(23, 18 + wrappedLines(accountManagerBody, contentWidth - 12, 9).length * 4.2)
      if (campaignY + accountManagerHeight > 278) addCampaignPage()
      insightBox(campaignY, 'Account manager view', accountManagerBody, 23)
    }
  })
  finish()

  // Final page - next steps
  header('Strategy going ahead', 'Recommendations')
  sectionTitle('What the data suggests', 49)
  const latestBuilt = buildWeekMetrics(monthRows.slice().sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))[0], customMetrics) || {}
  const contentWorking = cleanNote(latestBuilt.C24) || `Continue the formats that produced the strongest reach and engagement during ${monthLabel(month)}.`
  const contentBlocker = cleanNote(latestBuilt.C25) || 'Review lower-performing formats and sharpen the opening hook, relevance and distribution rhythm.'
  const leadWorking = cleanNote(latestBuilt.L28) || 'Prioritise ICPs and campaign narratives that produced positive replies and qualified conversations.'
  const leadBlocker = cleanNote(latestBuilt.L29) || 'Refine segments with weaker acceptance or response rates before increasing outreach volume.'
  let recommendationY = 59
  ;[
    ['Content - continue', String(contentWorking)],
    ['Content - improve', String(contentBlocker)],
    ['Outreach - continue', String(leadWorking)],
    ['Outreach - improve', String(leadBlocker)],
  ].forEach(([title, body]) => {
    const conciseBody = limitedLines(body, contentWidth - 12, 4).join(' ')
    recommendationY += insightBox(recommendationY, title, conciseBody, 27) + 7
  })
  text('Prepared by Myntmore', margin, 267, 10, NAVY, 'bold')
  text(`Generated from dashboard data for ${monthLabel(month)}.`, margin, 274, 8, MUTED)
  finish()

  const safeName = client.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  if (download) doc.save(`${safeName}-EOM-${month}.pdf`)
  return doc.output('arraybuffer')
}
