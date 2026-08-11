import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/lib/auth'
import { buildWeekMetrics, formatPct } from '@/utils/metricCalculations'
import { CONTENT_METRICS, LEADGEN_METRICS, ALL_METRICS } from '@/data/metrics'
import { formatDashboardValue } from '@/utils/dataUtils'
import { getWeekOptions, getPreviousWeekStart, getWeeksInSameMonth } from '@/utils/weekUtils'
import { CampaignMonthTable } from '@/components/monday/CampaignMonthTable'
import { CampaignDetailsDialog } from '@/components/portal/CampaignDetailsDialog'
import { ClientActionPlan } from '@/components/portal/ClientActionPlan'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'
import { LogOut, TrendingUp, Users, FileText, BarChart2, Loader2, ArrowUpRight, ArrowDownRight, Minus, Calendar, Table2, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import myntmoreLogo from '@/assets/myntmore-logo.png'

// ─── Reports tab helpers ────────────────────────────────────────────────────

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

type DatePreset = '4w' | '8w' | '12w' | 'this_month' | 'last_month' | 'custom'
type ViewMode = 'table' | 'trends' | 'summary'
type CategoryFilter = 'all' | 'content' | 'leadgen'
type PerformancePeriod = 'weekly' | 'monthly'

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: '4w', label: 'Last 4W' },
  { id: '8w', label: 'Last 8W' },
  { id: '12w', label: 'Last 12W' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom' },
]

const GOLD = '#FFC947'

// Metrics to highlight in the overview cards
const OVERVIEW_METRICS = [
  { id: 'C09', label: 'Total Posts', icon: FileText },
  { id: 'C36', label: 'In-Network Share', icon: Users, percentage: true },
  { id: 'C37', label: 'Out-of-Network Share', icon: ArrowLeftRight, percentage: true },
  { id: 'C10', label: 'Total Impressions', icon: BarChart2 },
  { id: 'C26', label: 'Avg Impressions / Post', icon: BarChart2 },
  { id: 'L10', label: 'Connection Requests', icon: Users },
  { id: 'L24', label: 'Meetings Booked', icon: TrendingUp },
]

// Metrics to show trend charts for
const TREND_METRICS = [
  { id: 'C10', label: 'Impressions', color: '#FFC947' },
  { id: 'C09', label: 'Total Posts', color: '#60A5FA' },
  { id: 'L10', label: 'Connection Requests Sent', color: '#34D399' },
  { id: 'L24', label: 'Meetings Booked', color: '#F472B6' },
]

function formatVal(val: any): string {
  if (val === null || val === undefined || val === '') return '-'
  const n = Number(val)
  if (isNaN(n)) return '-'
  return n.toLocaleString('en-IN')
}

function Delta({ curr, prev }: { curr: any; prev: any }) {
  const c = Number(curr), p = Number(prev)
  if (isNaN(c) || isNaN(p) || !curr || !prev) return <span className="text-muted-foreground">-</span>
  const diff = c - p
  if (diff === 0) return <span className="text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />0</span>
  const pct = Math.abs(Math.round((diff / p) * 100))
  return diff > 0
    ? <span className="text-green-600 font-bold flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+{formatVal(diff)} <span className="text-xs font-normal opacity-70">({pct}%)</span></span>
    : <span className="text-red-500 font-bold flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" />{formatVal(diff)} <span className="text-xs font-normal opacity-70">({pct}%)</span></span>
}

