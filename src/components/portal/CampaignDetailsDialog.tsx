import { useMemo } from 'react'
import { Activity, CalendarDays, Flame, MessageSquareText, Target, Users } from 'lucide-react'
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type CampaignDetailsDialogProps = {
  campaign: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const number = (value: unknown) => Number(value || 0) || 0
const rate = (numerator: number, denominator: number) => denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null
const display = (value: number | null, suffix = '') => value === null ? '–' : `${value.toLocaleString('en-IN')}${suffix}`

export function CampaignDetailsDialog({ campaign, open, onOpenChange }: CampaignDetailsDialogProps) {
  const summary = useMemo(() => {
    const rows = Object.values(campaign?.byWeek || {})
      .filter(Boolean)
      .sort((a: any, b: any) => String(a.week_start).localeCompare(String(b.week_start))) as any[]
    const totals = rows.reduce((acc, row) => ({
      sent: acc.sent + number(row.conn_requests_sent),
      existingSent: acc.existingSent + number(row.existing_conn_sent),
      accepted: acc.accepted + number(row.accepted),
      answered: acc.answered + number(row.answered),
      positive: acc.positive + number(row.positive_replies),
      hotLeads: acc.hotLeads + number(row.hot_leads),
      meetings: acc.meetings + number(row.meetings_booked),
    }), { sent: 0, existingSent: 0, accepted: 0, answered: 0, positive: 0, hotLeads: 0, meetings: 0 })
    const chartData = rows.map(row => ({
      week: new Date(`${row.week_start}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      Sent: number(row.conn_requests_sent),
      Accepted: number(row.accepted),
      Replies: number(row.answered),
      Positive: number(row.positive_replies),
    }))
    return {
      rows,
      totals,
      chartData,
      acceptanceRate: rate(totals.accepted, totals.sent),
      responseRate: rate(totals.answered, totals.accepted),
      positiveRate: rate(totals.positive, totals.answered),
    }
  }, [campaign])

  if (!campaign) return null

  const status = String(campaign.status || 'inactive').toLowerCase()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        <DialogHeader className="border-b bg-muted/20 px-6 py-5 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-2xl font-black">{campaign.name}</DialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge className={status === 'active' ? 'border-green-200 bg-green-50 text-green-700' : 'border-border bg-muted text-muted-foreground'}>{status}</Badge>
                {campaign.started_date && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Started {new Date(`${campaign.started_date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Prospects Contacted', value: summary.totals.sent + summary.totals.existingSent, icon: Users },
              { label: 'Acceptance Rate', value: display(summary.acceptanceRate, '%'), icon: Target },
              { label: 'Response Rate', value: display(summary.responseRate, '%'), icon: MessageSquareText },
              { label: 'Positive Reply Rate', value: display(summary.positiveRate, '%'), icon: Activity },
              { label: 'Hot Leads', value: summary.totals.hotLeads, icon: Flame },
              { label: 'Meetings Booked', value: summary.totals.meetings, icon: CalendarDays },
            ].map(item => {
              const Icon = item.icon
              return <Card key={item.label} className="shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p><Icon className="h-4 w-4 text-gold" /></div><p className="mt-2 text-2xl font-black">{typeof item.value === 'number' ? item.value.toLocaleString('en-IN') : item.value}</p></CardContent></Card>
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="space-y-5 p-5">
              <section><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ideal Customer Profile</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{campaign.icp_description || 'ICP details have not been added yet.'}</p></section>
              <section><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Messaging Strategy</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{campaign.message_narrative || 'Messaging strategy has not been added yet.'}</p></section>
            </CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-5">
              <div className="mb-4"><p className="text-sm font-black uppercase tracking-wider">Weekly Performance</p><p className="mt-1 text-xs text-muted-foreground">Campaign activity across all recorded weeks.</p></div>
              {summary.chartData.length ? <div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={summary.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" /><XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickLine={false} axisLine={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="Sent" stroke="#F5B800" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="Accepted" stroke="#60A5FA" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="Replies" stroke="#34D399" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="Positive" stroke="#F472B6" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">No weekly performance has been recorded yet.</div>}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
