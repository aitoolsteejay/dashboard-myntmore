import React, { useState, useEffect, useMemo } from 'react'
import { Link } from "@tanstack/react-router"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Users, Target, Activity, Instagram, Youtube, Mail, Mic, ArrowRight, LayoutDashboard, Send, Handshake, IndianRupee, FileText, Star, Globe, Linkedin, ChevronDown, ChevronUp, MessageSquare, Trophy } from "lucide-react"
// Removed lib/notifications import
import { Gift, Cake, Calendar, Bell, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getPreviousWeekStart, getWeekLabel, getWeeksInSameMonth, isLastWeekOfMonth } from "@/utils/weekUtils"
import { CampaignMonthTable } from "../monday/CampaignMonthTable"
import { EditCampaignModal } from "../monday/EditCampaignModal"
import { CONTENT_METRICS, LEADGEN_METRICS, ALL_METRICS } from "@/data/metrics"
import { mv, mt, fmt, delta, deltaColor, tjVal, salesVal, sv, readMetric, formatMetricValue, formatDashboardValue } from "@/utils/dataUtils"

import { fmt as gFmt, fmtDelta, Delta, fmtPct, fmtPctDelta } from "@/utils/format"
import { calcRateCapped, readNum } from "@/utils/readMetric"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { buildWeekMetrics, formatMetricDisplay, formatPct } from "@/utils/metricCalculations"
import { backfillHighScores } from "@/utils/highScores"
import { fetchTJLifetimeHighs, TJLifetimeHighs } from "@/utils/tjHighScores"
import { fetchMMLifetimeHighs, MMLifetimeHighs } from "@/utils/mmHighScores"
import { formatWeekDate } from "@/utils/dateUtils"
import { sortAlphabetically } from "@/utils/sort"
import { useWorkspace } from "@/lib/workspace"
import type {
  WeeklyData, WeeklyDataSummary, Profile, MetricTarget, HealthScore, Actionable,
  Campaign, MyntmoreProcess, ProcessUpdate, TjWeeklyData, SalesWeeklyData,
  MmWeeklyData, AppNotification, ClientAlertRow, ClientWithManagers, HighScore,
} from '@/types'

// Helpers replaced by @/utils/dataUtils
function asDashboardRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

// --- DeliverableAlertRow sub-component ---
interface DeliverableAlertItem {
  clientId: string
  clientName: string
  notSubmitted: boolean
  lacking: Array<{ metricId: string; metricName: string; actual: number | null; target: number; pct: number | null }>
  worstPct: number | null
}

