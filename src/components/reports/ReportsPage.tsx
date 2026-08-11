import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from "@/integrations/supabase/client"
import { ALL_METRICS } from "@/data/metrics"
import { buildWeekMetrics } from "@/utils/metricCalculations"
import { formatDashboardValue } from "@/utils/dataUtils"
import { cn } from "@/lib/utils"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import {
  BarChart2, TrendingUp, Table2, Users, Calendar, Filter, ChevronDown, X, Info, Download, FileText, Loader2
} from "lucide-react"
import type { WeeklyData, MetricTarget } from "@/types"
import { sortAlphabetically } from "@/utils/sort"
import { generateEomReport } from "@/utils/eomReport"
import myntmoreLogo from '@/assets/myntmore-logo.png'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function snapToMonday(dateStr: string): string {
  const d = new Date(dateStr)
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString().split('T')[0]
}

function getMondaysBetween(from: string, to: string): string[] {
  if (!from || !to) return []
  const weeks: string[] = []
  const cursor = new Date(snapToMonday(from))
  const end = new Date(to)
  while (cursor <= end) {
    weeks.push(cursor.toISOString().split('T')[0])
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return weeks
}

function getNWeeksBack(n: number): { from: string; to: string } {
  const today = new Date()
  const dow = today.getUTCDay()
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  const to = monday.toISOString().split('T')[0]
  const from = new Date(monday)
  from.setUTCDate(monday.getUTCDate() - (n - 1) * 7)
  return { from: from.toISOString().split('T')[0], to }
}

function getMonthRange(offset: number): { from: string; to: string } {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offset)
  const year = d.getUTCFullYear(), month = d.getUTCMonth()
  return {
    from: new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0],
    to: new Date(Date.UTC(year, month + 1, 0)).toISOString().split('T')[0],
  }
}

function fmtWeekShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

function achTextColor(pct: number | null): string {
  if (pct === null) return ''
  if (pct >= 100) return 'text-blue-600'
  if (pct >= 75) return 'text-green-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function achBgColor(pct: number | null): string {
  if (pct === null) return ''
  if (pct >= 100) return 'bg-blue-50'
  if (pct >= 75) return 'bg-green-50'
  if (pct >= 50) return 'bg-amber-50'
  return 'bg-red-50'
}

