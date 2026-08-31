import React, { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { CONTENT_METRICS, LEADGEN_METRICS, Metric, MetricType } from '@/data/metrics'
import { customMetricToMetric } from '@/hooks/useEffectiveMetrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Archive } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/integrations/supabase/types'
import { updateClientHealth } from '@/lib/health'
import { sortAlphabetically } from '@/utils/sort'

type ClientSettingsInsert = Database['myntmore']['Tables']['client_settings']['Insert']
type CustomMetricInsert = Database['myntmore']['Tables']['custom_metrics']['Insert']
type CustomMetricRow = Database['myntmore']['Tables']['custom_metrics']['Row']

const RESERVED_GROUPS = new Set(['Qualitative', 'Delivery & Reporting'])

async function refreshRecentHealthScores(clientId: string) {
  const { data, error } = await supabase
    .from('weekly_data')
    .select('week_start, content_metrics, leadgen_metrics')
    .eq('client_id', clientId)
    .order('week_start', { ascending: false })
    .limit(12)
  if (error) throw error

  await Promise.all((data ?? []).map(row => updateClientHealth(
    clientId,
    row.week_start,
    row.content_metrics as Record<string, any> ?? {},
    row.leadgen_metrics as Record<string, any> ?? {},
  )))
}

interface ClientRow {
  id: string
  name: string
  company: string | null
  status: string | null
}

interface Settings {
  id: string
  client_id: string | null
  active_content_metrics: string[] | null
  active_leadgen_metrics: string[] | null
  content_enabled: boolean
  leadgen_enabled: boolean
}

const NEW_METRIC_DEFAULTS = { name: '', type: 'number' as MetricType, group: 'Custom', hasTarget: false, hasNote: false }

export function MetricFieldsTab() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [settingsMap, setSettingsMap] = useState<Record<string, Settings>>({})
  const [customMetricsMap, setCustomMetricsMap] = useState<Record<string, CustomMetricRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<'content' | 'leadgen'>('content')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newMetric, setNewMetric] = useState(NEW_METRIC_DEFAULTS)
  const [savingNewMetric, setSavingNewMetric] = useState(false)

  const loadCustomMetrics = async () => {
    const { data } = await supabase
      .from('custom_metrics')
      .select('*')
      .eq('archived', false)
      .order('sort_order', { ascending: true })
    const map: Record<string, CustomMetricRow[]> = {}
    ;(data ?? []).forEach(row => {
      if (!map[row.client_id]) map[row.client_id] = []
      map[row.client_id].push(row)
    })
    setCustomMetricsMap(map)
  }

  useEffect(() => {
    const load = async () => {
      const [{ data: clientsData }, { data: settingsData }] = await Promise.all([
        supabase.from('clients').select('id, name, company, status').eq('status', 'active').order('name'),
        supabase.from('client_settings').select('id, client_id, active_content_metrics, active_leadgen_metrics, content_enabled, leadgen_enabled'),
      ])
      if (clientsData) {
        const sortedClients = sortAlphabetically(clientsData, client => client.name)
        setClients(sortedClients)
        if (sortedClients.length > 0) setSelectedClient(sortedClients[0].id)
      }
      if (settingsData) {
        const map: Record<string, Settings> = {}
        settingsData.forEach((s: Settings) => { if (s.client_id) map[s.client_id] = s })
        setSettingsMap(map)
      }
      await loadCustomMetrics()
      setLoading(false)
    }
    load()
  }, [])

  const handleAddCustomMetric = async () => {
    if (!selectedClient || !newMetric.name.trim()) return
    setSavingNewMetric(true)
    try {
      const insert: CustomMetricInsert = {
        client_id: selectedClient,
        name: newMetric.name.trim(),
        type: newMetric.type,
        category: activeCategory,
        group: newMetric.group.trim() || 'Custom',
        has_target: newMetric.type === 'textarea' ? false : newMetric.hasTarget,
        has_note: newMetric.hasNote,
      }
      const { data, error } = await supabase.from('custom_metrics').insert(insert).select('*').single()
      if (error) throw error

      setCustomMetricsMap(prev => ({
        ...prev,
        [selectedClient]: [...(prev[selectedClient] ?? []), data as CustomMetricRow],
      }))

      // New metrics should be visible immediately. `null` already means "all
      // active"; a non-null allowlist needs the new metric_key appended or it
      // would otherwise silently never appear — the exact bug just fixed for
      // C27/C28/L30 above, now avoided at creation time instead of needing a
      // later backfill.
      const settings = settingsMap[selectedClient]
      const field = activeCategory === 'content' ? 'active_content_metrics' : 'active_leadgen_metrics'
      const current = settings?.[field]
      if (current !== null && current !== undefined) {
        const updated = [...current, (data as CustomMetricRow).metric_key]
        const update: ClientSettingsInsert = { client_id: selectedClient, [field]: updated }
        const { data: updatedSettings, error: settingsError } = await supabase
          .from('client_settings')
          .upsert(update, { onConflict: 'client_id' })
          .select('id, client_id, active_content_metrics, active_leadgen_metrics, content_enabled, leadgen_enabled')
          .single()
        if (settingsError) {
          console.error('Failed to activate new custom metric:', settingsError)
        } else {
          setSettingsMap(prev => ({ ...prev, [selectedClient]: updatedSettings as Settings }))
        }
      }

      toast.success(`"${insert.name}" added for ${clients.find(c => c.id === selectedClient)?.name}`)
      setNewMetric(NEW_METRIC_DEFAULTS)
      setAddDialogOpen(false)
    } catch (error: any) {
      toast.error('Failed to add custom metric: ' + error.message)
    } finally {
      setSavingNewMetric(false)
    }
  }

  const handleArchiveCustomMetric = async (metric: CustomMetricRow) => {
    if (!confirm(`Archive "${metric.name}"? Past data stays intact, but it will disappear from data entry and the dashboard.`)) return
    const { error } = await supabase.from('custom_metrics').update({ archived: true }).eq('id', metric.id)
    if (error) {
      toast.error('Failed to archive: ' + error.message)
      return
    }
    setCustomMetricsMap(prev => ({
      ...prev,
      [metric.client_id]: (prev[metric.client_id] ?? []).filter(m => m.id !== metric.id),
    }))
    toast.success(`"${metric.name}" archived`)
  }

  const handleToggle = async (clientId: string, metricId: string, category: 'content' | 'leadgen') => {
    const settings = settingsMap[clientId]
    const field = category === 'content' ? 'active_content_metrics' : 'active_leadgen_metrics'
    const allMetricIds = (category === 'content' ? CONTENT_METRICS : LEADGEN_METRICS).map(m => m.id)
    // null means all active — initialise from full list before mutating
    const current = settings?.[field] ?? allMetricIds
    const updated = current.includes(metricId)
      ? current.filter((m: string) => m !== metricId)
      : [...current, metricId]

    setSettingsMap(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] ?? {
          id: '',
          client_id: clientId,
          active_content_metrics: null,
          active_leadgen_metrics: null,
          content_enabled: true,
          leadgen_enabled: true,
        }),
        [field]: updated,
      }
    }))

    const update: ClientSettingsInsert = { client_id: clientId }
    if (category === 'content') update.active_content_metrics = updated
    else update.active_leadgen_metrics = updated
    const { data, error } = await supabase
      .from('client_settings')
      .upsert(update, { onConflict: 'client_id' })
      .select('id, client_id, active_content_metrics, active_leadgen_metrics, content_enabled, leadgen_enabled')
      .single()

    if (error) {
      toast.error('Failed to save: ' + error.message)
      setSettingsMap(prev => ({
        ...prev,
        [clientId]: {
          ...(prev[clientId] ?? {
            id: '',
            client_id: clientId,
            active_content_metrics: null,
            active_leadgen_metrics: null,
            content_enabled: true,
            leadgen_enabled: true,
          }),
          [field]: current,
        }
      }))
    } else {
      setSettingsMap(prev => ({ ...prev, [clientId]: data as Settings }))
      try {
        await refreshRecentHealthScores(clientId)
      } catch (healthError) {
        console.error('Failed to refresh health scores after metric change:', healthError)
        toast.warning('Metric saved, but recent health scores could not be refreshed.')
      }
    }
  }

  const handleServiceToggle = async (clientId: string, category: 'content' | 'leadgen', enabled: boolean) => {
    const field = category === 'content' ? 'content_enabled' : 'leadgen_enabled'
    const current = settingsMap[clientId]

    setSettingsMap(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] ?? {
          id: '',
          client_id: clientId,
          active_content_metrics: null,
          active_leadgen_metrics: null,
          content_enabled: true,
          leadgen_enabled: true,
        }),
        [field]: enabled,
      },
    }))

    const update: ClientSettingsInsert = { client_id: clientId }
    if (category === 'content') update.content_enabled = enabled
    else update.leadgen_enabled = enabled

    const { data, error } = await supabase
      .from('client_settings')
      .upsert(update, { onConflict: 'client_id' })
      .select('id, client_id, active_content_metrics, active_leadgen_metrics, content_enabled, leadgen_enabled')
      .single()

    if (error) {
      toast.error('Failed to save: ' + error.message)
      setSettingsMap(prev => {
        const next = { ...prev }
        if (current) next[clientId] = current
        else delete next[clientId]
        return next
      })
      return
    }

    setSettingsMap(prev => ({ ...prev, [clientId]: data as Settings }))
    try {
      await refreshRecentHealthScores(clientId)
      toast.success(`${category === 'content' ? 'Content' : 'Lead Gen'} ${enabled ? 'enabled' : 'disabled'}`)
    } catch (healthError) {
      console.error('Failed to refresh health scores after service change:', healthError)
      toast.warning('Service saved, but recent health scores could not be refreshed.')
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  const settings = selectedClient ? settingsMap[selectedClient] : null
  const customMetricRows = (selectedClient ? customMetricsMap[selectedClient] : []) ?? []
  const customMetricIds = new Set(customMetricRows.map(m => m.metric_key))
  const standardMetrics = activeCategory === 'content' ? CONTENT_METRICS : LEADGEN_METRICS
  const customMetrics: Metric[] = customMetricRows
    .filter(m => m.category === activeCategory)
    .map(customMetricToMetric)
  const metrics = [...standardMetrics, ...customMetrics]
  const activeField = activeCategory === 'content' ? 'active_content_metrics' : 'active_leadgen_metrics'
  // null means "not yet configured" — treat as all active
  const allIds = metrics.map(m => m.id)
  const activeIds: string[] = settings?.[activeField] ?? allIds
  const contentEnabled = settings?.content_enabled ?? true
  const leadgenEnabled = settings?.leadgen_enabled ?? true
  const categoryEnabled = activeCategory === 'content' ? contentEnabled : leadgenEnabled

  // Group metrics by group
  const grouped = metrics.reduce<Record<string, typeof metrics>>((acc, m) => {
    if (!acc[m.group]) acc[m.group] = []
    acc[m.group].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap">
        {clients.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedClient(c.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
              selectedClient === c.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {selectedClient && (
        <Card>
          <CardHeader className="pb-3">
            <div className="grid gap-3 sm:grid-cols-2 mb-5">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-bold">Content</p>
                  <p className="text-xs text-muted-foreground">Show content data and metrics</p>
                </div>
                <Switch
                  checked={contentEnabled}
                  onCheckedChange={(enabled) => handleServiceToggle(selectedClient, 'content', enabled)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-bold">Lead Gen</p>
                  <p className="text-xs text-muted-foreground">Show lead-gen data and metrics</p>
                </div>
                <Switch
                  checked={leadgenEnabled}
                  onCheckedChange={(enabled) => handleServiceToggle(selectedClient, 'leadgen', enabled)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-lg">
                {clients.find(c => c.id === selectedClient)?.name} - Metric Fields
              </CardTitle>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveCategory('content')}
                  className={`px-3 py-1 rounded text-sm font-bold border transition-colors ${
                    activeCategory === 'content'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:border-primary'
                  }`}
                >
                  Content
                </button>
                <button
                  onClick={() => setActiveCategory('leadgen')}
                  className={`px-3 py-1 rounded text-sm font-bold border transition-colors ${
                    activeCategory === 'leadgen'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:border-primary'
                  }`}
                >
                  Lead Gen
                </button>
                <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) setNewMetric(NEW_METRIC_DEFAULTS) }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add Custom Metric
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Add a custom {activeCategory === 'content' ? 'content' : 'lead gen'} metric
                        {selectedClient && <> for {clients.find(c => c.id === selectedClient)?.name}</>}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input
                          value={newMetric.name}
                          onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Referral Calls"
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Type</Label>
                          <Select
                            value={newMetric.type}
                            onValueChange={(value: MetricType) => setNewMetric(prev => ({ ...prev, type: value, hasTarget: value === 'textarea' ? false : prev.hasTarget }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="textarea">Text note</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Group</Label>
                          <Input
                            value={newMetric.group}
                            onChange={(e) => setNewMetric(prev => ({ ...prev, group: e.target.value }))}
                            placeholder="Custom"
                          />
                          {RESERVED_GROUPS.has(newMetric.group.trim()) && (
                            <p className="text-[11px] text-amber-600">
                              "{newMetric.group.trim()}" has special behavior elsewhere (timing/visibility rules) — a different group name is safer.
                            </p>
                          )}
                        </div>
                      </div>
                      {newMetric.type !== 'textarea' && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={newMetric.hasTarget}
                            onCheckedChange={(checked) => setNewMetric(prev => ({ ...prev, hasTarget: checked === true }))}
                          />
                          Supports weekly/monthly targets
                        </label>
                      )}
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={newMetric.hasNote}
                          onCheckedChange={(checked) => setNewMetric(prev => ({ ...prev, hasNote: checked === true }))}
                        />
                        Has an inline note field
                      </label>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddCustomMetric} disabled={savingNewMetric || !newMetric.name.trim()}>
                        {savingNewMetric ? 'Adding…' : 'Add Metric'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!categoryEnabled ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                {activeCategory === 'content' ? 'Content' : 'Lead Gen'} is disabled for this client.
              </div>
            ) : <div className="space-y-6">
              {Object.entries(grouped).map(([group, groupMetrics]) => (
                <div key={group}>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 border-b pb-1">{group}</p>
                  <div className="space-y-1">
                    {groupMetrics.map(m => (
                      <div key={m.id} className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{m.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">{m.id}</Badge>
                          {m.type === 'auto' && <Badge variant="secondary" className="text-[10px] px-1 py-0">auto</Badge>}
                          {customMetricIds.has(m.id) && <Badge className="text-[10px] px-1 py-0 bg-gold/20 text-gold-900 border-gold/40">Custom</Badge>}
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={activeIds.includes(m.id)}
                            onCheckedChange={() => handleToggle(selectedClient, m.id, activeCategory)}
                          />
                          {customMetricIds.has(m.id) && (
                            <button
                              title="Archive this custom metric"
                              onClick={() => {
                                const row = customMetricRows.find(c => c.metric_key === m.id)
                                if (row) handleArchiveCustomMetric(row)
                              }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