function aggregatePeriodMetrics(rows: any[]): Record<string, any> | null {
  if (!rows.length) return null
  const builtRows = rows
    .slice()
    .sort((a, b) => (a.week_start ?? '').localeCompare(b.week_start ?? ''))
    .map(row => buildWeekMetrics(row))
    .filter(Boolean) as Record<string, any>[]
  if (!builtRows.length) return null

  const totals: Record<string, any> = {}
  const latestValueMetrics = new Set(['C16', 'C32'])
  const averageMetrics = new Set(['C34', 'C35'])

  for (const metric of ALL_METRICS) {
    if (metric.type === 'auto' || metric.type === 'textarea' || metric.type === 'boolean') continue
    const values = builtRows.map(row => Number(row[metric.id])).filter(Number.isFinite)
    if (!values.length) {
      totals[metric.id] = null
    } else if (latestValueMetrics.has(metric.id)) {
      totals[metric.id] = values[values.length - 1]
    } else if (averageMetrics.has(metric.id)) {
      totals[metric.id] = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
    } else {
      totals[metric.id] = values.reduce((sum, value) => sum + value, 0)
    }
  }

  const impressions = Number(totals.C10 || 0)
  const networkWeights = builtRows.reduce((acc, row) => {
    const rowImpressions = Number(row.C10 || 0)
    if (rowImpressions <= 0) return acc
    acc.total += rowImpressions
    acc.inNetwork += rowImpressions * Number(row.C36 || 0)
    acc.outNetwork += rowImpressions * Number(row.C37 || 0)
    return acc
  }, { total: 0, inNetwork: 0, outNetwork: 0 })

  totals.C09 = Number(totals.C06 || 0) + Number(totals.C07 || 0) + Number(totals.C08 || 0)
  totals.C26 = totals.C09 > 0 ? Math.round((impressions / totals.C09) * 100) / 100 : null
  totals.C36 = networkWeights.total > 0 ? Math.round((networkWeights.inNetwork / networkWeights.total) * 100) / 100 : null
  totals.C37 = networkWeights.total > 0 ? Math.round((networkWeights.outNetwork / networkWeights.total) * 100) / 100 : null
  totals.L05 = totals.L02 > 0 ? Math.min(100, Math.round((totals.L03 / totals.L02) * 10000) / 100) : null
  totals.L12 = totals.L10 > 0 ? Math.min(100, Math.round((totals.L11 / totals.L10) * 10000) / 100) : null
  totals.L14 = totals.L11 > 0 ? Math.min(100, Math.round((totals.L13 / totals.L11) * 10000) / 100) : null
  totals.L17 = totals.L13 > 0 ? Math.min(100, Math.round((totals.L15 / totals.L13) * 10000) / 100) : null
  totals.L18 = totals.L13 > 0 ? Math.min(100, Math.round((totals.L16 / totals.L13) * 10000) / 100) : null
  totals.L21 = totals.L19 > 0 ? Math.min(100, Math.round((totals.L20 / totals.L19) * 10000) / 100) : null
  totals.L26 = totals.L24 > 0 ? Math.min(100, Math.round((totals.L25 / totals.L24) * 10000) / 100) : null
  return totals
}

