import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Eye, Loader2, Trophy, UserCheck } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { readLinkedInImpressions, readNum } from '@/utils/readMetric'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type RangePreset = 'month' | '4weeks' | '12weeks' | 'custom'

type ClientRow = {
  id: string
  name: string
  company: string | null
}

type WeeklyRow = {
  client_id: string
  week_start: string
  content_metrics: Record<string, unknown> | null
  leadgen_metrics: Record<string, unknown> | null
}

type LeaderboardEntry = ClientRow & {
  impressions: number
  accepted: number
  requests: number
  acceptanceRate: number | null
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

function getPresetRange(preset: Exclude<RangePreset, 'custom'>) {
  const today = new Date()
  const end = isoDate(today)
  if (preset === 'month') {
    return { start: `${end.slice(0, 7)}-01`, end }
  }
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (preset === '4weeks' ? 27 : 83))
  return { start: isoDate(start), end }
}

function RankingList({
  entries,
  value,
  emptyLabel,
}: {
  entries: LeaderboardEntry[]
  value: (entry: LeaderboardEntry) => string
  emptyLabel: string
}) {
  if (entries.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <ol className="divide-y">
      {entries.map((entry, index) => (
        <li key={entry.id} className="flex items-center gap-3 py-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
            index === 0 ? 'bg-gold text-black' : index < 3 ? 'bg-gold/15 text-amber-700' : 'bg-muted text-muted-foreground'
          }`}>
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{entry.name}</p>
            {entry.company ? <p className="truncate text-xs text-muted-foreground">{entry.company}</p> : null}
          </div>
          <span className="text-right text-base font-black tabular-nums">{value(entry)}</span>
        </li>
      ))}
    </ol>
  )
}

export function ClientLeaderboardPage() {
  const initialRange = getPresetRange('month')
  const [preset, setPreset] = useState<RangePreset>('month')
  const [startDate, setStartDate] = useState(initialRange.start)
  const [endDate, setEndDate] = useState(initialRange.end)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handlePresetChange = (nextPreset: RangePreset) => {
    setPreset(nextPreset)
    if (nextPreset !== 'custom') {
      const range = getPresetRange(nextPreset)
      setStartDate(range.start)
      setEndDate(range.end)
    }
  }

  useEffect(() => {
    if (!startDate || !endDate || startDate > endDate) return
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      supabase.from('clients').select('id, name, company').eq('status', 'active').order('name'),
      supabase
        .from('weekly_data')
        .select('client_id, week_start, content_metrics, leadgen_metrics')
        .gte('week_start', startDate)
        .lte('week_start', endDate),
    ]).then(([clientResult, weeklyResult]) => {
      if (!active) return
      const queryError = clientResult.error || weeklyResult.error
      if (queryError) {
        setError(queryError.message)
        setClients([])
        setWeeklyRows([])
        return
      }
      setClients((clientResult.data || []) as ClientRow[])
      setWeeklyRows((weeklyResult.data || []) as WeeklyRow[])
    }).catch(queryError => {
      if (!active) return
      setError(queryError instanceof Error ? queryError.message : 'Unexpected error while loading leaderboard data.')
      setClients([])
      setWeeklyRows([])
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [startDate, endDate])

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const totals = new Map<string, { impressions: number; accepted: number; requests: number }>()
    clients.forEach(client => totals.set(client.id, { impressions: 0, accepted: 0, requests: 0 }))

    weeklyRows.forEach(row => {
      const total = totals.get(row.client_id)
      if (!total) return
      total.impressions += readLinkedInImpressions(row.content_metrics) ?? 0
      total.requests += readNum(row.leadgen_metrics, 'L10') ?? 0
      total.accepted += readNum(row.leadgen_metrics, 'L11') ?? 0
    })

    return clients.map(client => {
      const total = totals.get(client.id) || { impressions: 0, accepted: 0, requests: 0 }
      return {
        ...client,
        ...total,
        acceptanceRate: total.requests > 0 ? Math.min((total.accepted / total.requests) * 100, 100) : null,
      }
    })
  }, [clients, weeklyRows])

  const impressionRanking = useMemo(
    () => leaderboard.filter(entry => entry.impressions > 0).sort((a, b) => b.impressions - a.impressions || a.name.localeCompare(b.name)),
    [leaderboard],
  )
  const acceptanceRanking = useMemo(
    () => leaderboard.filter(entry => entry.acceptanceRate !== null).sort((a, b) => (b.acceptanceRate ?? 0) - (a.acceptanceRate ?? 0) || b.requests - a.requests || a.name.localeCompare(b.name)),
    [leaderboard],
  )

  const invalidRange = Boolean(startDate && endDate && startDate > endDate)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-gold" />
            <h1 className="text-2xl font-black tracking-tight">Client Leaderboard</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Compare active clients over the selected timeframe.</p>
        </div>

        <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="leaderboard-range">Timeframe</Label>
            <Select value={preset} onValueChange={value => handlePresetChange(value as RangePreset)}>
              <SelectTrigger id="leaderboard-range" className="min-w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="4weeks">Last 4 weeks</SelectItem>
                <SelectItem value="12weeks">Last 12 weeks</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leaderboard-start">Start date</Label>
            <Input id="leaderboard-start" type="date" value={startDate} onChange={event => { setPreset('custom'); setStartDate(event.target.value) }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leaderboard-end">End date</Label>
            <Input id="leaderboard-end" type="date" value={endDate} onChange={event => { setPreset('custom'); setEndDate(event.target.value) }} />
          </div>
        </div>
      </div>

      {invalidRange ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> Start date must be before the end date.
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> Could not load leaderboard: {error}
        </div>
      ) : loading ? (
        <div className="flex min-h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading leaderboard…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4 text-blue-600" /> Impressions</CardTitle>
              <p className="text-xs text-muted-foreground">Total LinkedIn impressions across weeks beginning in the selected range.</p>
            </CardHeader>
            <CardContent>
              <RankingList entries={impressionRanking} value={entry => entry.impressions.toLocaleString('en-IN')} emptyLabel="No impression data in this timeframe." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-4 w-4 text-green-600" /> Acceptance Rate</CardTitle>
              <p className="text-xs text-muted-foreground">Total accepted invitations divided by total connection requests.</p>
            </CardHeader>
            <CardContent>
              <RankingList entries={acceptanceRanking} value={entry => `${entry.acceptanceRate?.toFixed(1)}%`} emptyLabel="No connection-request data in this timeframe." />
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !error && !invalidRange ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" /> Showing weeks starting from {startDate} through {endDate}.
        </p>
      ) : null}
    </div>
  )
}
