import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Loader2, Medal, Search, Trophy, Users } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { ALL_METRICS } from '@/data/metrics'
import { formatMetricDisplay } from '@/utils/metricCalculations'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type CategoryFilter = 'all' | 'content' | 'leadgen'

type ClientRow = {
  id: string
  name: string
  company: string | null
}

type HighScoreRow = {
  id: string
  client_id: string | null
  metric_id: string
  metric_name: string | null
  lifetime_high: number | null
  achieved_week: string | null
  lifetime_high_month: number | null
  achieved_month: string | null
  previous_high: number | null
  updated_at: string | null
}

const metricMap = new Map(ALL_METRICS.map(metric => [metric.id, metric]))

function formatWeek(value: string | null) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatMonth(value: string | null) {
  if (!value) return '—'
  return new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function HighScoresPage() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [scores, setScores] = useState<HighScoreRow[]>([])
  const [clientFilter, setClientFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('clients').select('id, name, company').order('name'),
      supabase.from('high_scores').select('*').order('updated_at', { ascending: false }),
    ]).then(([clientResult, scoreResult]) => {
      if (!active) return
      const queryError = clientResult.error || scoreResult.error
      if (queryError) {
        setError(queryError.message)
        return
      }
      setClients((clientResult.data || []) as ClientRow[])
      setScores((scoreResult.data || []) as HighScoreRow[])
    }).catch(queryError => {
      if (active) setError(queryError instanceof Error ? queryError.message : 'Unexpected error while loading high scores.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const clientMap = useMemo(() => new Map(clients.map(client => [client.id, client])), [clients])

  const filteredScores = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return scores.filter(score => {
      const client = score.client_id ? clientMap.get(score.client_id) : undefined
      const metric = metricMap.get(score.metric_id)
      const category = metric?.category ?? (score.metric_id.startsWith('C') ? 'content' : 'leadgen')
      if (clientFilter !== 'all' && score.client_id !== clientFilter) return false
      if (categoryFilter !== 'all' && category !== categoryFilter) return false
      if (!normalizedSearch) return true
      return [client?.name, client?.company, score.metric_name, metric?.name, score.metric_id]
        .some(value => value?.toLowerCase().includes(normalizedSearch))
    })
  }, [categoryFilter, clientFilter, clientMap, scores, search])

  const summary = useMemo(() => {
    const clientIds = new Set(filteredScores.map(score => score.client_id).filter(Boolean))
    const latestWeek = filteredScores.reduce<string | null>((latest, score) => {
      if (!score.achieved_week) return latest
      return !latest || score.achieved_week > latest ? score.achieved_week : latest
    }, null)
    return { records: filteredScores.length, clients: clientIds.size, latestWeek }
  }, [filteredScores])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <Medal className="h-6 w-6 text-gold" />
          <h1 className="text-2xl font-black tracking-tight">High Scores</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Every client’s best-ever weekly and monthly performance in one place.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><Trophy className="h-5 w-5 text-gold" /><div><p className="text-2xl font-black tabular-nums">{summary.records}</p><p className="text-xs text-muted-foreground">High-score records</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-blue-600" /><div><p className="text-2xl font-black tabular-nums">{summary.clients}</p><p className="text-xs text-muted-foreground">Clients represented</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><CalendarDays className="h-5 w-5 text-green-600" /><div><p className="text-lg font-black">{formatWeek(summary.latestWeek)}</p><p className="text-xs text-muted-foreground">Latest record week</p></div></CardContent></Card>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_220px_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client or metric…" aria-label="Search high scores" className="pl-9" />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger aria-label="Filter by client"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={value => setCategoryFilter(value as CategoryFilter)}>
          <SelectTrigger aria-label="Filter by metric category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All metrics</SelectItem>
            <SelectItem value="content">Content</SelectItem>
            <SelectItem value="leadgen">Lead generation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"><AlertTriangle className="h-4 w-4" /> Could not load high scores: {error}</div>
      ) : loading ? (
        <div className="flex min-h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading high scores…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Best Week</TableHead>
                <TableHead>Achieved</TableHead>
                <TableHead className="text-right">Best Month</TableHead>
                <TableHead>Achieved</TableHead>
                <TableHead className="text-right">Previous Best</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScores.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No high scores match these filters.</TableCell></TableRow>
              ) : filteredScores.map(score => {
                const client = score.client_id ? clientMap.get(score.client_id) : undefined
                const metric = metricMap.get(score.metric_id)
                const metricName = score.metric_name || metric?.name || score.metric_id
                return (
                  <TableRow key={score.id}>
                    <TableCell><p className="font-bold">{client?.name || 'Unknown client'}</p>{client?.company ? <p className="text-xs text-muted-foreground">{client.company}</p> : null}</TableCell>
                    <TableCell><p className="font-medium">{metricName}</p><p className="text-xs font-mono text-muted-foreground">{score.metric_id}</p></TableCell>
                    <TableCell className="text-right text-base font-black text-gold">{formatMetricDisplay(score.lifetime_high, score.metric_id)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatWeek(score.achieved_week)}</TableCell>
                    <TableCell className="text-right text-base font-black text-amber-700">{formatMetricDisplay(score.lifetime_high_month, score.metric_id)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatMonth(score.achieved_month)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatMetricDisplay(score.previous_high, score.metric_id)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