function DeliverableAlertRow({ item, displayWeek }: { item: DeliverableAlertItem; displayWeek: string }) {
  const [expanded, setExpanded] = React.useState(false)

  const pctColor = (pct: number | null) => {
    if (pct === null) return 'text-red-600'
    if (pct < 50) return 'text-red-600'
    if (pct < 80) return 'text-amber-600'
    return 'text-amber-500'
  }

  const dotColor = item.notSubmitted ? 'bg-red-500 animate-pulse' :
    (item.worstPct === null || item.worstPct < 50) ? 'bg-red-500' :
    item.worstPct < 80 ? 'bg-amber-500' : 'bg-amber-400'

  return (
    <div className="transition-colors">
      {/* Collapsed row */}
      <div
        className="flex items-center justify-between px-3 py-2.5 hover:bg-amber-50/60 cursor-pointer"
        onClick={() => !item.notSubmitted && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
          <span className="text-xs font-black text-amber-950 truncate">{item.clientName}</span>
          {item.notSubmitted ? (
            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 shrink-0">No data submitted</span>
          ) : (
            <span className="text-[10px] font-bold text-amber-700 shrink-0">
              {item.lacking.length} metric{item.lacking.length > 1 ? 's' : ''} below target
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/data-entry"
            onClick={e => e.stopPropagation()}
            className="text-[10px] font-black text-amber-800 hover:text-amber-950 underline-offset-2 hover:underline"
          >
            Enter data →
          </Link>
          {!item.notSubmitted && (
            <ChevronDown className={cn('w-3 h-3 text-amber-600 transition-transform shrink-0', expanded && 'rotate-180')} />
          )}
        </div>
      </div>

      {/* Expanded metric breakdown */}
      {expanded && !item.notSubmitted && (
        <div className="px-8 pb-3 grid grid-cols-2 gap-x-6 gap-y-1.5 bg-amber-50/30">
          {item.lacking.map(m => (
            <div key={m.metricId} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-amber-900 font-semibold truncate">{m.metricName}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn('text-[10px] font-black tabular-nums', pctColor(m.pct))}>
                  {m.actual ?? 0} / {m.target}
                </span>
                <div className="w-16 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', m.pct !== null && m.pct >= 80 ? 'bg-amber-400' : m.pct !== null && m.pct >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${Math.min(m.pct ?? 0, 100)}%` }}
                  />
                </div>
                <span className={cn('text-[9px] font-bold tabular-nums', pctColor(m.pct))}>
                  {m.pct !== null ? `${m.pct}%` : '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { session, profile, isAdmin } = useAuth()
  const [clients, setClients] = useState<ClientWithManagers[]>([])
  const [healthScores, setHealthScores] = useState<HealthScore[]>([])
  const [alerts, setAlerts] = useState<ClientAlertRow[]>([])
  const [tjData, setTjData] = useState<TjWeeklyData | null>(null)
  const [tjPrev, setTjPrev] = useState<TjWeeklyData | null>(null)
  const [tjLifetimeHighs, setTjLifetimeHighs] = useState<TJLifetimeHighs>({})
  const [expandedTJCards, setExpandedTJCards] = useState<Set<string>>(new Set())
  const [mmLifetimeHighs, setMmLifetimeHighs] = useState<MMLifetimeHighs>({})
  const [expandedMMRows, setExpandedMMRows] = useState<Set<string>>(new Set())
  const [salesData, setSalesData] = useState<SalesWeeklyData | null>(null)
  const [salesPrev, setSalesPrev] = useState<SalesWeeklyData | null>(null)
  const [mmData, setMmData] = useState<MmWeeklyData | null>(null)
  const [prevMmData, setPrevMmData] = useState<MmWeeklyData | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [prevWeeklyData, setPrevWeeklyData] = useState<WeeklyData[]>([])
  const [monthWeeklyData, setMonthWeeklyData] = useState<WeeklyDataSummary[]>([])
  const [targets, setTargets] = useState<MetricTarget[]>([])
  const [monthlyTargets, setMonthlyTargets] = useState<MetricTarget[]>([])
  const [highScores, setHighScores] = useState<HighScore[]>([])
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [actionables, setActionables] = useState<Actionable[]>([])
  const [processesData, setProcessesData] = useState<MyntmoreProcess[]>([])
  const [processesUpdates, setProcessesUpdates] = useState<ProcessUpdate[]>([])
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set())
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['alerts']))
  const [loading, setLoading] = useState(true)
  const [isMonthlyView, setIsMonthlyView] = useState(false)
  const [monthTjRows, setMonthTjRows] = useState<any[]>([])
  const [monthSalesRows, setMonthSalesRows] = useState<any[]>([])
  const [monthMmRows, setMonthMmRows] = useState<any[]>([])
  const [weeklyBreakdownClients, setWeeklyBreakdownClients] = useState<Set<string>>(new Set())
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [clientSettings, setClientSettings] = useState<Record<string, {
    active_content_metrics: string[] | null
    active_leadgen_metrics: string[] | null
    content_enabled: boolean
    leadgen_enabled: boolean
  }>>({})

  const isServiceEnabled = (clientId: string, category: 'content' | 'leadgen') => {
    const settings = clientSettings[clientId]
    return category === 'content'
      ? settings?.content_enabled ?? true
      : settings?.leadgen_enabled ?? true
  }

  const activeMetricsFor = (clientId: string, category: 'content' | 'leadgen') => {
    const metrics = category === 'content' ? CONTENT_METRICS : LEADGEN_METRICS
    const ids = category === 'content'
      ? clientSettings[clientId]?.active_content_metrics
      : clientSettings[clientId]?.active_leadgen_metrics
    if (ids === null || ids === undefined) return metrics
    const impressionIds = new Set(['C10', 'C26', 'C36', 'C37'])
    const impressionsEnabled = category === 'content' && ids.includes('C10')
    return metrics.filter(metric => ids.includes(metric.id) || (impressionsEnabled && impressionIds.has(metric.id)))
  }

  const handleDismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    toast.success("Notification dismissed")
  }
  
  // Helper: days until next annual occurrence of a date
  const getDaysUntilNextOccurrence = (dateStr: string, today: Date): number => {
    const d = new Date(dateStr)
    const thisYear = today.getFullYear()
  
    let next = new Date(thisYear, d.getMonth(), d.getDate())
    next.setHours(0, 0, 0, 0)
  
    if (next < today) {
      next = new Date(thisYear + 1, d.getMonth(), d.getDate())
    }
  
    return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }
  
  const checkNotifications = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcoming: any[] = []
  
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, birthday, myntmore_start_date')
      .eq('status', 'active')
  
    clients?.forEach(client => {
      // Birthday check - 21 days ahead
      if (client.birthday) {
        const daysUntil = getDaysUntilNextOccurrence(client.birthday, today)
        if (daysUntil >= 0 && daysUntil <= 21) {
          const bdayDate = new Date(client.birthday)
          const bdayThisYear = new Date(today.getFullYear(), bdayDate.getMonth(), bdayDate.getDate())
          const bdayLabel = bdayThisYear.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
          upcoming.push({
            id: client.id + '_bday',
            clientId: client.id,
            clientName: client.name,
            type: 'birthday',
            daysUntil,
            severity: daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
            message: daysUntil === 0
              ? `🎂 Today is ${client.name}'s birthday! Don't forget to wish them.`
              : `🎂 ${client.name}'s birthday is in ${daysUntil} day${daysUntil > 1 ? 's' : ''} · ${bdayLabel}`
          })
        }
      }
  
      // Work anniversary check - 21 days ahead
      if (client.myntmore_start_date) {
        const start = new Date(client.myntmore_start_date)
        const daysUntil = getDaysUntilNextOccurrence(client.myntmore_start_date, today)
        const years = today.getFullYear() - start.getFullYear()
          - (getDaysUntilNextOccurrence(client.myntmore_start_date, today) > 0
            && new Date(today.getFullYear(), start.getMonth(), start.getDate()) > today ? 1 : 0)
  
        if (daysUntil >= 0 && daysUntil <= 21 && years > 0) {
          const annexThisYear = new Date(today.getFullYear(), start.getMonth(), start.getDate())
          const annexLabel = annexThisYear.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
          upcoming.push({
            id: client.id + '_anniv',
            clientId: client.id,
            clientName: client.name,
            type: 'work_anniversary',
            daysUntil,
            severity: daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
            message: daysUntil === 0
              ? `🎉 Today is ${client.name}'s ${years}-year anniversary with Myntmore!`
              : `🎉 ${client.name}'s ${years}-year Myntmore anniversary is in ${daysUntil} day${daysUntil > 1 ? 's' : ''} · ${annexLabel}`
          })
        }
      }
    })
  
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil)
    setNotifications(upcoming)
  }

  const toggleClient = (id: string) => {
    const next = new Set(expandedClients)
    if (next.has(id)) {
      next.delete(id)
      setExpandedClients(next)
    } else {
      next.add(id)
      setExpandedClients(next)
    }
  }

  const toggleWeeklyBreakdown = (id: string) => {
    const next = new Set(weeklyBreakdownClients)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setWeeklyBreakdownClients(next)
  }

  const toggleSection = (id: string) => {
    const next = new Set(collapsedSections)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCollapsedSections(next)
  }

  const SectionHeader = ({ title, id, icon: Icon }: { title: string, id: string, icon: any }) => (
    <div 
      className="flex items-center justify-between py-4 border-b-2 border-gold cursor-pointer select-none group"
      onClick={() => toggleSection(id)}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-gold" />
        <h2 className="text-xl font-black tracking-tight uppercase">{title}</h2>
      </div>
      {collapsedSections.has(id) ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
    </div>
  )

  const MetricTable = ({
    metrics,
    currentData,
    prevData,
    category,
    clientTargets,
    clientMonthlyTargets,
    clientMtdTotals,
    clientHighScores
  }: {
    metrics: any[],
    currentData: any,
    prevData: any,
    category: 'content_metrics' | 'leadgen_metrics',
    clientTargets: any[],
    clientMonthlyTargets: any[],
    clientMtdTotals: Record<string, number>,
    clientHighScores: HighScore[]
  }) => {
    const currentBuilt = buildWeekMetrics(currentData)
    const prevBuilt = buildWeekMetrics(prevData)
    const [expandedTextareas, setExpandedTextareas] = React.useState<Set<string>>(new Set())
    const [stickyHeader, setStickyHeader] = React.useState(false)
    return (
    <div>
      <div className="flex items-center gap-3 px-1 py-1.5 text-[10px] font-semibold text-muted-foreground border-b mb-1">
        <span className="uppercase tracking-wide">Ach% key:</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-400"></span><span className="text-green-700">≥100% On target</span></span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-100 border border-yellow-400"></span><span className="text-yellow-700">75–99% Close</span></span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-100 border border-orange-400"></span><span className="text-orange-600">50–74% Below</span></span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-400"></span><span className="text-red-600">&lt;50% Off track</span></span>
        <span className="flex items-center gap-1 ml-2"><span className="text-yellow-500">★</span><span>New high</span></span>
        <span className="flex items-center gap-1"><span style={{ color: '#B8860B' }} className="font-bold">■</span><span style={{ color: '#B8860B' }}>Best ever</span></span>
        <button
          onClick={() => setStickyHeader(h => !h)}
          className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${stickyHeader ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'}`}
        >
          {stickyHeader ? '📌 Unfreeze' : '📌 Freeze'}
        </button>
      </div>
      <div className={stickyHeader ? "overflow-x-auto overflow-y-auto max-h-[70vh]" : "overflow-x-auto"}>
      <Table>
        <TableHeader className={`bg-muted/30${stickyHeader ? ' sticky top-0 z-10' : ''}`}>
          <TableRow>
            <TableHead className="text-[10px] font-black uppercase">Metric Name</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-center">Current Week</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-center">Previous Week</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-center">Weekly Target Status</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-center text-blue-600">Monthly Target Status</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-center text-amber-600">Best Ever Week</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-center text-amber-600">Best Ever Month</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map(m => {
            const current = currentBuilt?.[m.id as keyof typeof currentBuilt] ?? null
            const prev = prevBuilt?.[m.id as keyof typeof prevBuilt] ?? null
            const target = clientTargets.find(t => t.metric_id === m.id)?.target_value ?? null
            const monthlyTarget = clientMonthlyTargets.find(t => t.metric_id === m.id)?.target_value ?? null
            const hs = clientHighScores.find(h => h.metric_id === m.id)
            const bestEver = hs?.lifetime_high ?? null
            const bestEverMonth = hs?.lifetime_high_month ?? null
            const currentNum = current !== null && !isNaN(Number(current)) ? Number(current) : null
            const isNewHigh = currentNum !== null && currentNum > 0 && bestEver !== null && currentNum > Number(bestEver)

            let achNum: number | null = null
            if (target && currentNum !== null) {
              achNum = Math.round((currentNum / Number(target)) * 100)
            }
            const ach = target !== null ? formatMetricValue(target, m.id) : '-'

            const achColor = (n: number | null) => n === null ? ''
              : n >= 100 ? 'text-green-600'
              : n >= 75  ? 'text-yellow-600'
              : n >= 50  ? 'text-orange-500'
              : 'text-red-600'
            const achBg = (n: number | null) => n === null ? ''
              : n >= 100 ? 'bg-green-50'
              : n >= 75  ? 'bg-yellow-50'
              : n >= 50  ? 'bg-orange-50'
              : 'bg-red-50'

            const mtdVal = clientMtdTotals[m.id] ?? null
            let moAchNum: number | null = null
            if (monthlyTarget && mtdVal !== null) {
              moAchNum = Math.round((mtdVal / Number(monthlyTarget)) * 100)
            }
            const moAch = monthlyTarget !== null ? formatMetricValue(monthlyTarget, m.id) : '-'

            return (
              <TableRow key={m.id} className="h-8">
                <TableCell className="py-1 text-xs font-medium">{m.name}</TableCell>
                {m.type === 'textarea' ? (
                  <TableCell colSpan={6} className="py-1 text-left">
                    {current ? (
                      <button
                        className="text-left w-full"
                        onClick={() => {
                          const next = new Set(expandedTextareas)
                          if (next.has(m.id)) next.delete(m.id)
                          else next.add(m.id)
                          setExpandedTextareas(next)
                        }}
                      >
                        <span className="text-[11px] italic text-foreground/70 leading-relaxed">
                          {expandedTextareas.has(m.id)
                            ? String(current)
                            : `"${String(current).slice(0, 80)}${String(current).length > 80 ? '…"' : '"'}`}
                        </span>
                        <span className="ml-1 text-[9px] font-bold uppercase text-muted-foreground">
                          {expandedTextareas.has(m.id) ? '▲ less' : String(current).length > 80 ? '▼ more' : ''}
                        </span>
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="py-1 text-center text-xs font-bold">
                      <span className="inline-flex items-center gap-1 justify-center">
                        {isNewHigh && <span title="New high score!" className="text-yellow-500 text-sm leading-none">★</span>}
                        {['L12', 'L14', 'L17'].includes(m.id) ? formatPct(current as number) : formatDashboardValue(current, m.id)}
                      </span>
                    </TableCell>
                    <TableCell className="py-1 text-center text-xs text-muted-foreground">
                      {['L12', 'L14', 'L17'].includes(m.id) ? formatPct(prev as number) : formatDashboardValue(prev, m.id)}
                    </TableCell>
                    <TableCell
                      className={cn("py-1 text-center text-xs font-black rounded", achColor(achNum), achBg(achNum))}
                      title={target !== null ? `Target: ${formatMetricValue(target, m.id)} | ${fmtDelta(current as any, target as any).text}` : undefined}
                    >
                      {ach}
                    </TableCell>
                    <TableCell
                      className={cn("py-1 text-center text-xs font-black rounded", achColor(moAchNum), achBg(moAchNum))}
                      title={mtdVal !== null && monthlyTarget ? `MTD: ${mtdVal} / ${monthlyTarget}` : undefined}
                    >
                      {moAch}
                    </TableCell>
                    <TableCell
                      className="py-1 text-center text-xs font-bold cursor-help"
                      style={{ color: bestEver !== null ? '#B8860B' : undefined }}
                      title={hs?.achieved_week ? `Achieved: w/c ${new Date(hs.achieved_week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}
                    >
                      {bestEver !== null ? (['L12', 'L14', 'L17'].includes(m.id) ? formatPct(bestEver as number) : formatDashboardValue(bestEver, m.id)) : '-'}
                    </TableCell>
                    <TableCell
                      className="py-1 text-center text-xs font-bold text-amber-600 cursor-help"
                      title={hs?.achieved_month ? `Achieved: ${new Date(hs.achieved_month + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : undefined}
                    >
                      {bestEverMonth !== null ? (['L12', 'L14', 'L17'].includes(m.id) ? formatPct(bestEverMonth as number) : formatDashboardValue(bestEverMonth, m.id)) : '-'}
                    </TableCell>
                  </>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
    </div>
    )
  }

  const WeeklyBreakdown = ({ client, weeks }: { client: any, weeks: any[] }) => {
    // Calculate Monthly Totals
    const monthlyTotals: Record<string, number> = {}
    weeks.forEach(week => {
      ALL_METRICS.forEach(m => {
        const val = readMetric(week, m.category === 'content' ? 'content_metrics' : 'leadgen_metrics', m.id)
        if (val !== null && !isNaN(Number(val))) {
          monthlyTotals[m.id] = (monthlyTotals[m.id] ?? 0) + Number(val)
        }
      })
    })

    // Recalculate rates for monthly totals
    monthlyTotals['L12'] = calcRateCapped(monthlyTotals['L11'], monthlyTotals['L10']) || 0
    monthlyTotals['L14'] = calcRateCapped(monthlyTotals['L13'], monthlyTotals['L11']) || 0
    monthlyTotals['C26'] = monthlyTotals['C09'] > 0 ? monthlyTotals['C10'] / monthlyTotals['C09'] : 0

    return (
      <div className="mt-6 border-t border-border overflow-x-auto w-full">
        <Table className="min-w-[600px] w-full border-collapse table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[10px] font-black uppercase w-[200px]">Metric</TableHead>
              {weeks.map(w => (
                <TableHead key={w.week_start} className="text-[10px] font-black uppercase text-center">
                  {w.week_label?.split(' (')[0] || w.week_start}
                </TableHead>
              ))}
              <TableHead className="text-[10px] font-black uppercase text-center bg-gold/20 font-black">Monthly Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_METRICS.filter(m => m.type !== 'textarea').map(m => {
              // Delivery & Reporting metrics (EOM Report Sent, etc.) are only collected once,
              // on the last week of the month — the form hides them for every other week, so
              // they'd otherwise show as a false "❌" for weeks they were never meant to cover.
              const isMonthlyOnly = m.group === 'Delivery & Reporting'

              return (
                <TableRow key={m.id} className="h-8 hover:bg-muted/5">
                  <TableCell className="py-1 text-[11px] font-medium border-r">{m.name}</TableCell>
                  {weeks.map((week, idx) => {
                    const built = buildWeekMetrics(week)
                    const rawVal = built?.[m.id as keyof typeof built] ?? null
                    const val = isMonthlyOnly && !isLastWeekOfMonth(week.week_start) ? null : rawVal

                    const prevBuilt = idx > 0 ? buildWeekMetrics(weeks[idx-1]) : null
                    const prevVal = prevBuilt?.[m.id as keyof typeof prevBuilt] ?? null

                    let color = 'inherit'
                    if (['L12', 'L14', 'L17'].includes(m.id) && val !== null && prevVal !== null) {
                      color = Number(val) > Number(prevVal) ? '#22C55E' : Number(val) < Number(prevVal) ? '#EF4444' : 'inherit'
                    }

                    return (
                      <TableCell
                        key={week.week_start}
                        className={cn(
                          "py-1 text-center text-[11px] font-bold",
                          (val === 0 || val === '0') && "text-muted-foreground/30"
                        )}
                        style={{ color }}
                      >
                        {['L12', 'L14', 'L17'].includes(m.id) ? formatPct(val as number) : formatDashboardValue(val, m.id)}
                      </TableCell>
                    )
                  })}
                  <TableCell className="py-1 text-center text-[11px] font-black bg-gold/5">
                    {isMonthlyOnly || ['L12', 'L14', 'L17'].includes(m.id) ? '-' : formatDashboardValue(monthlyTotals[m.id], m.id)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  const MonthComparisonView = () => {
    const [displayYear, displayMonth] = displayWeek.slice(0, 7).split('-').map(Number)
    const previousMonthDate = new Date(Date.UTC(displayYear, displayMonth - 2, 1))
    const prevMonthStr = previousMonthDate.toISOString().slice(0, 7)
    const previousMonthEnd = new Date(Date.UTC(
      previousMonthDate.getUTCFullYear(),
      previousMonthDate.getUTCMonth() + 1,
      0,
    )).toISOString().slice(0, 10)

    const aggregateClientRows = (rows: any[]) => {
      const totals: Record<string, Record<string, number>> = {}

      rows.forEach(row => {
        const clientId = row.client_id
        if (!clientId) return

        const built = buildWeekMetrics(row)
        if (!built) return
        if (!totals[clientId]) totals[clientId] = {}

        ALL_METRICS.forEach(metric => {
          if (metric.type === 'textarea' || metric.type === 'boolean' || metric.type === 'auto') return
          const value = built[metric.id]
          if (value !== null && value !== undefined && !isNaN(Number(value))) {
            totals[clientId][metric.id] = (totals[clientId][metric.id] ?? 0) + Number(value)
          }
        })
      })

      Object.values(totals).forEach(total => {
        total.L12 = calcRateCapped(total.L11, total.L10) || 0
        total.L14 = calcRateCapped(total.L13, total.L11) || 0
        total.L17 = calcRateCapped(total.L15, total.L13) || 0
        total.C26 = total.C09 > 0 ? total.C10 / total.C09 : 0
      })

      return totals
    }
    
    const [prevMonthTotals, setPrevMonthTotals] = useState<Record<string, Record<string, number>>>({})
    const [loadingPrev, setLoadingPrev] = useState(true)

    useEffect(() => {
      const fetchPrevMonth = async () => {
        setLoadingPrev(true)
        const { data } = await supabase
          .from('weekly_data')
          .select('client_id, content_metrics, leadgen_metrics, content_submitted_at, leadgen_submitted_at')
          .gte('week_start', `${prevMonthStr}-01`)
          .lte('week_start', previousMonthEnd)

        setPrevMonthTotals(aggregateClientRows(data || []))
        setLoadingPrev(false)
      }
      fetchPrevMonth()
    }, [prevMonthStr, previousMonthEnd])

    const currentMonthTotals = aggregateClientRows(monthWeeklyData)

    return (
      <div className="space-y-6 w-full box-border">
        {clients.map(client => {
          const cTotals = currentMonthTotals[client.id] || {}
          const pTotals = prevMonthTotals[client.id] || {}

          return (
            <Card key={client.id} className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/10 py-3 border-b">
                <CardTitle className="text-sm font-black uppercase tracking-widest">{client.name} - Monthly Comparison</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase">Metric</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">Previous Month</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center bg-gold/5">Current Month</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALL_METRICS.filter(m => m.type !== 'textarea' && m.type !== 'boolean').map(m => (
                      <TableRow key={m.id} className="h-8">
                        <TableCell className="py-1 text-[11px] font-medium">{m.name}</TableCell>
                        <TableCell className="py-1 text-center text-[11px] text-muted-foreground">
                          {['L12', 'L14', 'L17'].includes(m.id) ? formatPct(pTotals[m.id]) : gFmt(pTotals[m.id])}
                        </TableCell>
                        <TableCell className="py-1 text-center text-[11px] font-black bg-gold/5">
                          {['L12', 'L14', 'L17'].includes(m.id) ? formatPct(cTotals[m.id]) : gFmt(cTotals[m.id])}
                        </TableCell>
                        <TableCell className="py-1 text-center text-[11px] font-bold">
                          {['L12', 'L14', 'L17'].includes(m.id) ? (
                            <span style={{ color: fmtPctDelta(cTotals[m.id], 100, pTotals[m.id], 100).color }}>
                              {fmtPctDelta(cTotals[m.id], 100, pTotals[m.id], 100).text}
                            </span>
                          ) : (
                            <Delta current={cTotals[m.id]} previous={pTotals[m.id]} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  // Aggregate rows for monthly view: sum all numeric metric values across weeks
  const aggregateChannelRows = (rows: any[], channel: string) => {
    const out: Record<string, number> = {}
    for (const row of rows) {
      const ch = row[channel]
      if (!ch) continue
      for (const [k, v] of Object.entries(ch)) {
        const n = typeof v === 'object' && v !== null && 'value' in (v as any)
          ? Number((v as any).value)
          : Number(v)
        if (!isNaN(n)) out[k] = (out[k] ?? 0) + n
      }
    }
    return out
  }

  const aggregateSalesSection = (rows: any[], section: string) => {
    const out: Record<string, number> = {}
    for (const row of rows) {
      const sec = row[section]
      if (!sec) continue
      for (const [k, v] of Object.entries(sec)) {
        const n = typeof v === 'object' && v !== null && 'value' in (v as any)
          ? Number((v as any).value)
          : Number(v)
        if (!isNaN(n)) out[k] = (out[k] ?? 0) + n
      }
    }
    return out
  }

  const monthTjAgg = {
    instagram: aggregateChannelRows(monthTjRows, 'instagram'),
    youtube: aggregateChannelRows(monthTjRows, 'youtube'),
    newsletter: aggregateChannelRows(monthTjRows, 'email_newsletter'),
    video_pipeline: aggregateChannelRows(monthTjRows, 'video_pipeline'),
  }

  const monthSalesAgg = {
    tj_outreach: aggregateSalesSection(monthSalesRows, 'tj_outreach'),
    jahnvi_outreach: aggregateSalesSection(monthSalesRows, 'jahnvi_outreach'),
    shirin_outreach: aggregateSalesSection(monthSalesRows, 'shirin_outreach'),
    cold_email: aggregateSalesSection(monthSalesRows, 'cold_email'),
    meeting_tracker: aggregateSalesSection(monthSalesRows, 'meeting_tracker'),
  }

  const monthMmAgg = {
    linkedin: aggregateChannelRows(monthMmRows, 'linkedin'),
    instagram: aggregateChannelRows(monthMmRows, 'instagram'),
    website: aggregateChannelRows(monthMmRows, 'website'),
    quora: aggregateChannelRows(monthMmRows, 'quora'),
    reddit: aggregateChannelRows(monthMmRows, 'reddit'),
    ads: aggregateChannelRows(monthMmRows, 'ads'),
  }

  const withLinkedInImpressionTotals = (data: any) => {
    if (!data) return data
    const inNetwork = tjVal(data, 'MML10')
    const outOfNetwork = tjVal(data, 'MML11')
    const hasSplit = inNetwork !== null || outOfNetwork !== null
    const total = hasSplit ? (inNetwork ?? 0) + (outOfNetwork ?? 0) : tjVal(data, 'MML02')
    const posts = tjVal(data, 'MML01')
    const average = posts && posts > 0 && total !== null ? Math.round((total / posts) * 100) / 100 : null
    return { ...data, MML02: total, MML12: average }
  }

  const TJChannelCard = ({ title, icon: Icon, metrics, currentData, prevData }: { title: string, icon: any, metrics: any[], currentData: any, prevData: any }) => {
    const isExpanded = expandedTJCards.has(title)
    const toggle = () => {
      const next = new Set(expandedTJCards)
      next.has(title) ? next.delete(title) : next.add(title)
      setExpandedTJCards(next)
    }

    return (
      <Card className="border shadow-sm bg-card h-full">
        <CardHeader
          className="py-3 border-b bg-muted/20 flex-row items-center justify-between cursor-pointer select-none"
          onClick={toggle}
        >
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
            <Icon className="w-4 h-4 text-gold" /> {title}
          </CardTitle>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          <div className="grid grid-cols-1 gap-1">
            {metrics.map((m: any) => {
              const current = tjVal(currentData, m.id)
              const prev = tjVal(prevData, m.id)
              const high = tjLifetimeHighs[m.id]
              return (
                <div key={m.id} className={cn("py-0.5", isExpanded && "border-b border-border/30 last:border-0 pb-1.5")}>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{gFmt(current, { unit: m.unit })}</span>
                      <Delta current={current} previous={prev} unit={m.unit} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="flex justify-between items-center text-[10px] mt-0.5">
                      <span className="flex items-center gap-1 text-gold font-bold">
                        <Trophy className="w-2.5 h-2.5" /> Lifetime High
                      </span>
                      {high ? (
                        <span className="font-bold text-gold">
                          {gFmt(high.value, { unit: m.unit })}
                          <span className="opacity-60 font-normal ml-1">· {formatWeekDate(high.week)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">No data yet</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  const SalesOutreachCard = ({ title, metrics, currentData }: { title: string, metrics: any[], currentData: any }) => (
    <div className="space-y-3 p-4 bg-muted/10 rounded-lg border border-border/50 flex-1 min-w-[300px]">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
            {metrics.map((m: any) => (
                <div key={m.id} className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{m.name}:</span>
                    <span className="text-sm font-black">{gFmt(tjVal(currentData, m.id), { unit: m.unit })}</span>
                </div>
            ))}
        </div>
    </div>
  )

  const MMContentRow = ({ title, icon: Icon, metrics, currentData, prevData }: { title: string, icon: any, metrics: any[], currentData: any, prevData: any }) => {
    const isExpanded = expandedMMRows.has(title)
    const toggle = () => {
      const next = new Set(expandedMMRows)
      next.has(title) ? next.delete(title) : next.add(title)
      setExpandedMMRows(next)
    }

    return (
      <div className="space-y-3 p-4">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer select-none"
        >
          <span className="flex items-center gap-2">
            <Icon className="w-3 h-3" /> {title}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
            {metrics.map((m: any) => {
                const val = tjVal(currentData, m.id)
                const prev = tjVal(prevData, m.id)
                const high = mmLifetimeHighs[m.id]
                return (
                    <div key={m.id} className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">{m.name}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-black">{gFmt(val, { unit: m.unit })}</p>
                            <Delta current={val} previous={prev} unit={m.unit} invertColor={m.invertColor} />
                        </div>
                        {isExpanded && (
                            <div className="flex items-center gap-1 text-[10px] text-gold font-bold pt-1 border-t border-border/30">
                                <Trophy className="w-2.5 h-2.5" />
                                {high ? (
                                    <span>
                                        {gFmt(high.value, { unit: m.unit })}
                                        <span className="opacity-60 font-normal ml-1">· {formatWeekDate(high.week)}</span>
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground italic font-normal">No data yet</span>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
      </div>
    )
  }

  const { selectedWeek: displayWeek } = useWorkspace()
  
  const loadAllDashboardData = async (weekStart: string) => {
    setLoading(true)
    try {
      const prevDate = new Date(weekStart)
      prevDate.setDate(prevDate.getDate() - 7)
      const prevWeekStart = prevDate.toISOString().split('T')[0]

      const [
        { data: clientsData },
        { data: healthData },
        { data: alertsData },
        { data: weeklyDataRes },
        { data: prevWeeklyDataRes },
        { data: tjDataRes },
        { data: tjPrevRes },
        { data: salesDataRes },
        { data: salesPrevRes },
        { data: mmDataRes },
        { data: prevMmDataRes },
        { data: profilesData },
        { data: actionablesData },
        { data: targetsData },
        { data: monthlyTargetsData },
        { data: highScoresData },
        { data: monthWeeksRes },
        { data: pData },
        { data: pUpdates },
        { data: monthTjRes },
        { data: monthSalesRes },
        { data: monthMmRes },
        { data: clientSettingsRes },
      ] = await Promise.all([
        supabase.from('clients').select('*, content_manager:profiles!content_manager_id(full_name), leadgen_manager:profiles!leadgen_manager_id(full_name)').eq('status', 'active').order('name'),
        supabase.from('client_health_scores').select('*').order('week_start', { ascending: false }),
        supabase.from('client_alerts').select('*, clients(name, company)').eq('is_resolved', false).order('created_at', { ascending: false }),
        supabase.from('weekly_data').select('*').eq('week_start', weekStart),
        supabase.from('weekly_data').select('*').eq('week_start', prevWeekStart),
        supabase.from('tj_weekly_data').select('*').eq('week_start', weekStart).maybeSingle(),
        supabase.from('tj_weekly_data').select('*').eq('week_start', prevWeekStart).maybeSingle(),
        supabase.from('sales_weekly_data').select('*').eq('week_start', weekStart).maybeSingle(),
        supabase.from('sales_weekly_data').select('*').eq('week_start', prevWeekStart).maybeSingle(),
        supabase.from('mm_weekly_data').select('*').eq('week_start', weekStart).maybeSingle(),
        supabase.from('mm_weekly_data').select('*').eq('week_start', prevWeekStart).maybeSingle(),
        supabase.from('profiles').select('*'),
        supabase.from('actionables').select('*').in('status', ['todo', 'open', 'in_progress', 'carried_forward']),
        supabase.from('targets').select('*').eq('period', weekStart).eq('target_type', 'weekly'),
        supabase.from('targets').select('*').eq('period', weekStart.slice(0, 7)).eq('target_type', 'monthly'),
        supabase.from('high_scores').select('*'),
        supabase.from('weekly_data').select('week_start, week_label, content_metrics, leadgen_metrics, client_id, content_submitted_at, leadgen_submitted_at')
          .gte('week_start', weekStart.slice(0, 7) + '-01')
          .lte('week_start', (() => { const [y, m] = weekStart.slice(0, 7).split('-').map(Number); return new Date(y, m, 0).toISOString().split('T')[0] })())
          .order('week_start', { ascending: true }),
        supabase.from('myntmore_processes').select('*').eq('status', 'active').order('priority', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('process_weekly_updates').select('*, profiles(full_name)').eq('week_start', weekStart),
        supabase.from('tj_weekly_data').select('*').gte('week_start', weekStart.slice(0, 7) + '-01').lte('week_start', weekStart.slice(0, 7) + '-31'),
        supabase.from('sales_weekly_data').select('*').gte('week_start', weekStart.slice(0, 7) + '-01').lte('week_start', weekStart.slice(0, 7) + '-31'),
        supabase.from('mm_weekly_data').select('*').gte('week_start', weekStart.slice(0, 7) + '-01').lte('week_start', weekStart.slice(0, 7) + '-31'),
        supabase.from('client_settings').select('client_id, active_content_metrics, active_leadgen_metrics, content_enabled, leadgen_enabled'),
      ])

      setClients(sortAlphabetically(clientsData || [], client => client.name))
      setHealthScores(healthData || [])
      setAlerts(alertsData || [])
      setWeeklyData(weeklyDataRes || [])
      setPrevWeeklyData(prevWeeklyDataRes || [])
      setMonthWeeklyData(monthWeeksRes || [])
      setTjData(tjDataRes)
      setTjPrev(tjPrevRes)
      setSalesData(salesDataRes)
      setSalesPrev(salesPrevRes)
      setMmData(mmDataRes)
      setPrevMmData(prevMmDataRes)
      setProfiles(sortAlphabetically(profilesData || [], profile => profile.full_name))
      setActionables(actionablesData || [])
      setTargets(targetsData || [])
      setMonthlyTargets(monthlyTargetsData || [])
      setHighScores(highScoresData || [])
      setProcessesData(pData || [])
      setProcessesUpdates(pUpdates || [])
      setMonthTjRows(monthTjRes || [])
      setMonthSalesRows(monthSalesRes || [])
      setMonthMmRows(monthMmRes || [])
      setClientSettings(Object.fromEntries(
        (clientSettingsRes || [])
          .filter(row => row.client_id)
          .map(row => [row.client_id as string, row])
      ))

      // Backfill high scores for all clients - scans full history and self-heals stale/missing records
      Promise.all(
        (clientsData || []).map((c: any) => backfillHighScores(c.id))
      ).then(async () => {
        // Re-fetch high scores after backfill so UI reflects corrected values
        const { data: refreshed } = await supabase.from('high_scores').select('*')
        if (refreshed) setHighScores(refreshed)
      })

      // Check and fetch notifications
      await checkNotifications()

    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) fetchTJLifetimeHighs().then(setTjLifetimeHighs)
  }, [session])

  useEffect(() => {
    if (session) fetchMMLifetimeHighs().then(setMmLifetimeHighs)
  }, [session])

  useEffect(() => {
    if (session && displayWeek) {
      loadAllDashboardData(displayWeek)
    }
  }, [session, displayWeek])

  // --- Deliverable gap alerts - must be declared BEFORE early returns (Rules of Hooks) ---
  const deliverableAlerts = useMemo(() => {
    if (!clients.length || !displayWeek) return []

    const targetMap: Record<string, Record<string, number>> = {}
    for (const t of targets) {
      if (!t.client_id || t.target_value === null) continue
      if (!targetMap[t.client_id]) targetMap[t.client_id] = {}
      targetMap[t.client_id][t.metric_id] = t.target_value
    }

    const results: Array<{
      clientId: string
      clientName: string
      notSubmitted: boolean
      lacking: Array<{ metricId: string; metricName: string; actual: number | null; target: number; pct: number | null }>
      worstPct: number | null
    }> = []

    for (const client of clients) {
      const clientTargets = targetMap[client.id]
      if (!clientTargets || Object.keys(clientTargets).length === 0) continue
      const relevantTargetIds = Object.keys(clientTargets).filter(metricId => {
        const metric = ALL_METRICS.find(candidate => candidate.id === metricId)
        return metric && activeMetricsFor(client.id, metric.category).some(active => active.id === metricId)
      })
      if (relevantTargetIds.length === 0) continue

      const weekRow = weeklyData.find(w => w.client_id === client.id) ?? null

      if (!weekRow) {
        results.push({ clientId: client.id, clientName: client.name, notSubmitted: true, lacking: [], worstPct: null })
        continue
      }

      const built = (buildWeekMetrics(weekRow) ?? {}) as Record<string, number | null>
      const lacking: typeof results[0]['lacking'] = []

      for (const metricId of relevantTargetIds) {
        const targetValue = clientTargets[metricId]
        const metric = ALL_METRICS.find(m => m.id === metricId)
        if (!metric) continue
        if (!activeMetricsFor(client.id, metric.category).some(active => active.id === metricId)) continue
        if (metric.type === 'textarea' || metric.type === 'boolean' || metric.type === 'slider') continue

        let actual: number | null = null
        if (metricId in built) {
          actual = built[metricId]
        } else {
          const col = metric.category === 'content' ? 'content_metrics' : 'leadgen_metrics'
          actual = mv(weekRow, col, metricId)
        }

        if (actual === null || actual < targetValue) {
          const pct = actual !== null && targetValue > 0 ? Math.round((actual / targetValue) * 100) : null
          lacking.push({ metricId, metricName: metric.name, actual, target: targetValue, pct })
        }
      }

      if (lacking.length > 0) {
        lacking.sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))
        results.push({ clientId: client.id, clientName: client.name, notSubmitted: false, lacking, worstPct: lacking[0].pct })
      }
    }

    return results.sort((a, b) => {
      if (a.notSubmitted !== b.notSubmitted) return a.notSubmitted ? -1 : 1
      return (a.worstPct ?? -1) - (b.worstPct ?? -1)
    })
  }, [clients, weeklyData, targets, displayWeek, clientSettings])

  const handleResolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('client_alerts')
        .update({ is_resolved: true, resolved_by: session?.user.id, resolved_at: new Date().toISOString() })
        .eq('id', alertId)
      if (error) throw error
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      toast.success("Alert resolved")
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  // Section 5: Team Submission Status logic
  const teamSubmissionStatus = profiles.map(p => {
    const assignedClients = clients.filter(c =>
      (c.content_manager_id === p.id && isServiceEnabled(c.id, 'content')) ||
      (c.leadgen_manager_id === p.id && isServiceEnabled(c.id, 'leadgen'))
    )
    
    // Check if data is submitted for each assigned client
    const submittedClients = assignedClients.filter(c => {
        const data = weeklyData.find(w => w.client_id === c.id)
        const contentNeeded = c.content_manager_id === p.id && isServiceEnabled(c.id, 'content')
        const leadgenNeeded = c.leadgen_manager_id === p.id && isServiceEnabled(c.id, 'leadgen')
        
        const contentDone = !contentNeeded || !!data?.content_submitted_at
        const leadgenDone = !leadgenNeeded || !!data?.leadgen_submitted_at
        
        return contentDone && leadgenDone
    })

    const status = assignedClients.length === 0 ? 'none' :
                 submittedClients.length === assignedClients.length ? 'all' :
                 submittedClients.length === 0 ? 'none' : 'partial'
                 
    return {
        name: p.full_name?.split(' ')[0] || 'Team',
        clients: assignedClients.map(c => c.name).join(', '),
        submittedCount: submittedClients.length,
        totalCount: assignedClients.length,
        status
    }
  }).filter(p => p.totalCount > 0)

  // Section 6: Actionables logic
  const actionablesByClient = clients.map(c => {
    const clientActions = actionables.filter(a => a.client_id === c.id)
    return {
        id: c.id,
        name: c.name,
        count: clientActions.length,
        carriedForward: clientActions.filter(a => a.week_start && a.week_start < displayWeek).length
    }
  }).filter(c => c.count > 0)

  const submittedClientCount = clients.filter(client => {
    const row = weeklyData.find(week => week.client_id === client.id)
    const contentReady = !isServiceEnabled(client.id, 'content') || !!row?.content_submitted_at
    const leadgenReady = !isServiceEnabled(client.id, 'leadgen') || !!row?.leadgen_submitted_at
    return contentReady && leadgenReady
  }).length
  const completionPct = clients.length ? Math.round((submittedClientCount / clients.length) * 100) : 0
  const overdueActionables = actionables.filter(item => item.due_date && item.due_date < new Date().toISOString().slice(0, 10)).length

  return (
    <div className="flex flex-1 flex-col">
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1200px] w-full box-border p-6 space-y-8 pb-20">
              
              {/* Header */}
              <div className="flex justify-between items-end border-b pb-6">
                <div>
                  <h1 className="text-4xl font-black tracking-tight">MYNTMORE COMMAND CENTER</h1>
                  <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs mt-1">Operational Performance Dashboard - {getWeekLabel(displayWeek)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {notifications.length > 0 && (
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="relative font-bold border-gold/30 h-9 bg-gold/5 hover:bg-gold/10">
                          <Bell className="w-4 h-4 mr-2 text-gold animate-pulse" />
                          Milestones
                          <Badge className="absolute -top-2 -right-2 bg-red-500 text-white border-white h-5 min-w-5 flex items-center justify-center p-0 text-[10px] font-black">
                            {notifications.length}
                          </Badge>
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="w-[400px]">
                        <SheetHeader className="border-b pb-4 mb-6">
                          <SheetTitle className="flex items-center gap-2 uppercase tracking-widest text-sm font-black">
                            <Gift className="w-5 h-5 text-gold" /> Upcoming Milestones
                          </SheetTitle>
                        </SheetHeader>
                        <div className="space-y-4">
                          {notifications.map(notif => {
                            const getBorderColor = (severity: string) => {
                              if (severity === 'high') return '#EF4444'   // red - within 3 days
                              if (severity === 'medium') return '#EAB308' // amber - within 7 days
                              return '#FFC947'                             // gold - within 21 days
                            }
                            return (
                            <div key={notif.id} className="p-4 rounded-xl border bg-card hover:border-gold/30 transition-all group relative">
                              <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                                  {notif.type === 'birthday' ? <Cake className="w-5 h-5 text-gold" /> : <Target className="w-5 h-5 text-gold" />}
                                </div>
                                <div className="space-y-1 pr-8">
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: getBorderColor(notif.severity) }}>
                                    {notif.daysUntil === 0 ? 'TODAY' : `In ${notif.daysUntil} days`}
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#333' }}>{notif.message}</div>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDismissNotification(notif.id)}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                            </div>
                          )})}
                          {notifications.length === 0 && (
                            <div className="text-center py-20 opacity-40">
                              <Bell className="w-12 h-12 mx-auto mb-4" />
                              <p className="font-bold uppercase tracking-widest text-xs">No upcoming milestones</p>
                            </div>
                          )}
                        </div>
                      </SheetContent>
                    </Sheet>
                  )}

                  <div className="flex gap-2">
                      <Button 
                        variant={isMonthlyView ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setIsMonthlyView(!isMonthlyView)}
                        className="font-bold border-gold/30 h-9"
                      >
                        {isMonthlyView ? "Weekly View" : "Monthly View"}
                      </Button>
                      <Button asChild size="sm" className="bg-gold text-black hover:bg-gold/90 font-black h-9">
                          <Link to="/data-entry">Quick Data Entry</Link>
                      </Button>
                  </div>
                </div>
              </div>

              <section aria-labelledby="week-overview-title" className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">At a glance</p>
                    <h2 id="week-overview-title" className="text-xl font-black">This week needs your attention</h2>
                  </div>
                  <Button asChild variant="outline" size="sm"><Link to="/data-entry">Complete missing data <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Submissions complete</p><div className="mt-2 flex items-end justify-between"><p className="text-3xl font-black">{submittedClientCount}<span className="text-sm text-muted-foreground">/{clients.length}</span></p><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{completionPct}%</Badge></div></CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-amber-400">
                    <CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Below target / missing</p><p className="mt-2 text-3xl font-black">{deliverableAlerts.length}</p><p className="text-xs text-muted-foreground">client workspaces need review</p></CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Overdue actionables</p><p className="mt-2 text-3xl font-black">{overdueActionables}</p><Link to="/actionables" className="text-xs font-semibold text-red-600 hover:underline">Review tasks →</Link></CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Open actionables</p><p className="mt-2 text-3xl font-black">{actionables.length}</p><p className="text-xs text-muted-foreground">across {actionablesByClient.length} clients</p></CardContent>
                  </Card>
                </div>
              </section>

              {/* Section 2 - Active Alerts Panel */}
              {alerts.length > 0 && (
                <Card className="border-2 border-red-100 shadow-sm overflow-hidden bg-red-50/20">
                    <CardHeader
                      className="bg-red-50 py-2 border-b border-red-100 flex-row items-center justify-between cursor-pointer select-none"
                      onClick={() => {
                        const next = new Set(collapsedSections)
                        next.has('alerts') ? next.delete('alerts') : next.add('alerts')
                        setCollapsedSections(next)
                      }}
                    >
                        <CardTitle className="text-[10px] font-black text-red-900 flex items-center gap-2 uppercase tracking-widest">
                            <AlertCircle className="w-3 h-3" /> ACTIVE ALERTS ({alerts.length})
                        </CardTitle>
                        {collapsedSections.has('alerts')
                          ? <ChevronDown className="w-4 h-4 text-red-700" />
                          : <ChevronUp className="w-4 h-4 text-red-700" />
                        }
                    </CardHeader>
                    {!collapsedSections.has('alerts') && (
                      <CardContent className="p-0 divide-y divide-red-50">
                          {alerts.map(alert => (
                              <div key={alert.id} className="flex items-center justify-between p-3 hover:bg-red-50/50 transition-colors">
                                  <div className="flex items-center gap-3">
                                      <div className={cn(
                                          "w-2 h-2 rounded-full shrink-0",
                                          alert.severity === 'high' ? "bg-red-500 animate-pulse" : "bg-amber-500"
                                      )} />
                                      <p className="text-xs font-bold text-red-950">
                                          <span className="opacity-60 mr-2">{alert.clients?.name} -</span>
                                          {alert.alert_message}
                                      </p>
                                  </div>
                                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleResolveAlert(alert.id) }} className="h-7 text-[10px] text-red-900 font-bold hover:bg-red-100 px-2">Resolve ✓</Button>
                              </div>
                          ))}
                      </CardContent>
                    )}
                </Card>
              )}

              {/* Section 3 - Deliverables Check */}
              {deliverableAlerts.length > 0 && (
                <Card className="border-2 border-amber-100 shadow-sm overflow-hidden bg-amber-50/20">
                  <CardHeader className="bg-amber-50 py-2 border-b border-amber-100 flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-black text-amber-900 flex items-center gap-2 uppercase tracking-widest">
                      <AlertTriangle className="w-3 h-3" /> DELIVERABLES CHECK ({deliverableAlerts.length} client{deliverableAlerts.length > 1 ? 's' : ''} need attention)
                    </CardTitle>
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">vs weekly targets · {displayWeek}</span>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-amber-50">
                    {deliverableAlerts.map(item => (
                      <DeliverableAlertRow
                        key={item.clientId}
                        item={item}
                        displayWeek={displayWeek}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* SECTION: CLIENT PERFORMANCE */}
              <div className="space-y-4">
                <SectionHeader title="Client Performance" id="clients" icon={Activity} />
                {!collapsedSections.has('clients') && (
                  isMonthlyView ? <MonthComparisonView /> : (
                  <div className="space-y-4">
                    {clients.map(client => {
                      const currentData = weeklyData.find(w => w.client_id === client.id)
                      const prevData = prevWeeklyData.find(w => w.client_id === client.id)
                      const health = healthScores.find(h => h.client_id === client.id && h.week_start === displayWeek)
                      const score = health?.health_score ?? '-'
                      const isExpanded = expandedClients.has(client.id)
                      const clientTargets = targets.filter(t => t.client_id === client.id)
                      const clientMonthlyTargets = monthlyTargets.filter(t => t.client_id === client.id)
                      // MTD = sum of all weeks in the month up to and including displayWeek
                      const clientMtdRows = monthWeeklyData.filter(w => w.client_id === client.id && w.week_start <= displayWeek)
                      const clientMtdTotals: Record<string, number> = {}
                      for (const row of clientMtdRows) {
                        const cm = (row.content_metrics as Record<string, any>) ?? {}
                        const lm = (row.leadgen_metrics as Record<string, any>) ?? {}
                        ALL_METRICS.forEach(m => {
                          if (m.type === 'textarea' || m.type === 'boolean' || m.type === 'slider' || m.type === 'auto') return
                          const col = m.category === 'content' ? cm : lm
                          const v = readNum(col, m.id)
                          if (v !== null) {
                            clientMtdTotals[m.id] = (clientMtdTotals[m.id] ?? 0) + v
                          }
                        })
                      }

                      return (
                        <Card key={client.id} className={cn("border shadow-sm overflow-hidden transition-all", isExpanded ? "ring-2 ring-gold/20" : "")}>
                          {/* Collapsed Row */}
                          <div 
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors flex-nowrap min-w-0 gap-4"
                            onClick={() => toggleClient(client.id)}
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
                              <div className="w-10 h-10 shrink-0 rounded bg-gold/10 flex items-center justify-center font-black text-gold">
                                {client.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <h3 className="font-black text-base truncate">{client.name}</h3>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">{client.company}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[10px] font-black uppercase tracking-wider h-7 px-2 border border-gold/20 hover:bg-gold/10 shrink-0 whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleWeeklyBreakdown(client.id)
                                  if (!isExpanded) toggleClient(client.id)
                                }}
                              >
                                {weeklyBreakdownClients.has(client.id) ? '▲ Close Breakdown' : '▼ Weekly Breakdown'}
                              </Button>
                              <div className="flex items-center gap-6 shrink-0">
                                {(() => {
                                  const built = (buildWeekMetrics(currentData) ?? {}) as Record<string, any>
                                  const acceptanceRate = built.L12
                                  return (
                                    <>
                                      <div className="text-center w-12 shrink-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Health</p>
                                        <Badge className={cn(
                                            "font-black text-[10px] min-w-[32px] justify-center",
                                            score === '-' ? "bg-muted text-muted-foreground" : Number(score) >= 75 ? "bg-status-on text-white" : Number(score) >= 50 ? "bg-status-risk text-white" : "bg-status-off text-white"
                                        )}>{score}</Badge>
                                      </div>
                                      {isServiceEnabled(client.id, 'content') && <div className="text-center w-12 shrink-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Posts</p>
                                        <p className="text-sm font-black">{formatDashboardValue(built?.C09, 'C09')}</p>
                                      </div>}
                                      {isServiceEnabled(client.id, 'content') && <div className="text-center w-14 shrink-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Impr.</p>
                                        <p className="text-sm font-black">{formatDashboardValue(built?.C10, 'C10')}</p>
                                      </div>}
                                      {isServiceEnabled(client.id, 'content') && <div className="text-center w-14 shrink-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Avg/Post</p>
                                        <p className="text-sm font-black">{formatDashboardValue(built?.C26, 'C26')}</p>
                                      </div>}
                                      {isServiceEnabled(client.id, 'leadgen') && <div className="text-center w-14 shrink-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Conn Req</p>
                                        <p className="text-sm font-black">{formatDashboardValue(built?.L10, 'L10')}</p>
                                      </div>}
                                      {isServiceEnabled(client.id, 'leadgen') && <div className="text-center w-14 shrink-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Acc Rate</p>
                                        <p className={cn("text-sm font-black", acceptanceRate !== null && acceptanceRate !== undefined ? "text-foreground" : "text-muted-foreground")}>{acceptanceRate !== null && acceptanceRate !== undefined ? formatPct(acceptanceRate as number) : '-'}</p>
                                      </div>}
                                      {isServiceEnabled(client.id, 'leadgen') && <div className="text-center w-14 shrink-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Hot Leads</p>
                                        <p className="text-sm font-black">{formatDashboardValue(built?.L22 ?? mv(currentData, 'leadgen_metrics', 'L23'), 'L22')}</p>
                                      </div>}
                                      {isServiceEnabled(client.id, 'leadgen') && <div className="text-center w-12 shrink-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Booked</p>
                                        <p className="text-sm font-black text-gold">{formatDashboardValue(built?.L24, 'L24')}</p>
                                      </div>}
                                    </>
                                  )
                                })()}
                                 <div className="text-center w-14 shrink-0">
                                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Status</p>
                                  <div className="flex justify-center gap-1 mt-1">
                                      {isServiceEnabled(client.id, 'content') && <div className={cn("w-2 h-2 rounded-full", !!currentData?.content_submitted_at ? "bg-status-on" : "bg-muted")} title="Content Data" />}
                                      {isServiceEnabled(client.id, 'leadgen') && <div className={cn("w-2 h-2 rounded-full", !!currentData?.leadgen_submitted_at ? "bg-status-on" : "bg-muted")} title="Lead Gen Data" />}
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="border-t bg-muted/10 p-6 animate-in slide-in-from-top-2 duration-200">
                                  <>
                                    {weeklyBreakdownClients.has(client.id) && (
                                  <div className="mb-8 border-b pb-8">
                                    <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <Activity className="w-4 h-4 text-gold" /> Weekly Breakdown (Month)
                                    </h4>
                                    <WeeklyBreakdown client={client} weeks={monthWeeklyData.filter(w => w.client_id === client.id)} />
                                  </div>
                                )}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                  {/* Content Metrics */}
                                  {isServiceEnabled(client.id, 'content') && <div className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-muted sticky top-0 bg-background z-20">
                                      <FileText className="w-4 h-4 text-gold" />
                                      <h4 className="text-xs font-black uppercase tracking-widest">Content Metrics</h4>
                                    </div>
                                    <MetricTable
                                      metrics={activeMetricsFor(client.id, 'content').filter(m => m.group !== 'Qualitative')}
                                      currentData={currentData}
                                      prevData={prevData}
                                      category="content_metrics"
                                      clientTargets={clientTargets}
                                      clientMonthlyTargets={clientMonthlyTargets}
                                      clientMtdTotals={clientMtdTotals}
                                      clientHighScores={highScores.filter(h => h.client_id === client.id)}
                                    />
                                  </div>}

                                  {/* Lead Gen Metrics */}
                                  {isServiceEnabled(client.id, 'leadgen') && <div className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-muted sticky top-0 bg-background z-20">
                                      <Users className="w-4 h-4 text-gold" />
                                      <h4 className="text-xs font-black uppercase tracking-widest">Lead Gen Metrics</h4>
                                    </div>
                                    <MetricTable
                                      metrics={activeMetricsFor(client.id, 'leadgen').filter(m => m.group !== 'Qualitative')}
                                      currentData={currentData}
                                      prevData={prevData}
                                      category="leadgen_metrics"
                                      clientTargets={clientTargets}
                                      clientMonthlyTargets={clientMonthlyTargets}
                                      clientMtdTotals={clientMtdTotals}
                                      clientHighScores={highScores.filter(h => h.client_id === client.id)}
                                    />
                                  </div>}
                                </div>
                                
                                {isServiceEnabled(client.id, 'leadgen') && (
                                  <DashboardCampaignsSection clientId={client.id} displayWeek={displayWeek} onEditCampaign={setEditingCampaign} />
                                )}

                                {/* Qualitative Cards */}
                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                    { label: "What's Working (Content)", icon: <CheckCircle2 className="w-3 h-3 text-status-on" />, value: sv(currentData, 'content_metrics', 'C24') },
                                    { label: "What's Not Working (Content)", icon: <AlertTriangle className="w-3 h-3 text-status-risk" />, value: sv(currentData, 'content_metrics', 'C25') },
                                    { label: "What's Working (Lead Gen)", icon: <CheckCircle2 className="w-3 h-3 text-status-on" />, value: sv(currentData, 'leadgen_metrics', 'L28') },
                                    { label: "What's Not Working / Blockers", icon: <AlertTriangle className="w-3 h-3 text-status-risk" />, value: sv(currentData, 'leadgen_metrics', 'L29') },
                                  ].filter(item => item.label.includes('Content')
                                    ? isServiceEnabled(client.id, 'content')
                                    : isServiceEnabled(client.id, 'leadgen')
                                  ).map(({ label, icon, value }) => {
                                    const noteId = `${client.id}-${label}`
                                    const isOpen = expandedClients.has(noteId)
                                    return (
                                      <div key={label} className="p-4 bg-background border rounded-lg shadow-sm">
                                        <button
                                          className="text-[10px] font-black uppercase text-muted-foreground mb-1 flex items-center gap-1.5 w-full text-left hover:text-foreground transition-colors"
                                          onClick={() => {
                                            const next = new Set(expandedClients)
                                            if (isOpen) next.delete(noteId)
                                            else next.add(noteId)
                                            setExpandedClients(next)
                                          }}
                                        >
                                          {icon} {label}
                                          {isOpen ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                                        </button>
                                        {isOpen && (
                                          <p className="text-sm font-medium leading-relaxed italic text-foreground/80 mt-2">
                                            {value || 'No input provided.'}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {isServiceEnabled(client.id, 'leadgen') && <div className="p-4 bg-background border rounded-lg shadow-sm">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                                      <Target className="w-3 h-3 text-gold" /> Happiness Index & Notes
                                    </p>
                                    <div className="flex items-center gap-4">
                                      <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center font-black text-lg",
                                        !mv(currentData, 'leadgen_metrics', 'L30') ? "bg-muted text-muted-foreground" :
                                        (mv(currentData, 'leadgen_metrics', 'L30') || 0) >= 7 ? "bg-status-on/10 text-status-on" :
                                        (mv(currentData, 'leadgen_metrics', 'L30') || 0) >= 4 ? "bg-status-risk/10 text-status-risk" :
                                        "bg-status-off/10 text-status-off"
                                      )}>
                                        {mv(currentData, 'leadgen_metrics', 'L30') ?? '-'}/10
                                      </div>
                                      <p className="text-[11px] font-bold text-muted-foreground leading-tight">
                                        Overall client sentiment for this week.
                                      </p>
                                    </div>
                                  </div>}
                                  </div>

                                  {/* Aha Moments */}
                                  <AhaMomentsAdmin clientId={client.id} />

                                  {/* Weekly Summary Footer */}
                                  {(() => {
                                    const weekBuilt = buildWeekMetrics(currentData) as Record<string, any> | null
                                    const totalPosts = weekBuilt?.C09 ?? null
                                    const totalImpressions = weekBuilt?.C10 ?? null
                                    const averageImpressions = weekBuilt?.C26 ?? null
                                    const inNetworkShare = weekBuilt?.C36 ?? null
                                    const outNetworkShare = weekBuilt?.C37 ?? null
                                    const totalConnReq = weekBuilt?.L10 ?? null
                                    const onTrack = score === '-' ? null : Number(score) >= 75 ? 'on' : Number(score) >= 50 ? 'risk' : 'off'
                                    return (
                                      <div className="mt-8 flex items-center justify-between gap-4 rounded-lg border bg-muted/20 px-5 py-3">
                                        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                                          {isServiceEnabled(client.id, 'content') && <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-0.5">Total Posts This Week</p>
                                            <p className="text-lg font-black">{formatDashboardValue(totalPosts, 'C09')}</p>
                                          </div>}
                                          {isServiceEnabled(client.id, 'content') && <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-0.5">Total Impressions</p>
                                            <p className="text-lg font-black">{formatDashboardValue(totalImpressions, 'C10')}</p>
                                          </div>}
                                          {isServiceEnabled(client.id, 'content') && <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-0.5">Average Per Post</p>
                                            <p className="text-lg font-black">{formatDashboardValue(averageImpressions, 'C26')}</p>
                                          </div>}
                                          {isServiceEnabled(client.id, 'content') && inNetworkShare !== null && <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-0.5">In-Network</p>
                                            <p className="text-lg font-black">{formatPct(inNetworkShare)} <span className="text-xs font-semibold text-muted-foreground">({totalImpressions !== null ? Math.round(totalImpressions * inNetworkShare / 100).toLocaleString('en-IN') : '-'} impressions)</span></p>
                                          </div>}
                                          {isServiceEnabled(client.id, 'content') && outNetworkShare !== null && <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-0.5">Out-of-Network</p>
                                            <p className="text-lg font-black">{formatPct(outNetworkShare)} <span className="text-xs font-semibold text-muted-foreground">({totalImpressions !== null ? Math.round(totalImpressions * outNetworkShare / 100).toLocaleString('en-IN') : '-'} impressions)</span></p>
                                          </div>}
                                          {isServiceEnabled(client.id, 'leadgen') && <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-0.5">Total Connection Requests Sent This Week</p>
                                            <p className="text-lg font-black">{formatDashboardValue(totalConnReq, 'L10')}</p>
                                          </div>}
                                        </div>
                                        <Badge className={cn(
                                          "font-black text-[11px] px-3 py-1",
                                          onTrack === null ? "bg-muted text-muted-foreground" :
                                          onTrack === 'on' ? "bg-status-on text-white" :
                                          onTrack === 'risk' ? "bg-status-risk text-white" :
                                          "bg-status-off text-white"
                                        )}>
                                          {onTrack === null ? 'No Data' : onTrack === 'on' ? '✅ On Track' : onTrack === 'risk' ? '⚠️ At Risk' : '🔴 Off Track'}
                                        </Badge>
                                      </div>
                                    )
                                  })()}
                                  </>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                  )
                )}
              </div>

              {/* SECTION: TJ PERSONAL BRAND */}
              <div className="space-y-4">
                <SectionHeader title={`TJ Personal Brand${isMonthlyView ? ' (Month to Date)' : ''}`} id="tj" icon={Star} />
                {!collapsedSections.has('tj') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {(isMonthlyView ? monthTjRows.length > 0 : !!tjData) ? (
                      <>
                        <TJChannelCard
                          title="Instagram"
                          icon={Instagram}
                          metrics={[
                            { id: 'TJI11', name: 'Total Followers' },
                            { id: 'TJI10', name: 'Followers Gained' },
                            { id: 'TJI05', name: 'Impressions' },
                            { id: 'TJI04', name: 'Total Posts' },
                            { id: 'TJI01', name: 'Stories' },
                            { id: 'TJI02', name: 'Carousels' },
                            { id: 'TJI03', name: 'Reels' },
                            { id: 'TJI06', name: 'Likes' },
                            { id: 'TJI07', name: 'Comments' },
                            { id: 'TJI08', name: 'Shares' },
                            { id: 'TJI09', name: 'Saves' },
                          ]}
                          currentData={isMonthlyView ? monthTjAgg.instagram : tjData?.instagram}
                          prevData={isMonthlyView ? null : tjPrev?.instagram}
                        />
                        <TJChannelCard
                          title="YouTube"
                          icon={Youtube}
                          metrics={[
                            { id: 'TJY07', name: 'Total Subscribers' },
                            { id: 'TJY06', name: 'New Subscribers' },
                            { id: 'TJY02', name: 'Views' },
                            { id: 'TJY01', name: 'Shorts Uploaded' },
                            { id: 'TJY03', name: 'Impressions' },
                            { id: 'TJY04', name: 'Likes' },
                            { id: 'TJY05', name: 'Comments' },
                            { id: 'TJY08', name: 'Watch Time', unit: 'hrs' },
                          ]}
                          currentData={isMonthlyView ? monthTjAgg.youtube : tjData?.youtube}
                          prevData={isMonthlyView ? null : tjPrev?.youtube}
                        />
                        <TJChannelCard
                          title="Newsletter"
                          icon={Mail}
                          metrics={[
                            { id: 'TJP08', name: 'Emails Sent' },
                            { id: 'TJP09', name: 'Delivery Rate', unit: '%' },
                            { id: 'TJP10', name: 'Open Rate', unit: '%' },
                            { id: 'TJP11', name: 'Click Rate', unit: '%' },
                            { id: 'TJP12', name: 'Click-to-Open Rate', unit: '%' },
                            { id: 'TJP13', name: 'Unsubscribe Rate', unit: '%' },
                          ]}
                          currentData={isMonthlyView ? monthTjAgg.newsletter : tjData?.email_newsletter}
                          prevData={isMonthlyView ? null : tjPrev?.email_newsletter}
                        />
                        <TJChannelCard
                          title="Video Pipeline"
                          icon={Mic}
                          metrics={[
                            { id: 'TJV01', name: 'Videos Shot' },
                            { id: 'TJV02', name: 'Videos Edited' },
                            { id: 'TJV03', name: 'Videos Scheduled' },
                          ]}
                          currentData={isMonthlyView ? monthTjAgg.video_pipeline : tjData?.video_pipeline}
                          prevData={isMonthlyView ? null : tjPrev?.video_pipeline}
                        />
                      </>
                    ) : (
                      <Card className="col-span-full border border-dashed py-10 flex flex-col items-center justify-center bg-muted/5">
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No data submitted for this week</p>
                        <Button asChild variant="link" className="text-gold font-bold mt-2">
                          <Link to="/tj-personal-brand">Go to TJ Brand Entry →</Link>
                        </Button>
                      </Card>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION: SALES & OUTREACH */}
              <div className="space-y-4">
                <SectionHeader title={`Sales & Outreach${isMonthlyView ? ' (Month to Date)' : ''}`} id="sales" icon={TrendingUp} />
                {!collapsedSections.has('sales') && (
                  <div className="space-y-4">
                    {(isMonthlyView ? monthSalesRows.length > 0 : !!salesData) ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <SalesOutreachCard
                            title="TJ Outreach"
                            metrics={[
                              { id: 'SO02', name: 'Sent' },
                              { id: 'SO03', name: 'Accepted' },
                              { id: 'SO05', name: 'Answered' },
                              { id: 'SO07', name: 'Hot Leads' },
                              { id: 'SO08', name: 'Meetings' },
                            ]}
                            currentData={isMonthlyView ? monthSalesAgg.tj_outreach : salesData?.tj_outreach}
                          />
                          <SalesOutreachCard
                            title="Jahnvi Outreach"
                            metrics={[
                              { id: 'SO11', name: 'Sent' },
                              { id: 'SO12', name: 'Accepted' },
                              { id: 'SO14', name: 'Answered' },
                              { id: 'SO16', name: 'Hot Leads' },
                              { id: 'SO17', name: 'Meetings' },
                            ]}
                            currentData={isMonthlyView ? monthSalesAgg.jahnvi_outreach : salesData?.jahnvi_outreach}
                          />
                          <SalesOutreachCard
                            title="Shirin Outreach"
                            metrics={[
                              { id: 'SO20', name: 'Sent' },
                              { id: 'SO21', name: 'Accepted' },
                              { id: 'SO23', name: 'Answered' },
                              { id: 'SO25', name: 'Hot Leads' },
                              { id: 'SO26', name: 'Meetings' },
                            ]}
                            currentData={isMonthlyView ? monthSalesAgg.shirin_outreach : salesData?.shirin_outreach}
                          />
                        </div>
                        {(() => {
                          const ceS = isMonthlyView ? { cold_email: monthSalesAgg.cold_email } : salesData
                          const so50 = salesVal(ceS, 'cold_email', 'SO50')
                          const so51 = salesVal(ceS, 'cold_email', 'SO51')
                          const so53 = salesVal(ceS, 'cold_email', 'SO53')
                          const so55 = salesVal(ceS, 'cold_email', 'SO55')
                          const replyRate = so50 && so50 > 0 && so51 !== null ? Math.round((so51 / so50) * 1000) / 10 : null
                          const posReplyRate = so51 && so51 > 0 && so53 !== null ? Math.round((so53 / so51) * 1000) / 10 : null
                          return (
                            <Card className="border shadow-sm p-6 bg-card">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 border-b pb-2">Cold Emailing</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-6">
                                {[
                                  { label: 'Emails Sent', val: so50, fmt: 'num' },
                                  { label: 'Replies', val: so51, fmt: 'num' },
                                  { label: 'Reply Rate', val: replyRate, fmt: 'pct' },
                                  { label: 'Positive Replies', val: so53, fmt: 'num' },
                                  { label: 'Positive Reply Rate', val: posReplyRate, fmt: 'pct' },
                                  { label: 'OOO Replies', val: so55, fmt: 'num' },
                                ].map((m, i) => (
                                  <div key={i} className="space-y-1">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{m.label}</p>
                                    <p className="text-lg font-black">{m.val === null ? '-' : m.fmt === 'pct' ? `${m.val}%` : fmt(m.val)}</p>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          )
                        })()}
                        {(() => {
                          const mtS = isMonthlyView ? { meeting_tracker: monthSalesAgg.meeting_tracker } : salesData
                          const so43 = salesVal(mtS, 'meeting_tracker', 'SO43')
                          const so47 = salesVal(mtS, 'meeting_tracker', 'SO47')
                          return (
                            <Card className="border shadow-sm p-6 bg-card">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 border-b pb-2">Meeting Tracker</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-6">
                                {[
                                  { label: 'Via LinkedIn', val: salesVal(mtS, 'meeting_tracker', 'SO36'), fmt: 'num' },
                                  { label: 'Via Cold Email', val: salesVal(mtS, 'meeting_tracker', 'SO37'), fmt: 'num' },
                                  { label: 'Via Referral', val: salesVal(mtS, 'meeting_tracker', 'SO38'), fmt: 'num' },
                                  { label: 'Via Other', val: salesVal(mtS, 'meeting_tracker', 'SO39'), fmt: 'num' },
                                  { label: 'Total Booked', val: salesVal(mtS, 'meeting_tracker', 'SO40'), fmt: 'num' },
                                  { label: 'Completed', val: salesVal(mtS, 'meeting_tracker', 'SO41'), fmt: 'num' },
                                  { label: 'Completion Rate', val: so43, fmt: 'pct' },
                                  { label: 'No-Shows', val: salesVal(mtS, 'meeting_tracker', 'SO42'), fmt: 'num' },
                                  { label: 'Proposals', val: salesVal(mtS, 'meeting_tracker', 'SO44'), fmt: 'num' },
                                  { label: 'Follow-ups', val: salesVal(mtS, 'meeting_tracker', 'SO45'), fmt: 'num' },
                                  { label: 'Conversions', val: salesVal(mtS, 'meeting_tracker', 'SO46'), fmt: 'num' },
                                  { label: 'Conversion Rate', val: so47, fmt: 'pct' },
                                  { label: 'Avg Deal Size', val: salesVal(mtS, 'meeting_tracker', 'SO48'), fmt: 'inr' },
                                  { label: 'Revenue Closed', val: salesVal(mtS, 'meeting_tracker', 'SO49'), fmt: 'inr' },
                                ].map((m, i) => (
                                  <div key={i} className="space-y-1">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{m.label}</p>
                                    <p className="text-lg font-black">
                                      {m.val === null ? '-' : m.fmt === 'pct' ? `${m.val}%` : m.fmt === 'inr' ? fmt(m.val, '₹') : fmt(m.val)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          )
                        })()}
                      </>
                    ) : (
                      <Card className="border border-dashed py-10 flex flex-col items-center justify-center bg-muted/5">
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No sales data submitted for this week</p>
                        <Button asChild variant="link" className="text-gold font-bold mt-2">
                          <Link to="/sales">Go to Sales Entry →</Link>
                        </Button>
                      </Card>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION: MM COMPANY CONTENT */}
              <div className="space-y-4">
                <SectionHeader title={`MM Company Content${isMonthlyView ? ' (Month to Date)' : ''}`} id="mm" icon={Globe} />
                {!collapsedSections.has('mm') && (
                  <Card className="border shadow-sm divide-y">
                    {(isMonthlyView ? monthMmRows.length > 0 : !!mmData) ? (
                      <>
                        <MMContentRow title="LinkedIn Presence" icon={Linkedin} metrics={[
                            { id: 'MML01', name: 'Posts' },
                            { id: 'MML10', name: 'In-Network Impressions' },
                            { id: 'MML11', name: 'Out-of-Network Impressions' },
                            { id: 'MML02', name: 'Total Impressions' },
                            { id: 'MML12', name: 'Avg Impressions / Post' },
                            { id: 'MML03', name: 'Reactions' },
                            { id: 'MML04', name: 'Comments' },
                            { id: 'MML05', name: 'New Followers' },
                            { id: 'MML06', name: 'Total Followers' },
                            { id: 'MML07', name: 'Page Views' },
                            { id: 'MML08', name: 'Articles Published' },
                            { id: 'MML09', name: 'Article Impressions' },
                          ]} currentData={withLinkedInImpressionTotals(isMonthlyView ? monthMmAgg.linkedin : mmData?.linkedin)} prevData={isMonthlyView ? null : withLinkedInImpressionTotals(prevMmData?.linkedin)}
                        />
                        <MMContentRow title="Instagram Presence" icon={Instagram} metrics={[
                            { id: 'MMI01', name: 'Posts' },
                            { id: 'MMI02', name: 'Stories' },
                            { id: 'MMI03', name: 'Reels' },
                            { id: 'MMI04', name: 'Impressions' },
                            { id: 'MMI07', name: 'New Followers' },
                            { id: 'MMI08', name: 'Total Followers' },
                            { id: 'MMI09', name: 'ORM Replies' },
                          ]} currentData={isMonthlyView ? monthMmAgg.instagram : mmData?.instagram} prevData={isMonthlyView ? null : prevMmData?.instagram}
                        />
                        <MMContentRow title="Website Analytics" icon={Globe} metrics={[
                            { id: 'MMW01', name: 'Active Users' },
                            { id: 'MMW02', name: 'New Users' },
                            { id: 'MMW03', name: 'Avg Session', unit: 's' },
                            { id: 'MMW04', name: 'Bounce Rate', unit: '%', invertColor: true },
                            { id: 'MMW05', name: 'Blogs Published' },
                          ]} currentData={isMonthlyView ? monthMmAgg.website : mmData?.website} prevData={isMonthlyView ? null : prevMmData?.website}
                        />
                        <MMContentRow title="Other Channels" icon={MessageSquare} metrics={[
                            { id: 'MMO01', name: 'Quora Engagement' },
                            { id: 'MMO05', name: 'Reddit Engagement' },
                            { id: 'MMO06', name: 'Medium Blogs Published' },
                          ]} currentData={isMonthlyView ? { ...monthMmAgg.quora, ...monthMmAgg.reddit } : { ...asDashboardRecord(mmData?.quora), ...asDashboardRecord(mmData?.reddit) }} prevData={isMonthlyView ? null : { ...asDashboardRecord(prevMmData?.quora), ...asDashboardRecord(prevMmData?.reddit) }}
                        />
                        <MMContentRow title="Ads Performance" icon={TrendingUp} metrics={[
                            { id: 'MMA01', name: 'Google Clicks' },
                            { id: 'MMA03', name: 'Google CTR', unit: '%' },
                            { id: 'MMA04', name: 'Google Cost', unit: '₹' },
                            { id: 'MMA09', name: 'Google Cost/Lead', unit: '₹' },
                            { id: 'MMA11', name: 'Google Website Visits' },
                            { id: 'MMA06', name: 'Meta Cost', unit: '₹' },
                            { id: 'MMA10', name: 'Meta Cost/Lead', unit: '₹' },
                            { id: 'MMA12', name: 'Meta Lead Form Filled' },
                          ]} currentData={isMonthlyView ? monthMmAgg.ads : (mmData as any)?.ads} prevData={isMonthlyView ? null : (prevMmData as any)?.ads}
                        />
                      </>
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center bg-muted/5">
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No company content data submitted for this week</p>
                        <Button asChild variant="link" className="text-gold font-bold mt-2">
                          <Link to="/mm-content">Go to MM Content Entry →</Link>
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* SECTION: MYNTMORE PROCESSES */}
              <div className="space-y-4">
                <SectionHeader title="Myntmore Processes" id="processes" icon={LayoutDashboard} />
                {!collapsedSections.has('processes') && (
                  <Card className="overflow-hidden border shadow-sm">
                    {processesData.length === 0 ? (
                      <p className="p-6 text-sm italic text-muted-foreground">No active processes found.</p>
                    ) : (
                      <div className="divide-y">
                        {processesData
                          .slice()
                          .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority || 'medium'] ?? 1) - ({ high: 0, medium: 1, low: 2 }[b.priority || 'medium'] ?? 1) || a.title.localeCompare(b.title))
                          .map(p => {
                          const update = processesUpdates.find(u => u.process_id === p.id)
                          const expanded = expandedProcesses.has(p.id)
                          const owner = profiles.find(person => person.id === p.owner_id)?.full_name || 'Unassigned'
                          const priorityClass = p.priority === 'high'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : p.priority === 'low'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          return (
                            <div key={p.id} className="transition-colors hover:bg-muted/10">
                              <button
                                type="button"
                                onClick={() => setExpandedProcesses(current => {
                                  const next = new Set(current)
                                  if (next.has(p.id)) next.delete(p.id)
                                  else next.add(p.id)
                                  return next
                                })}
                                aria-expanded={expanded}
                                className="flex w-full items-center justify-between gap-4 p-4 text-left"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${update ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="truncate text-sm font-black">{p.title}</span>
                                      <Badge variant="outline" className={`text-[9px] font-black uppercase ${priorityClass}`}>{p.priority || 'medium'}</Badge>
                                      {p.category && <Badge variant="secondary" className="text-[9px] font-bold">{p.category}</Badge>}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-muted-foreground">
                                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {owner}</span>
                                      <span className={update ? 'text-emerald-600' : 'text-amber-600'}>{update ? 'Updated for selected week' : 'Awaiting weekly update'}</span>
                                    </div>
                                  </div>
                                </div>
                                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                              </button>

                              {expanded && (
                                <div className="grid gap-4 border-t bg-muted/20 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                                  <div>
                                    <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Process definition</div>
                                    <p className="text-sm leading-relaxed text-foreground">{p.description || 'No process description has been added yet.'}</p>
                                  </div>
                                  <div className="rounded-lg border bg-background p-3">
                                    <div className="mb-1 flex items-center justify-between gap-3">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Weekly progress</span>
                                      <span className="text-[10px] text-muted-foreground">{getWeekLabel(displayWeek)}</span>
                                    </div>
                                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${update ? 'text-foreground' : 'italic text-muted-foreground'}`}>
                                      {update?.update_text || 'No update has been entered for this week.'}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        <div className="flex justify-end bg-muted/10 p-3">
                          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-bold">
                            <Link to="/processes">Open Processes Workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* SECTION: TEAM SUBMISSION STATUS */}
              <div className="space-y-4">
                <SectionHeader title="Team Submission Status" id="team" icon={Users} />
                {!collapsedSections.has('team') && (
                  <Card className="border shadow-sm divide-y">
                      {teamSubmissionStatus.map(p => (
                          <div key={p.name} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                              <div className="space-y-1">
                                  <p className="text-sm font-black">{p.name}</p>
                                  <p className="text-[10px] text-muted-foreground font-medium truncate max-w-md">{p.clients}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-bold text-muted-foreground">{p.submittedCount}/{p.totalCount} submitted</span>
                                  {p.status === 'all' ? (
                                      <Badge className="bg-status-on/10 text-status-on border-none font-bold gap-1">
                                          <CheckCircle2 className="w-3 h-3" /> ✓ All submitted
                                      </Badge>
                                  ) : p.status === 'partial' ? (
                                      <Badge className="bg-status-risk/10 text-status-risk border-none font-bold gap-1">
                                          <AlertTriangle className="w-3 h-3" /> ⚠️ Partial
                                      </Badge>
                                  ) : (
                                      <Badge className="bg-status-off/10 text-status-off border-none font-bold gap-1">
                                          <AlertCircle className="w-3 h-3" /> ✗ None
                                      </Badge>
                                  )}
                              </div>
                          </div>
                      ))}
                  </Card>
                )}
              </div>

              {/* SECTION: OPEN ACTIONABLES */}
              <div className="space-y-4">
                <SectionHeader title="Open Actionables" id="actionables" icon={CheckCircle2} />
                {!collapsedSections.has('actionables') && (
                  <Card className="border shadow-sm p-6 bg-card relative">
                      <div className="space-y-4">
                          {actionablesByClient.map(c => (
                              <div key={c.id} className="flex justify-between items-center group border-b pb-3 last:border-0 last:pb-0">
                                  <span className="font-bold text-sm group-hover:text-gold transition-colors">{c.name}</span>
                                  <div className="flex items-center gap-3">
                                      {c.carriedForward > 0 && <span className="text-[10px] text-red-500 font-bold italic">({c.carriedForward} carried forward)</span>}
                                      <span className="w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-black">{c.count}</span>
                                  </div>
                              </div>
                          ))}
                          {actionablesByClient.length === 0 && (
                              <div className="py-10 text-center italic text-muted-foreground">All clear! No open actionables.</div>
                          )}
                      </div>
                      <Button asChild variant="ghost" size="sm" className="absolute top-2 right-2 text-[10px] font-black h-7">
                          <Link to="/actionables">View All →</Link>
                      </Button>
                  </Card>
                )}
              </div>
            </div>
          </main>
          {editingCampaign && (
            <EditCampaignModal
              campaign={editingCampaign}
              onSave={() => {
                loadAllDashboardData(displayWeek)
              }}
              onClose={() => setEditingCampaign(null)}
            />
          )}
    </div>
  )
}

function AhaMomentsAdmin({ clientId }: { clientId: string }) {
  const [moments, setMoments] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('🎉')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (supabase as any).from('aha_moments').select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => setMoments(data || []))
  }, [clientId])

  const handlePost = async () => {
    if (!title.trim()) return
    setSaving(true)
    const { data } = await (supabase as any).from('aha_moments').insert({
      client_id: clientId, title: title.trim(), description: description.trim() || null, emoji,
    }).select().single()
    if (data) setMoments(prev => [data, ...prev])
    setTitle(''); setDescription(''); setEmoji('🎉'); setShowForm(false); setSaving(false)
    toast.success('Aha moment posted!')
  }

  const handleDelete = async (id: string) => {
    await (supabase as any).from('aha_moments').delete().eq('id', id)
    setMoments(prev => prev.filter(m => m.id !== id))
  }

  const EMOJIS = ['🎉', '🚀', '⭐', '🏆', '💪', '🔥', '✅', '💡', '📈', '🎯']

  return (
    <div className="mt-6 border rounded-lg p-4 bg-amber-50/30 border-amber-200/60">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
          🎉 Aha Moments
        </h4>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-gold/40 hover:bg-gold/10"
          onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ Post Moment'}
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-white rounded-lg border space-y-2">
          <div className="flex gap-1 flex-wrap">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                className={cn("text-lg p-1 rounded transition-all", emoji === e ? "bg-gold/20 ring-2 ring-gold/40" : "hover:bg-muted")}>
                {e}
              </button>
            ))}
          </div>
          <input
            placeholder="Title - e.g. First meeting booked! 🏆"
            value={title} onChange={e => setTitle(e.target.value)}
            className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          <textarea
            placeholder="Optional details…"
            value={description} onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
          />
          <Button size="sm" className="bg-gold text-black hover:bg-gold/80 h-7 text-xs font-black"
            onClick={handlePost} disabled={saving || !title.trim()}>
            {saving ? 'Posting…' : 'Post'}
          </Button>
        </div>
      )}

      {moments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No aha moments posted yet.</p>
      ) : (
        <div className="space-y-2">
          {moments.map(m => (
            <div key={m.id} className="flex items-start gap-2 p-2.5 bg-white rounded-lg border">
              <span className="text-xl leading-none mt-0.5">{m.emoji || '🎉'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black leading-tight">{m.title}</p>
                {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => handleDelete(m.id)}
                className="text-muted-foreground/40 hover:text-red-500 text-xs shrink-0 mt-0.5">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardCampaignsSection({ clientId, displayWeek, onEditCampaign }: { clientId: string, displayWeek: string, onEditCampaign: (c: any) => void }) {
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([])
  const [completedCampaigns, setCompletedCampaigns] = useState<any[]>([])
  const [campaignTab, setCampaignTab] = useState<'active' | 'completed'>('active')
  const monthWeeks = getWeeksInSameMonth(displayWeek)

  const enrich = async (data: any[]) => {
    const weekStarts = monthWeeks.map((w: any) => w.weekStart)
    const { data: cdata } = await supabase
      .from('campaign_weekly_data')
      .select('*')
      .eq('client_id', clientId)
      .in('campaign_id', data.map(c => c.id))
      .in('week_start', weekStarts)
    return data.map(c => {
      const byWeek: Record<string, any> = {}
      cdata?.filter(r => r.campaign_id === c.id).forEach(r => { byWeek[r.week_start] = r })
      return { ...c, byWeek }
    })
  }

  const load = async () => {
    const { data: allData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    if (!allData) return

    const active = allData.filter(c => c.status !== 'completed')
    const completed = allData.filter(c => c.status === 'completed')

    const [enrichedActive, enrichedCompleted] = await Promise.all([
      active.length ? enrich(active) : Promise.resolve([]),
      completed.length ? enrich(completed) : Promise.resolve([]),
    ])

    setActiveCampaigns(enrichedActive)
    setCompletedCampaigns(enrichedCompleted)
  }

  useEffect(() => { load() }, [clientId, displayWeek])

  if (activeCampaigns.length === 0 && completedCampaigns.length === 0) return null

  const displayed = campaignTab === 'active' ? activeCampaigns : completedCampaigns

  return (
    <div className="mt-8 border-t pt-8">
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gold" />
          <h4 className="text-xs font-black uppercase tracking-widest">Campaigns</h4>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setCampaignTab('active')}
            className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
              campaignTab === 'active'
                ? 'bg-gold text-black border-gold'
                : 'bg-background border-border text-muted-foreground hover:border-gold hover:text-foreground'
            }`}
          >
            Active {activeCampaigns.length > 0 && `(${activeCampaigns.length})`}
          </button>
          <button
            onClick={() => setCampaignTab('completed')}
            className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
              campaignTab === 'completed'
                ? 'bg-gold text-black border-gold'
                : 'bg-background border-border text-muted-foreground hover:border-gold hover:text-foreground'
            }`}
          >
            Completed {completedCampaigns.length > 0 && `(${completedCampaigns.length})`}
          </button>
        </div>
      </div>
      {displayed.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No {campaignTab} campaigns.</p>
      ) : (
        <div className="space-y-4">
          {displayed.map(c => (
            <CampaignMonthTable
              key={c.id}
              campaign={c}
              monthWeeks={monthWeeks}
              onEdit={onEditCampaign}
              onWeekSaved={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