export function ClientPortalPage() {
  const { user, clientRecord, isClient, isAdmin, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const weekOptions = useMemo(() => getWeekOptions(12), [])
  const [selectedWeek, setSelectedWeek] = useState(getPreviousWeekStart())
  const [performancePeriod, setPerformancePeriod] = useState<PerformancePeriod>('weekly')
  const [selectedMonth, setSelectedMonth] = useState(() => getPreviousWeekStart().slice(0, 7))
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'leadgen' | 'campaigns' | 'actions' | 'trends' | 'reports' | 'highlights'>('overview')
  const [currentData, setCurrentData] = useState<any>(null)
  const [prevData, setPrevData] = useState<any>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null)
  const [ahaMoments, setAhaMoments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyTargets, setWeeklyTargets] = useState<any[]>([])
  const [monthlyTargets, setMonthlyTargets] = useState<any[]>([])
  const [mtdData, setMtdData] = useState<any[]>([])
  const [previousMonthData, setPreviousMonthData] = useState<any[]>([])
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, offset) => {
    const date = new Date()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - offset)
    return {
      value: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    }
  }), [])
  const monthWeeks = useMemo(
    () => getWeeksInSameMonth(performancePeriod === 'monthly' ? `${selectedMonth}-01` : selectedWeek),
    [performancePeriod, selectedMonth, selectedWeek],
  )

  // Reports tab state
  const [reportWeeklyData, setReportWeeklyData] = useState<any[]>([])
  const [reportTargets, setReportTargets] = useState<any[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [datePreset, setDatePreset] = useState<DatePreset>('8w')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [reportCategory, setReportCategory] = useState<CategoryFilter>('all')
  const [reportView, setReportView] = useState<ViewMode>('table')

  const reportDateRange = useMemo(() => {
    if (datePreset === '4w') return getNWeeksBack(4)
    if (datePreset === '8w') return getNWeeksBack(8)
    if (datePreset === '12w') return getNWeeksBack(12)
    if (datePreset === 'this_month') return getMonthRange(0)
    if (datePreset === 'last_month') return getMonthRange(-1)
    return { from: customFrom, to: customTo }
  }, [datePreset, customFrom, customTo])

  const reportWeekList = useMemo(() => getMondaysBetween(reportDateRange.from, reportDateRange.to), [reportDateRange])

  useEffect(() => {
    if (!clientRecord || activeTab !== 'reports' || reportWeekList.length === 0) return
    setReportLoading(true)
    Promise.all([
      supabase.from('weekly_data').select('*')
        .eq('client_id', clientRecord.id)
        .gte('week_start', reportWeekList[0])
        .lte('week_start', reportWeekList[reportWeekList.length - 1]),
      supabase.from('targets').select('*')
        .eq('client_id', clientRecord.id)
        .eq('target_type', 'weekly')
        .in('period', reportWeekList),
    ]).then(([{ data: wd }, { data: tg }]) => {
      setReportWeeklyData(wd || [])
      setReportTargets(tg || [])
      setReportLoading(false)
    })
  }, [clientRecord, activeTab, reportWeekList.join(',')])

  const reportAvailableMetrics = useMemo(() => {
    const base = ALL_METRICS.filter(m => m.type !== 'textarea' && m.type !== 'boolean' && m.type !== 'slider')
    return reportCategory === 'content' ? base.filter(m => m.category === 'content')
      : reportCategory === 'leadgen' ? base.filter(m => m.category === 'leadgen')
      : base
  }, [reportCategory])

  const getReportCellValue = (weekStart: string, metricId: string): number | null => {
    const row = reportWeeklyData.find(r => r.week_start === weekStart)
    if (!row) return null
    const built = buildWeekMetrics(row)
    const val = built?.[metricId as keyof typeof built]
    if (val === null || val === undefined) return null
    const n = Number(val)
    return isNaN(n) ? null : n
  }

  const getReportTarget = (metricId: string, weekStart?: string): number | null => {
    let t = weekStart
      ? reportTargets.find(t => t.metric_id === metricId && t.period === weekStart)
      : null
    if (!t) {
      const all = reportTargets
        .filter(t => t.metric_id === metricId && t.target_value !== null)
        .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
      t = all[0] ?? null
    }
    if (!t?.target_value) return null
    const n = Number(t.target_value)
    return isNaN(n) ? null : n
  }

  // Redirect non-clients away - but only to a destination they can actually
  // land on. Bouncing every non-client to /dashboard creates an infinite
  // redirect loop for accounts that are neither a client nor an admin
  // (e.g. a team member without a role assigned yet), since /dashboard's
  // own guard immediately redirects non-admins back to /portal.
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate({ to: '/login' }); return }
    if (!isClient && isAdmin) { navigate({ to: '/dashboard' }); return }
  }, [authLoading, user, isClient, isAdmin])

  useEffect(() => {
    if (!clientRecord) return
    fetchData()
    fetchCampaigns()
    ;(supabase as any).from('aha_moments').select('*')
      .eq('client_id', clientRecord.id)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => setAhaMoments(data || []))
  }, [clientRecord, selectedWeek, selectedMonth, performancePeriod])

  const fetchCampaigns = async () => {
    if (!clientRecord) return
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientRecord.id)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) {
      setCampaigns([])
      return
    }

    const { data: cdata } = await supabase
      .from('campaign_weekly_data')
      .select('*')
      .eq('client_id', clientRecord.id)
      .in('campaign_id', data.map(c => c.id))

    const enriched = data.map(c => {
      const byWeek: Record<string, any> = {}
      cdata?.filter(r => r.campaign_id === c.id).forEach(r => {
        byWeek[r.week_start] = r
      })
      return { ...c, byWeek }
    })

    const sortedCampaigns = enriched.slice().sort((a, b) => {
      const aActive = String(a.status).toLowerCase() === 'active'
      const bActive = String(b.status).toLowerCase() === 'active'
      if (aActive !== bActive) return aActive ? -1 : 1

      const aDate = a.started_date || a.created_at || ''
      const bDate = b.started_date || b.created_at || ''
      const dateOrder = bDate.localeCompare(aDate)
      if (dateOrder !== 0) return dateOrder
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    })

    setCampaigns(sortedCampaigns)
  }

  const fetchData = async () => {
    if (!clientRecord) return
    setLoading(true)
    try {
      // Month boundaries for the selected reporting period
      const periodMonth = performancePeriod === 'monthly' ? selectedMonth : selectedWeek.slice(0, 7)
      const selDate = new Date(`${periodMonth}-01T00:00:00Z`)
      const year = selDate.getUTCFullYear(), month = selDate.getUTCMonth()
      const monthStart = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0]
      const monthEnd = new Date(Date.UTC(year, month + 1, 0)).toISOString().split('T')[0]
      const previousMonthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0]
      const previousMonthEnd = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0]

      const [
        { data: curr },
        { data: history },
        { data: wTargets },
        { data: mTargets },
        { data: mtdRows },
        { data: previousMonthRows },
      ] = await Promise.all([
        supabase.from('weekly_data').select('content_metrics, leadgen_metrics, week_start')
          .eq('client_id', clientRecord.id).eq('week_start', selectedWeek).maybeSingle(),
        supabase.from('weekly_data').select('content_metrics, leadgen_metrics, week_start, week_label')
          .eq('client_id', clientRecord.id).order('week_start', { ascending: false }).limit(12),
        supabase.from('targets').select('metric_id, target_value')
          .eq('client_id', clientRecord.id).eq('target_type', 'weekly'),
        supabase.from('targets').select('metric_id, target_value')
          .eq('client_id', clientRecord.id).eq('target_type', 'monthly'),
        supabase.from('weekly_data').select('content_metrics, leadgen_metrics, week_start')
          .eq('client_id', clientRecord.id)
          .gte('week_start', monthStart)
          .lte('week_start', monthEnd),
        supabase.from('weekly_data').select('content_metrics, leadgen_metrics, week_start')
          .eq('client_id', clientRecord.id)
          .gte('week_start', previousMonthStart)
          .lte('week_start', previousMonthEnd),
      ])
      setCurrentData(curr)
      setWeeklyTargets(wTargets || [])
      setMonthlyTargets(mTargets || [])
      setMtdData(mtdRows || [])
      setPreviousMonthData(previousMonthRows || [])

      // Previous week
      const selectedIdx = weekOptions.findIndex(w => w.weekStart === selectedWeek)
      const prevWeek = weekOptions[selectedIdx + 1]?.weekStart
      if (prevWeek) {
        const { data: prev } = await supabase.from('weekly_data')
          .select('content_metrics, leadgen_metrics').eq('client_id', clientRecord.id)
          .eq('week_start', prevWeek).maybeSingle()
        setPrevData(prev)
      } else {
        setPrevData(null)
      }

      setHistoryData((history || []).reverse())
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  if (authLoading || (!isClient && isAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    )
  }

  if (!isClient) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center px-4">
        <p className="font-semibold">Your account isn't linked to a client yet.</p>
        <p className="text-sm text-muted-foreground">Ask an admin to assign you a role or link your account to a client.</p>
        <Button variant="outline" onClick={handleSignOut} className="mt-2">Sign out</Button>
      </div>
    )
  }

  if (!clientRecord) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    )
  }

  const currentBuilt = performancePeriod === 'monthly' ? aggregatePeriodMetrics(mtdData) : buildWeekMetrics(currentData)
  const prevBuilt = performancePeriod === 'monthly' ? aggregatePeriodMetrics(previousMonthData) : buildWeekMetrics(prevData)

  // MTD totals - sum each metric across all weeks in the selected month
  const mtdTotals: Record<string, number> = {}
  for (const row of mtdData) {
    const built = buildWeekMetrics(row)
    if (!built) continue
    for (const [key, val] of Object.entries(built)) {
      const n = Number(val)
      if (!isNaN(n) && val !== null && val !== undefined) {
        mtdTotals[key] = (mtdTotals[key] ?? 0) + n
      }
    }
  }
  mtdTotals.C26 = mtdTotals.C09 > 0 ? mtdTotals.C10 / mtdTotals.C09 : 0

  // Key metrics to show in the goal progress section
  const GOAL_METRICS = [
    { id: 'C09', label: 'Total Posts' },
    { id: 'C10', label: 'Impressions' },
    { id: 'C15', label: 'New Followers' },
    { id: 'L10', label: 'Connection Requests' },
    { id: 'L11', label: 'Accepted Invitations' },
    { id: 'L24', label: 'Meetings Booked' },
  ]

  const selDate = new Date(`${performancePeriod === 'monthly' ? selectedMonth : selectedWeek.slice(0, 7)}-01T00:00:00Z`)
  const monthName = selDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const currentPeriodLabel = performancePeriod === 'monthly' ? 'This Month' : 'This Week'
  const previousPeriodLabel = performancePeriod === 'monthly' ? 'Prev Month' : 'Prev Week'

  // Chart data
  const chartData = historyData.map(row => {
    const built = buildWeekMetrics(row)
    const label = row.week_label?.split(' – ')[0] || row.week_start?.slice(5) || ''
    const entry: Record<string, any> = { week: label }
    TREND_METRICS.forEach(m => {
      entry[m.id] = Number(built?.[m.id as keyof typeof built] ?? 0) || 0
    })
    return entry
  })

  const contentMetrics = CONTENT_METRICS.filter(m => m.group !== 'Qualitative' && m.type !== 'boolean' && m.type !== 'textarea')
  const leadgenMetrics = LEADGEN_METRICS.filter(m => m.group !== 'Qualitative' && m.type !== 'boolean' && m.type !== 'textarea')

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'content', label: 'Content' },
    { id: 'leadgen', label: 'Lead Gen' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'actions', label: 'Action Plan' },
    { id: 'trends', label: 'Trends' },
    { id: 'highlights', label: '✨ Highlights' },
    { id: 'reports', label: 'Reports' },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="https://myntmore.com" target="_blank" rel="noopener noreferrer">
              <img src={myntmoreLogo} alt="Myntmore" className="h-10 object-contain" />
            </a>
            <div className="h-6 w-px bg-border" />
            <div>
              <p className="text-sm font-black tracking-tight">{clientRecord?.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{clientRecord?.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs font-bold border-gold/40 text-gold bg-gold/5">
              Campaign Tracker
            </Badge>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate({ to: '/dashboard' })} className="gap-1.5 font-bold">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Back to Dashboard
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Your Campaign Performance</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {performancePeriod === 'monthly' ? 'Monthly' : 'Weekly'} metrics for your LinkedIn campaign.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="grid grid-cols-2 rounded-lg border bg-white p-1 shadow-sm" aria-label="Performance period">
              {(['weekly', 'monthly'] as const).map(period => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setPerformancePeriod(period)}
                  aria-pressed={performancePeriod === period}
                  className={cn(
                    'rounded-md px-4 py-2 text-xs font-black transition-all',
                    performancePeriod === period
                      ? 'bg-gold text-black shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {period === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
            <div className="min-w-[220px]">
              {performancePeriod === 'weekly' ? (
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="bg-white font-bold h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekOptions.map(w => <SelectItem key={w.weekStart} value={w.weekStart}>{w.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-white font-bold h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(month => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto border-b">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'px-5 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px',
                activeTab === t.id
                  ? 'border-gold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {OVERVIEW_METRICS.map(m => {
                    const curr = currentBuilt?.[m.id as keyof typeof currentBuilt] ?? null
                    const prev = prevBuilt?.[m.id as keyof typeof prevBuilt] ?? null
                    const Icon = m.icon
                    return (
                      <Card key={m.id} className="bg-white border shadow-sm">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{m.label}</p>
                            <Icon className="w-4 h-4 text-gold" />
                          </div>
                          <p className="text-3xl font-black text-foreground">{formatVal(curr)}{m.percentage && curr !== null ? '%' : ''}</p>
                          <div className="mt-1.5 text-xs">
                            <Delta curr={curr} prev={prev} />
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* Quick metrics grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gold" /> Content Highlights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { id: 'C15', label: 'New Followers' },
                        { id: 'C13', label: 'Engagement Total' },
                        { id: 'C17', label: 'Engagement on Other Profiles' },
                        { id: 'C16', label: 'Total Follower Count' },
                      ].map(m => {
                        const curr = currentBuilt?.[m.id as keyof typeof currentBuilt]
                        const prev = prevBuilt?.[m.id as keyof typeof prevBuilt]
                        return (
                          <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-dashed border-muted last:border-0">
                            <span className="text-sm text-muted-foreground">{m.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black">{formatVal(curr)}</span>
                              <span className="text-xs w-24 text-right"><Delta curr={curr} prev={prev} /></span>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  <Card className="bg-white border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-gold" /> Lead Gen Highlights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { id: 'L11', label: 'Accepted Invitations' },
                        { id: 'L12', label: 'Acceptance Rate', pct: true },
                        { id: 'L13', label: 'Answered Messages' },
                        { id: 'L15', label: 'Positive Replies' },
                      ].map(m => {
                        const curr = currentBuilt?.[m.id as keyof typeof currentBuilt]
                        const prev = prevBuilt?.[m.id as keyof typeof prevBuilt]
                        return (
                          <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-dashed border-muted last:border-0">
                            <span className="text-sm text-muted-foreground">{m.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black">
                                {(m as any).pct ? formatPct(curr as number) : formatVal(curr)}
                              </span>
                              <span className="text-xs w-24 text-right"><Delta curr={curr} prev={prev} /></span>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Summary + Goal Progress */}
                <Card className="bg-white border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-gold" /> {monthName} - Goal Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {GOAL_METRICS.map(m => {
                      const mtd = mtdTotals[m.id] ?? null
                      const wTgt = weeklyTargets.find(t => t.metric_id === m.id)?.target_value ?? null
                      const mTgt = monthlyTargets.find(t => t.metric_id === m.id)?.target_value ?? null
                      // Use monthly target if set, else estimate from weekly * weeks in month
                      const weeksInMonth = mtdData.length || 4
                      const effectiveMTgt = mTgt !== null ? Number(mTgt) : (wTgt !== null ? Number(wTgt) * weeksInMonth : null)
                      const pct = effectiveMTgt && mtd !== null ? Math.min(Math.round((mtd / effectiveMTgt) * 100), 100) : null
                      const rawPct = effectiveMTgt && mtd !== null ? Math.round((mtd / effectiveMTgt) * 100) : null

                      const barColor = rawPct === null ? 'bg-muted'
                        : rawPct >= 100 ? 'bg-green-500'
                        : rawPct >= 75  ? 'bg-yellow-400'
                        : rawPct >= 50  ? 'bg-orange-400'
                        : 'bg-red-400'

                      const textColor = rawPct === null ? 'text-muted-foreground'
                        : rawPct >= 100 ? 'text-green-600'
                        : rawPct >= 75  ? 'text-yellow-600'
                        : rawPct >= 50  ? 'text-orange-500'
                        : 'text-red-500'

                      return (
                        <div key={m.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={cn('font-black', textColor)}>
                                {mtd !== null ? mtd.toLocaleString('en-IN') : '-'}
                              </span>
                              {effectiveMTgt !== null && (
                                <span className="text-muted-foreground">/ {effectiveMTgt.toLocaleString('en-IN')}</span>
                              )}
                              {rawPct !== null && (
                                <span className={cn('font-black w-10 text-right', textColor)}>{rawPct}%</span>
                              )}
                            </div>
                          </div>
                          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', barColor)}
                              style={{ width: `${pct ?? 0}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {GOAL_METRICS.every(m => (monthlyTargets.find(t => t.metric_id === m.id)?.target_value ?? weeklyTargets.find(t => t.metric_id === m.id)?.target_value) === undefined) && (
                      <p className="text-xs text-muted-foreground text-center py-2">Targets not set yet - ask your account manager.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* CONTENT TAB */}
            {activeTab === 'content' && (
              <Card className="bg-white border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gold" /> Content Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase pl-6">Metric</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">{currentPeriodLabel}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">{previousPeriodLabel}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right pr-6">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contentMetrics.map(m => {
                        const curr = currentBuilt?.[m.id as keyof typeof currentBuilt] ?? null
                        const prev = prevBuilt?.[m.id as keyof typeof prevBuilt] ?? null
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm font-medium pl-6">{m.name}</TableCell>
                            <TableCell className="text-right font-black">{formatVal(curr)}</TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">{formatVal(prev)}</TableCell>
                            <TableCell className="text-right pr-6"><Delta curr={curr} prev={prev} /></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* LEAD GEN TAB */}
            {activeTab === 'leadgen' && (
              <Card className="bg-white border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-gold" /> Lead Generation Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase pl-6">Metric</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">{currentPeriodLabel}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">{previousPeriodLabel}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right pr-6">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadgenMetrics.map(m => {
                        const curr = currentBuilt?.[m.id as keyof typeof currentBuilt] ?? null
                        const prev = prevBuilt?.[m.id as keyof typeof prevBuilt] ?? null
                        const isRate = ['L05','L12','L14','L17','L18','L21','L26'].includes(m.id)
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm font-medium pl-6">{m.name}</TableCell>
                            <TableCell className="text-right font-black">
                              {isRate ? formatPct(curr as number) : formatVal(curr)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">
                              {isRate ? formatPct(prev as number) : formatVal(prev)}
                            </TableCell>
                            <TableCell className="text-right pr-6"><Delta curr={curr} prev={prev} /></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* CAMPAIGNS TAB */}
            {activeTab === 'campaigns' && (
              <Card className="bg-white border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-gold" /> Your Campaigns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No campaigns yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {campaigns.map(c => (
                        <CampaignMonthTable key={c.id} campaign={c} monthWeeks={monthWeeks} onViewDetails={setSelectedCampaign} readOnly />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ACTION PLAN TAB */}
            {activeTab === 'actions' && (
              <ClientActionPlan clientId={clientRecord.id} canManageInternally={isAdmin} />
            )}

            {/* TRENDS TAB */}
            {activeTab === 'trends' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {TREND_METRICS.map(m => (
                  <Card key={m.id} className="bg-white border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold uppercase tracking-wider">{m.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id={`grad-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={m.color} stopOpacity={0.15} />
                              <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                          <XAxis dataKey="week" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} width={36} />
                          <Tooltip
                            contentStyle={{ fontSize: '12px', border: '1px solid #E5E5E5', borderRadius: '8px' }}
                            formatter={(v: any) => [formatVal(v), m.label]}
                          />
                          <Area
                            type="monotone" dataKey={m.id}
                            stroke={m.color} strokeWidth={2.5}
                            fill={`url(#grad-${m.id})`}
                            dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* HIGHLIGHTS TAB */}
            {activeTab === 'highlights' && (
              <div className="space-y-6">
                {/* Aha Moments */}
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider mb-3 flex items-center gap-2">
                    🎉 Aha Moments
                  </h2>
                  {ahaMoments.length === 0 ? (
                    <Card className="bg-white border shadow-sm">
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        No highlights yet - your account manager will post milestone wins here.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {ahaMoments.map(m => (
                        <Card key={m.id} className="bg-white border shadow-sm overflow-hidden">
                          <CardContent className="p-5">
                            <div className="flex items-start gap-3">
                              <span className="text-3xl leading-none mt-0.5">{m.emoji || '🎉'}</span>
                              <div>
                                <p className="font-black text-base leading-tight">{m.title}</p>
                                {m.description && (
                                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{m.description}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">
                                  {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weekly qualitative notes */}
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider mb-3 flex items-center gap-2">
                    📝 This Week's Notes
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'C24', label: "What's Working (Content)", cat: 'content_metrics', icon: '✅' },
                      { id: 'C25', label: "What's Not Working (Content)", cat: 'content_metrics', icon: '⚠️' },
                      { id: 'L28', label: "What's Working (Lead Gen)", cat: 'leadgen_metrics', icon: '✅' },
                      { id: 'L29', label: "What's Not Working / Blockers", cat: 'leadgen_metrics', icon: '⚠️' },
                    ].map(m => {
                      const raw = currentData?.[m.cat as keyof typeof currentData]
                      const val = raw ? (raw as any)[m.id] : null
                      return (
                        <Card key={m.id} className="bg-white border shadow-sm">
                          <CardContent className="p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                              {m.icon} {m.label}
                            </p>
                            <p className="text-sm leading-relaxed text-foreground/80 italic">
                              {val ? `"${val}"` : 'No input this week.'}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                {/* Filter bar */}
                <Card className="bg-white border shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Period:</span>
                      {DATE_PRESETS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setDatePreset(p.id)}
                          className={cn(
                            "px-2.5 py-1 text-xs rounded-md border transition-all",
                            datePreset === p.id
                              ? "bg-gold text-black border-gold font-bold shadow-sm"
                              : "bg-background hover:bg-muted border-border text-muted-foreground"
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
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

                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <div className="flex gap-0.5 border rounded-lg p-0.5 bg-muted/30">
                        {(['all', 'content', 'leadgen'] as const).map(cat => (
                          <button
                            key={cat}
                            onClick={() => setReportCategory(cat)}
                            className={cn(
                              "px-2.5 py-1 text-xs rounded-md transition-all",
                              reportCategory === cat ? "bg-background shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {cat === 'all' ? 'All' : cat === 'content' ? 'Content' : 'Lead Gen'}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-0.5 border rounded-lg p-0.5 bg-muted/30">
                        {([
                          ['table', Table2, 'Table'],
                          ['trends', TrendingUp, 'Trends'],
                          ['summary', BarChart2, 'Summary'],
                        ] as const).map(([id, Icon, label]) => (
                          <button
                            key={id}
                            onClick={() => setReportView(id)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all",
                              reportView === id ? "bg-background shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {reportWeekList.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="font-medium">{reportWeekList.length} weeks</span>
                        <span>·</span>
                        <span>{fmtWeekShort(reportWeekList[0])} → {fmtWeekShort(reportWeekList[reportWeekList.length - 1])}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {reportLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-gold" />
                  </div>
                ) : reportWeekList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-muted-foreground">
                    Pick a date range to see your report.
                  </div>
                ) : (
                  <>
                    {reportView === 'table' && (
                      <Card className="bg-white border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="text-[10px] font-black uppercase min-w-[180px] sticky left-0 bg-muted/20 z-10">Metric</TableHead>
                                {reportWeekList.map(w => (
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
                              {reportAvailableMetrics.map(m => {
                                const values = reportWeekList.map(w => getReportCellValue(w, m.id))
                                const numVals = values.filter(v => v !== null) as number[]
                                const total = numVals.length > 0 ? numVals.reduce((a, b) => a + b, 0) : null
                                const avg = total !== null && numVals.length > 0 ? total / numVals.length : null
                                const tgt = getReportTarget(m.id)

                                return (
                                  <TableRow key={m.id} className="h-8 hover:bg-muted/10">
                                    <TableCell className="py-1 text-xs font-medium sticky left-0 bg-background border-r z-[5] whitespace-nowrap max-w-[180px] truncate">
                                      {m.name}
                                    </TableCell>
                                    {values.map((val, wi) => {
                                      const weekTgt = getReportTarget(m.id, reportWeekList[wi])
                                      const pct = weekTgt && val !== null ? Math.round((val / weekTgt) * 100) : null
                                      return (
                                        <TableCell
                                          key={reportWeekList[wi]}
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
                      </Card>
                    )}

                    {reportView === 'trends' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {reportAvailableMetrics.slice(0, 12).map(m => {
                          const chartData = reportWeekList.map(w => ({
                            week: fmtWeekShort(w),
                            value: getReportCellValue(w, m.id),
                          }))
                          const maxTarget = getReportTarget(m.id) ?? 0

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
                                    <Line
                                      type="monotone" dataKey="value"
                                      stroke={GOLD} strokeWidth={2}
                                      dot={{ r: 3, fill: GOLD }}
                                      activeDot={{ r: 5 }}
                                      connectNulls={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          )
                        })}
                        {reportAvailableMetrics.length > 12 && (
                          <div className="col-span-full text-center text-xs text-muted-foreground py-4">
                            Showing first 12 metrics. Narrow the category filter to see more.
                          </div>
                        )}
                      </div>
                    )}

                    {reportView === 'summary' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {reportAvailableMetrics.map(m => {
                          const values = reportWeekList.map(w => getReportCellValue(w, m.id))
                          const numVals = values.filter(v => v !== null) as number[]
                          if (numVals.length === 0) return null
                          const total = numVals.reduce((a, b) => a + b, 0)
                          const avg = total / numVals.length
                          const best = Math.max(...numVals)
                          const bestWeekIdx = values.findIndex(v => v === best)
                          const bestWeek = bestWeekIdx >= 0 ? fmtWeekShort(reportWeekList[bestWeekIdx]) : '-'
                          const tgt = getReportTarget(m.id)
                          const avgAch = tgt ? Math.round((avg / tgt) * 100) : null
                          const badge = achBadge(avgAch)

                          return (
                            <Card key={m.id} className="overflow-hidden">
                              <CardContent className="p-3">
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate mb-1">{m.name}</div>
                                <div className={cn("text-2xl font-black tabular-nums leading-none", achTextColor(avgAch))}>
                                  {formatDashboardValue(total, m.id)}
                                </div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">total · {numVals.length}w</div>
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
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <a href="https://myntmore.com" target="_blank" rel="noopener noreferrer" className="font-bold text-foreground hover:underline">Myntmore</a> · Data refreshes weekly
          </p>
        </div>
      </div>
      <CampaignDetailsDialog campaign={selectedCampaign} open={!!selectedCampaign} onOpenChange={open => !open && setSelectedCampaign(null)} />
    </div>
  )
}