function achBadge(pct: number | null) {
  if (pct === null) return null
  if (pct >= 100) return { label: 'Hit!', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
  if (pct >= 75) return { label: 'On Track', cls: 'bg-green-100 text-green-700 border-green-200' }
  if (pct >= 50) return { label: 'Behind', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
  return { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' }
}

const CLIENT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#84CC16']

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientSummary = { id: string; name: string; company: string | null }
type DatePreset = '4w' | '8w' | '12w' | 'this_month' | 'last_month' | 'custom'
type ViewMode = 'table' | 'trends' | 'summary'
type CategoryFilter = 'all' | 'content' | 'leadgen'

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: '4w', label: 'Last 4W' },
  { id: '8w', label: 'Last 8W' },
  { id: '12w', label: 'Last 12W' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [targets, setTargets] = useState<MetricTarget[]>([])
  const [loading, setLoading] = useState(false)
  const [datePreset, setDatePreset] = useState<DatePreset>('8w')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([])
  const [view, setView] = useState<ViewMode>('table')
  const [eomOpen, setEomOpen] = useState(false)
  const [eomClientId, setEomClientId] = useState('')
  const [eomMonth, setEomMonth] = useState(() => getMonthRange(-1).from.slice(0, 7))
  const [generatingEom, setGeneratingEom] = useState(false)

  const eomMonths = useMemo(() => Array.from({ length: 18 }, (_, offset) => {
    const date = new Date()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - offset)
    return {
      value: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    }
  }), [])

  const downloadEom = async () => {
    const client = clients.find(item => item.id === eomClientId)
    if (!client) return toast.error('Select a client first.')
    setGeneratingEom(true)
    try {
      await generateEomReport({ client, month: eomMonth, logoUrl: myntmoreLogo })
      toast.success(`${client.name}'s EOM report has been downloaded.`)
      setEomOpen(false)
    } catch (error: any) {
      toast.error(error?.message || 'Could not generate the EOM report.')
    } finally {
      setGeneratingEom(false)
    }
  }

  // Load clients once
  useEffect(() => {
    supabase.from('clients').select('id, name, company').eq('status', 'active').order('name')
      .then(({ data }) => { if (data) setClients(sortAlphabetically(data, client => client.name)) })
  }, [])

  // Compute date range from preset
  const dateRange = useMemo(() => {
    if (datePreset === '4w') return getNWeeksBack(4)
    if (datePreset === '8w') return getNWeeksBack(8)
    if (datePreset === '12w') return getNWeeksBack(12)
    if (datePreset === 'this_month') return getMonthRange(0)
    if (datePreset === 'last_month') return getMonthRange(-1)
    return { from: customFrom, to: customTo }
  }, [datePreset, customFrom, customTo])

  const weekList = useMemo(() => getMondaysBetween(dateRange.from, dateRange.to), [dateRange])

  // Fetch weekly data + targets when selection changes
  useEffect(() => {
    if (selectedClientIds.length === 0 || weekList.length === 0) {
      setWeeklyData([]); setTargets([]); return
    }
    setLoading(true)
    Promise.all([
      supabase.from('weekly_data').select('*')
        .in('client_id', selectedClientIds)
        .gte('week_start', weekList[0])
        .lte('week_start', weekList[weekList.length - 1]),
      // Fetch weekly targets for every week in range
      supabase.from('targets').select('*')
        .in('client_id', selectedClientIds)
        .eq('target_type', 'weekly')
        .in('period', weekList),
    ]).then(([{ data: wd }, { data: tg }]) => {
      setWeeklyData(wd || [])
      setTargets(tg || [])
      setLoading(false)
    })
  }, [selectedClientIds, weekList.join(',')])

  // Metrics filtered by category
  const availableMetrics = useMemo(() => {
    const base = ALL_METRICS.filter(m => m.type !== 'textarea' && m.type !== 'boolean' && m.type !== 'slider')
    return category === 'content' ? base.filter(m => m.category === 'content')
      : category === 'leadgen' ? base.filter(m => m.category === 'leadgen')
      : base
  }, [category])

  const displayMetrics = useMemo(() =>
    selectedMetricIds.length === 0
      ? availableMetrics
      : availableMetrics.filter(m => selectedMetricIds.includes(m.id)),
    [availableMetrics, selectedMetricIds]
  )

  // ─── Data accessors ─────────────────────────────────────────────────────────

  const getCellValue = (clientId: string, weekStart: string, metricId: string): number | null => {
    const row = weeklyData.find(r => r.client_id === clientId && r.week_start === weekStart)
    if (!row) return null
    const built = buildWeekMetrics(row)
    const val = built?.[metricId as keyof typeof built]
    if (val === null || val === undefined) return null
    const n = Number(val)
    return isNaN(n) ? null : n
  }

  // Get target for a specific (client, metric, week). Falls back to any available target for that metric.
  const getTarget = (clientId: string, metricId: string, weekStart?: string): number | null => {
    let t = weekStart
      ? targets.find(t => t.client_id === clientId && t.metric_id === metricId && t.period === weekStart)
      : null
    if (!t) {
      // fallback: most recent target for this metric
      const all = targets
        .filter(t => t.client_id === clientId && t.metric_id === metricId && t.target_value !== null)
        .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
      t = all[0] ?? null
    }
    if (!t?.target_value) return null
    const n = Number(t.target_value)
    return isNaN(n) ? null : n
  }

  const toggleClient = (id: string) =>
    setSelectedClientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleMetric = (id: string) =>
    setSelectedMetricIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // ─── TABLE VIEW ──────────────────────────────────────────────────────────────

  const renderTable = () => (
    <div className="space-y-6">
      {selectedClientIds.map((clientId, ci) => {
        const client = clients.find(c => c.id === clientId)
        if (!client) return null
        const color = CLIENT_COLORS[ci % CLIENT_COLORS.length]

        return (
          <div key={clientId} className="border rounded-xl overflow-hidden shadow-sm">
            {/* Client header */}
            <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderLeft: `4px solid ${color}` }}>
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: color }}>
                {client.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-sm">{client.name}</div>
                {client.company && <div className="text-xs text-muted-foreground">{client.company}</div>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase min-w-[180px] sticky left-0 bg-muted/20 z-10">Metric</TableHead>
                    {weekList.map(w => (
                      <TableHead key={w} className="text-[10px] font-black uppercase text-center whitespace-nowrap min-w-[70px]">
                        {fmtWeekShort(w)}
                      </TableHead>
                    ))}
                    <TableHead className="text-[10px] font-black uppercase text-center bg-amber-50 min-w-[60px]">Total</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center bg-amber-50 min-w-[70px]">Avg/wk</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center min-w-[70px]">Wk Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayMetrics.map(m => {
                    const values = weekList.map(w => getCellValue(clientId, w, m.id))
                    const numVals = values.filter(v => v !== null) as number[]
                    const total = numVals.length > 0 ? numVals.reduce((a, b) => a + b, 0) : null
                    const avg = total !== null && numVals.length > 0 ? total / numVals.length : null
                    const tgt = getTarget(clientId, m.id) // fallback target for Total/Avg columns

                    return (
                      <TableRow key={m.id} className="h-8 hover:bg-muted/10">
                        <TableCell className="py-1 text-xs font-medium sticky left-0 bg-background border-r z-[5] whitespace-nowrap max-w-[180px] truncate">
                          {m.name}
                        </TableCell>
                        {values.map((val, wi) => {
                          const weekTgt = getTarget(clientId, m.id, weekList[wi])
                          const pct = weekTgt && val !== null ? Math.round((val / weekTgt) * 100) : null
                          return (
                            <TableCell
                              key={weekList[wi]}
                              className={cn(
                                "py-1 text-center text-xs font-bold tabular-nums",
                                val !== null ? cn(achTextColor(pct), achBgColor(pct)) : 'text-muted-foreground/40'
                              )}
                            >
                              {val !== null ? formatDashboardValue(val, m.id) : '-'}
                            </TableCell>
                          )
                        })}
                        <TableCell className="py-1 text-center text-xs font-black bg-amber-50/60 tabular-nums">
                          {total !== null ? formatDashboardValue(total, m.id) : '-'}
                        </TableCell>
                        <TableCell className="py-1 text-center text-xs font-bold bg-amber-50/60 tabular-nums">
                          {avg !== null ? formatDashboardValue(Math.round(avg * 10) / 10, m.id) : '-'}
                        </TableCell>
                        <TableCell className="py-1 text-center text-xs text-muted-foreground tabular-nums">
                          {tgt !== null ? formatDashboardValue(tgt, m.id) : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      })}
    </div>
  )

  // ─── TRENDS VIEW ─────────────────────────────────────────────────────────────

  const renderTrends = () => {
    const metricsToChart = displayMetrics.slice(0, 12)

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {metricsToChart.map(m => {
          const chartData = weekList.map(w => {
            const entry: Record<string, any> = { week: fmtWeekShort(w) }
            selectedClientIds.forEach(cid => {
              const client = clients.find(c => c.id === cid)
              const key = client?.name || cid
              entry[key] = getCellValue(cid, w, m.id)
            })
            return entry
          })

          // Get max target across selected clients for reference line
          const maxTarget = selectedClientIds.reduce((max, cid) => {
            const t = getTarget(cid, m.id)
            return t !== null && t > max ? t : max
          }, 0)

          return (
            <Card key={m.id} className="overflow-hidden">
              <CardHeader className="pb-1 pt-3 px-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{m.group}</div>
                <CardTitle className="text-sm font-bold leading-tight">{m.name}</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 9 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      labelStyle={{ fontWeight: 'bold', marginBottom: 4 }}
                    />
                    {selectedClientIds.length > 1 && <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />}
                    {maxTarget > 0 && (
                      <ReferenceLine y={maxTarget} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1.5}
                        label={{ value: 'Target', position: 'insideTopRight', fontSize: 9, fill: '#F59E0B' }}
                      />
                    )}
                    {selectedClientIds.map((cid, i) => {
                      const client = clients.find(c => c.id === cid)
                      return (
                        <Line
                          key={cid}
                          type="monotone"
                          dataKey={client?.name || cid}
                          stroke={CLIENT_COLORS[i % CLIENT_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3, fill: CLIENT_COLORS[i % CLIENT_COLORS.length] }}
                          activeDot={{ r: 5 }}
                          connectNulls={false}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )
        })}
        {displayMetrics.length > 12 && (
          <div className="col-span-full text-center text-xs text-muted-foreground py-4">
            Showing first 12 metrics in Trends view. Use the Metrics filter to narrow your selection.
          </div>
        )}
      </div>
    )
  }

  // ─── SUMMARY VIEW ────────────────────────────────────────────────────────────

  const renderSummary = () => (
    <div className="space-y-8">
      {selectedClientIds.map((clientId, ci) => {
        const client = clients.find(c => c.id === clientId)
        if (!client) return null
        const color = CLIENT_COLORS[ci % CLIENT_COLORS.length]

        return (
          <div key={clientId}>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: color }}>
                {client.name.slice(0, 2).toUpperCase()}
              </div>
              <h3 className="font-black text-base">{client.name}</h3>
              {client.company && <span className="text-xs text-muted-foreground">· {client.company}</span>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {displayMetrics.map(m => {
                const values = weekList.map(w => getCellValue(clientId, w, m.id))
                const numVals = values.filter(v => v !== null) as number[]
                if (numVals.length === 0) return null
                const total = numVals.reduce((a, b) => a + b, 0)
                const avg = total / numVals.length
                const best = Math.max(...numVals)
                const bestWeekIdx = values.findIndex(v => v === best)
                const bestWeek = bestWeekIdx >= 0 ? fmtWeekShort(weekList[bestWeekIdx]) : '-'
                const tgt = getTarget(clientId, m.id)
                const avgAch = tgt ? Math.round((avg / tgt) * 100) : null
                const badge = achBadge(avgAch)

                return (
                  <Card key={m.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate mb-1">{m.name}</div>

                      {/* Total (big number) */}
                      <div className={cn("text-2xl font-black tabular-nums leading-none", achTextColor(avgAch))}>
                        {formatDashboardValue(total, m.id)}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">total · {numVals.length}w</div>

                      {/* Stats grid */}
                      <div className="mt-2.5 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Avg/wk</span>
                          <span className="font-bold tabular-nums">{formatDashboardValue(Math.round(avg * 10) / 10, m.id)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Best wk</span>
                          <span className="font-bold tabular-nums">{formatDashboardValue(best, m.id)}</span>
                        </div>
                        {tgt !== null && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Wk target</span>
                            <span className="font-bold tabular-nums">{formatDashboardValue(tgt, m.id)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Peak date</span>
                          <span className="font-bold">{bestWeek}</span>
                        </div>
                      </div>

                      {/* Achievement badge */}
                      {badge && (
                        <div className={cn("mt-2 text-center text-[10px] font-black rounded-md py-1 border", badge.cls)}>
                          {avgAch}% · {badge.label}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              }).filter(Boolean)}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  const hasSelection = selectedClientIds.length > 0 && weekList.length > 0

  return (
    <div className="min-h-screen bg-background">

      {/* Page header */}
      <div className="border-b bg-card px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Reports</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Analyze performance across clients, metrics, and time periods</p>
          </div>
          <div className="flex items-center gap-3">
            {hasSelection && !loading && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <Calendar className="h-3.5 w-3.5" />
                <span className="font-medium">{weekList.length} weeks</span>
                <span>·</span>
                <span>{fmtWeekShort(weekList[0])} → {fmtWeekShort(weekList[weekList.length - 1])}</span>
                <span>·</span>
                <span className="font-medium">{displayMetrics.length} metrics</span>
              </div>
            )}
            <Dialog open={eomOpen} onOpenChange={setEomOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gold text-black hover:bg-gold/90 font-bold">
                  <Download className="h-4 w-4" /> Download EOM Report
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
                    <FileText className="h-5 w-5" />
                  </div>
                  <DialogTitle>Generate End-of-Month Report</DialogTitle>
                  <DialogDescription>Create a polished, client-ready PDF from submitted dashboard and campaign data.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Client</label>
                    <Select value={eomClientId} onValueChange={setEomClientId}>
                      <SelectTrigger><SelectValue placeholder="Choose a client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}{client.company ? ` - ${client.company}` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Reporting month</label>
                    <Select value={eomMonth} onValueChange={setEomMonth}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {eomMonths.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg border bg-muted/25 p-3 text-xs leading-relaxed text-muted-foreground">
                    Includes an executive summary, three-month content trends, outreach conversion, campaign performance and recommended next steps. Empty campaign sections are handled automatically.
                  </div>
                  <Button onClick={downloadEom} disabled={!eomClientId || generatingEom} className="w-full bg-gold text-black hover:bg-gold/90 font-bold">
                    {generatingEom ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating PDF...</> : <><Download className="mr-2 h-4 w-4" />Generate and Download</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* ── Sticky filter bar ── */}
      <div className="border-b bg-white/95 backdrop-blur sticky top-0 z-20 px-6 py-3 space-y-2.5 shadow-sm">

        {/* Row 1: Clients + Date presets */}
        <div className="flex flex-wrap gap-2 items-center">

          {/* Client multi-select */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-semibold">
                <Users className="h-3.5 w-3.5" />
                {selectedClientIds.length === 0
                  ? 'Select Clients'
                  : `${selectedClientIds.length} Client${selectedClientIds.length > 1 ? 's' : ''}`}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60 max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Clients</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {clients.map(c => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={selectedClientIds.includes(c.id)}
                  onCheckedChange={() => toggleClient(c.id)}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">{c.name}</span>
                    {c.company && <span className="text-[10px] text-muted-foreground">{c.company}</span>}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date preset pills */}
          <div className="flex gap-1 items-center">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Period:</span>
            {DATE_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md border transition-all",
                  datePreset === p.id
                    ? "bg-amber-400 text-black border-amber-400 font-bold shadow-sm"
                    : "bg-background hover:bg-muted border-border text-muted-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="border rounded-md px-2 py-1 text-xs h-8 bg-background"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <input
                type="date" value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="border rounded-md px-2 py-1 text-xs h-8 bg-background"
              />
            </div>
          )}
        </div>

        {/* Row 2: Category + Metrics filter + View toggle + Client badges */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">

            {/* Category filter */}
            <div className="flex gap-0.5 border rounded-lg p-0.5 bg-muted/30">
              {(['all', 'content', 'leadgen'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setSelectedMetricIds([]) }}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md transition-all",
                    category === cat ? "bg-background shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat === 'all' ? 'All' : cat === 'content' ? '📝 Content' : '🎯 Lead Gen'}
                </button>
              ))}
            </div>

            {/* Specific metrics picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                  <Filter className="h-3 w-3" />
                  {selectedMetricIds.length === 0 ? 'All Metrics' : `${selectedMetricIds.length} Metrics`}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
                <div className="px-2 py-1.5 border-b flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Filter Metrics</span>
                  {selectedMetricIds.length > 0 && (
                    <button onClick={() => setSelectedMetricIds([])} className="text-[10px] text-blue-600 hover:underline">
                      Clear all
                    </button>
                  )}
                </div>
                {availableMetrics.map(m => (
                  <DropdownMenuCheckboxItem
                    key={m.id}
                    checked={selectedMetricIds.includes(m.id)}
                    onCheckedChange={() => toggleMetric(m.id)}
                  >
                    <span className="text-xs">{m.name}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Selected client badges */}
            <div className="flex gap-1 flex-wrap">
              {selectedClientIds.map((cid, i) => {
                const c = clients.find(x => x.id === cid)
                return (
                  <Badge
                    key={cid}
                    variant="secondary"
                    className="text-[10px] gap-1 px-2 py-0.5 font-bold cursor-default"
                    style={{ borderLeft: `3px solid ${CLIENT_COLORS[i % CLIENT_COLORS.length]}` }}
                  >
                    {c?.name}
                    <X className="h-2.5 w-2.5 cursor-pointer hover:opacity-60" onClick={() => toggleClient(cid)} />
                  </Badge>
                )
              })}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-0.5 border rounded-lg p-0.5 bg-muted/30">
            {([
              ['table', Table2, 'Table'],
              ['trends', TrendingUp, 'Trends'],
              ['summary', BarChart2, 'Summary'],
            ] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all",
                  view === id ? "bg-background shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6">
        {selectedClientIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-5">
              <BarChart2 className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="font-bold text-lg mb-2">Build your report</h3>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Select one or more clients, pick a time period, choose your metrics, and switch between Table, Trends, and Summary views.
            </p>
            <div className="mt-6 flex gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <Users className="h-4 w-4" /> Pick Clients
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60 max-h-72 overflow-y-auto">
                  {clients.map(c => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={selectedClientIds.includes(c.id)}
                      onCheckedChange={() => toggleClient(c.id)}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">{c.name}</span>
                        {c.company && <span className="text-[10px] text-muted-foreground">{c.company}</span>}
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-28">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          </div>
        ) : (
          <>
            {view === 'table' && renderTable()}
            {view === 'trends' && renderTrends()}
            {view === 'summary' && renderSummary()}
          </>
        )}
      </div>
    </div>
  )
}
