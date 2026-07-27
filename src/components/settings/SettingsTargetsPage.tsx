import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth"
import { ALL_METRICS, Metric } from "@/data/metrics"
import { getPreviousWeekStart, getWeekOptions, getWeekEnd, getWeekLabel } from "@/utils/weekUtils"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TargetRowProps {
  metric: Metric
  currentTarget: number | undefined
  previousTarget: number | undefined
  mtdActual: number | undefined
  onChange: (metricId: string, value: number) => void
  targetType: 'weekly' | 'monthly'
}

function TargetRow({ metric, currentTarget, previousTarget, mtdActual, onChange, targetType }: TargetRowProps) {
  const achievement = currentTarget && mtdActual !== undefined
    ? Math.round((mtdActual / currentTarget) * 100)
    : null

  const achievementColor = achievement === null ? '#999'
    : achievement >= 100 ? '#3B82F6'
    : achievement >= 70 ? '#22C55E'
    : achievement >= 40 ? '#EAB308'
    : '#EF4444'

  return (
    <tr style={{ borderBottom: '1px solid #F5F5F5' }}>
      <td style={{ padding: '10px 8px', fontSize: '14px', color: '#000' }}>
        {metric.name}
        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#bbb' }}>
          {metric.id}
        </span>
      </td>
      <td style={{ padding: '10px 8px' }}>
        <input
          type="number"
          value={currentTarget ?? ''}
          placeholder="-"
          onChange={(e) => onChange(metric.id, Number(e.target.value))}
          style={{
            width: '90px',
            padding: '6px 10px',
            border: '1px solid #E5E5E5',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'right',
            outline: 'none'
          }}
          onFocus={(e) => e.target.style.borderColor = '#FFC947'}
          onBlur={(e) => e.target.style.borderColor = '#E5E5E5'}
        />
        {metric.unit === '%' && <span style={{ marginLeft: '4px', color: '#999' }}>%</span>}
      </td>
      <td style={{ padding: '10px 8px', color: '#999', fontSize: '14px', textAlign: 'right' }}>
        {previousTarget !== undefined ? previousTarget : '-'}
      </td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
        <span style={{ fontWeight: '600', fontSize: '14px' }}>
          {mtdActual !== undefined ? mtdActual.toLocaleString() : '-'}
        </span>
      </td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
        {achievement !== null ? (
          <span style={{
            color: achievementColor,
            fontWeight: '700',
            fontSize: '13px'
          }}>
            {achievement}%
          </span>
        ) : '-'}
      </td>
    </tr>
  )
}

function getMonthOptions(count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    return {
      period: d.toISOString().slice(0, 7), // '2026-05'
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) // 'May 2026'
    }
  })
}

const COLD_EMAIL_INTERNAL_METRICS = [
  { id: 'SO50', name: 'Emails Sent (Week)', auto: false },
  { id: 'SO51', name: 'Replies', auto: false },
  { id: 'SO52', name: 'Reply Rate', auto: true },
  { id: 'SO53', name: 'Positive Replies', auto: false },
  { id: 'SO54', name: 'Positive Reply Rate', auto: true },
  { id: 'SO55', name: 'Replied with OOO', auto: false },
]
const SALES_TARGET_METRIC_IDS = ['SO50', 'SO51', 'SO53', 'SO55'] // only non-auto ones get targets

export function SettingsTargetsPage() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<'client' | 'sales'>('client')
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [targetType, setTargetType] = useState<'weekly' | 'monthly'>('weekly')
  const [selectedWeekStart, setSelectedWeekStart] = useState(getPreviousWeekStart())
  const [selectedMonth, setSelectedMonth] = useState(getMonthOptions()[0].period)
  const [targetValues, setTargetValues] = useState<Record<string, number>>({})
  const [previousTargets, setPreviousTargets] = useState<Record<string, number>>({})
  const [mtdActuals, setMTDActuals] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  // Sales & Outreach internal targets state
  const [salesTargetValues, setSalesTargetValues] = useState<Record<string, number>>({})
  const [salesActuals, setSalesActuals] = useState<Record<string, number>>({})
  const [salesSaving, setSalesSaving] = useState(false)
  const [clients, setClients] = useState<any[]>([])

  const period = targetType === 'weekly' ? selectedWeekStart : selectedMonth
  const monthOptions = useMemo(() => getMonthOptions(6), [])

  const weekOptions = useMemo(() => {
    // All weeks of current month (including future) + last 8 past weeks, deduped
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const firstDay = new Date(Date.UTC(year, month, 1))
    const lastDay = new Date(Date.UTC(year, month + 1, 0))

    // Snap to the Monday on or before the 1st
    const cursor = new Date(firstDay)
    const dow = cursor.getUTCDay()
    cursor.setUTCDate(cursor.getUTCDate() - (dow === 0 ? 6 : dow - 1))

    const currentMonthWeeks: string[] = []
    while (cursor <= lastDay) {
      currentMonthWeeks.push(cursor.toISOString().split('T')[0])
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }

    // Past weeks (12 back) to fill the dropdown
    const pastWeeks = getWeekOptions(12).map(w => w.weekStart)

    // Merge: current month first (newest first), then past weeks not already listed
    const allWeekStarts = [
      ...currentMonthWeeks.slice().reverse(),
      ...pastWeeks.filter(w => !currentMonthWeeks.includes(w))
    ]

    return allWeekStarts.map(weekStart => ({
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      label: getWeekLabel(weekStart),
    }))
  }, [])

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('clients').select('id, name, company').eq('status', 'active').order('name')
      setClients(data || [])
      if (data && data.length > 0) setSelectedClientId(data[0].id)
    }
    fetchClients()
  }, [])

  const loadTargets = async (clientId: string, type: 'weekly' | 'monthly', p: string) => {
    const { data } = await supabase
      .from('targets')
      .select('metric_id, target_value')
      .eq('client_id', clientId)
      .eq('target_type', type)
      .eq('period', p)

    const targetMap: Record<string, number> = {}
    data?.forEach(t => { if (t.target_value !== null) targetMap[t.metric_id] = t.target_value })
    setTargetValues(targetMap)
  }

  const loadPreviousPeriodTargets = async (clientId: string, type: 'weekly' | 'monthly', currentPeriod: string) => {
    let prevPeriod: string
    if (type === 'weekly') {
      const d = new Date(currentPeriod)
      d.setDate(d.getDate() - 7)
      prevPeriod = d.toISOString().split('T')[0]
    } else {
      const d = new Date(currentPeriod + '-01')
      d.setMonth(d.getMonth() - 1)
      prevPeriod = d.toISOString().slice(0, 7)
    }

    const { data } = await supabase
      .from('targets')
      .select('metric_id, target_value')
      .eq('client_id', clientId)
      .eq('target_type', type)
      .eq('period', prevPeriod)

    const prevMap: Record<string, number> = {}
    data?.forEach(t => { if (t.target_value !== null) prevMap[t.metric_id] = t.target_value })
    setPreviousTargets(prevMap)
  }

  const loadMTDActuals = async (clientId: string, p: string, type: 'weekly' | 'monthly') => {
    let weekStarts: string[] = []

    if (type === 'monthly') {
      const [year, month] = p.split('-').map(Number)
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0)
      const d = new Date(start)
      while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
      while (d <= end) {
        weekStarts.push(d.toISOString().split('T')[0])
        d.setDate(d.getDate() + 7)
      }
    } else {
      weekStarts = [p]
    }

    const { data: weeklyRows } = await supabase
      .from('weekly_data')
      .select('content_metrics, leadgen_metrics')
      .eq('client_id', clientId)
      .in('week_start', weekStarts)

    const actuals: Record<string, number> = {}
    weeklyRows?.forEach(row => {
      ALL_METRICS.filter(m => m.hasTarget).forEach(metric => {
        const col = metric.category === 'content' ? 'content_metrics' : 'leadgen_metrics'
        const val = (row[col] as any)?.[metric.id]?.value
        if (val !== null && val !== undefined && !isNaN(Number(val))) {
          actuals[metric.id] = (actuals[metric.id] ?? 0) + Number(val)
        }
      })
    })

    setMTDActuals(actuals)
  }

  useEffect(() => {
    if (!selectedClientId || !period) return
    Promise.all([
      loadTargets(selectedClientId, targetType, period),
      loadPreviousPeriodTargets(selectedClientId, targetType, period),
      loadMTDActuals(selectedClientId, period, targetType)
    ])
  }, [selectedClientId, targetType, period])

  const handleTargetChange = (metricId: string, value: number) => {
    setTargetValues(prev => ({ ...prev, [metricId]: value }))
  }

  const saveAllTargets = async () => {
    if (!user) return
    setSaving(true)
    const rows = Object.entries(targetValues)
      .filter(([_, val]) => val !== null && val !== undefined)
      .map(([metricId, targetValue]) => ({
        client_id: selectedClientId,
        metric_id: metricId,
        target_type: targetType,
        period: period,
        target_value: Number(targetValue),
      }))

    const { error } = await supabase
      .from('targets')
      .upsert(rows, { onConflict: 'client_id,metric_id,target_type,period' })

    setSaving(false)
    if (error) { toast.error('Save failed: ' + error.message); return }
    toast.success('Targets saved successfully.')
  }

  // Load sales targets (client_id IS NULL)
  const loadSalesTargets = async (weekStart: string) => {
    const { data } = await supabase
      .from('targets')
      .select('metric_id, target_value')
      .is('client_id', null)
      .eq('target_type', 'weekly')
      .eq('period', weekStart)
      .in('metric_id', SALES_TARGET_METRIC_IDS)
    const map: Record<string, number> = {}
    data?.forEach(t => { if (t.target_value !== null) map[t.metric_id] = t.target_value })
    setSalesTargetValues(map)
  }

  const loadSalesActuals = async (weekStart: string) => {
    const { data } = await supabase
      .from('sales_weekly_data')
      .select('cold_email')
      .eq('week_start', weekStart)
      .maybeSingle()
    if (data?.cold_email) {
      const ce = data.cold_email as Record<string, any>
      const actuals: Record<string, number> = {}
      SALES_TARGET_METRIC_IDS.forEach(id => {
        const v = ce[id]
        if (v !== null && v !== undefined && !isNaN(Number(v))) actuals[id] = Number(v)
      })
      setSalesActuals(actuals)
    } else {
      setSalesActuals({})
    }
  }

  useEffect(() => {
    if (activeSection !== 'sales') return
    loadSalesTargets(selectedWeekStart)
    loadSalesActuals(selectedWeekStart)
  }, [activeSection, selectedWeekStart])

  const saveSalesTargets = async () => {
    setSalesSaving(true)
    try {
      // Delete existing, then insert fresh (avoids null upsert issues)
      await supabase.from('targets')
        .delete()
        .is('client_id', null)
        .eq('target_type', 'weekly')
        .eq('period', selectedWeekStart)
        .in('metric_id', SALES_TARGET_METRIC_IDS)

      const rows = Object.entries(salesTargetValues)
        .filter(([id]) => SALES_TARGET_METRIC_IDS.includes(id))
        .filter(([_, val]) => val !== null && val !== undefined)
        .map(([metricId, targetValue]) => ({
          client_id: null as string | null,
          metric_id: metricId,
          target_type: 'weekly',
          period: selectedWeekStart,
          target_value: Number(targetValue),
        }))

      if (rows.length > 0) {
        const { error } = await supabase.from('targets').insert(rows)
        if (error) throw error
      }
      toast.success('Sales targets saved.')
    } catch (e: any) {
      toast.error('Save failed: ' + e.message)
    } finally {
      setSalesSaving(false)
    }
  }

  const targetableMetrics = ALL_METRICS.filter(m => m.hasTarget)
  const targetableContent = targetableMetrics.filter(m => m.category === 'content')
  const targetableLeadGen = targetableMetrics.filter(m => m.category === 'leadgen')

  const renderSection = (title: string, metrics: Metric[]) => (
    <>
      <tr>
        <th colSpan={5} style={{
          background: '#F9F9F9',
          padding: '10px 8px',
          fontSize: '12px',
          fontWeight: '700',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '1px solid #E5E5E5'
        }}>
          {title}
        </th>
      </tr>
      {metrics.map(m => (
        <TargetRow
          key={m.id}
          metric={m}
          currentTarget={targetValues[m.id]}
          previousTarget={previousTargets[m.id]}
          mtdActual={mtdActuals[m.id]}
          onChange={handleTargetChange}
          targetType={targetType}
        />
      ))}
    </>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <h1 className="text-2xl font-black uppercase tracking-tight">Set Targets</h1>
        <div className="flex gap-1 border rounded-lg p-1 bg-muted/40">
          <button
            onClick={() => setActiveSection('client')}
            className={`px-4 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-all ${activeSection === 'client' ? 'bg-gold text-black shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >Client Metrics</button>
          <button
            onClick={() => setActiveSection('sales')}
            className={`px-4 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-all ${activeSection === 'sales' ? 'bg-gold text-black shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >Sales & Outreach</button>
        </div>
      </div>

      {/* ─── Sales & Outreach internal targets ─── */}
      {activeSection === 'sales' && (
        <div className="space-y-6">
          <Card className="p-6 bg-muted/20 border-none shadow-none">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-2 min-w-[260px]">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Week</Label>
                <Select value={selectedWeekStart} onValueChange={setSelectedWeekStart}>
                  <SelectTrigger className="bg-background font-bold h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {weekOptions.map(w => <SelectItem key={w.weekStart} value={w.weekStart}>{w.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground pb-2">
                These are internal weekly targets for the Cold Emailing section of Sales & Outreach.
              </p>
            </div>
          </Card>

          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FFC947' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>METRIC</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>THIS WEEK TARGET</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>THIS WEEK ACTUAL</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>ACH%</th>
                </tr>
              </thead>
              <tbody>
                {COLD_EMAIL_INTERNAL_METRICS.filter(m => !m.auto).map(m => {
                  const target = salesTargetValues[m.id]
                  const actual = salesActuals[m.id]
                  const ach = target && actual !== undefined ? Math.round((actual / target) * 100) : null
                  const achColor = ach === null ? '#999' : ach >= 100 ? '#3B82F6' : ach >= 70 ? '#22C55E' : ach >= 40 ? '#EAB308' : '#EF4444'
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '10px 8px', fontSize: '14px' }}>
                        {m.name}
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#bbb' }}>{m.id}</span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={target ?? ''}
                          placeholder="-"
                          onChange={e => setSalesTargetValues(prev => ({ ...prev, [m.id]: Number(e.target.value) }))}
                          style={{ width: '90px', padding: '6px 10px', border: '1px solid #E5E5E5', borderRadius: '6px', fontSize: '14px', fontWeight: '600', textAlign: 'right', outline: 'none' }}
                          onFocus={e => e.target.style.borderColor = '#FFC947'}
                          onBlur={e => e.target.style.borderColor = '#E5E5E5'}
                        />
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', fontSize: '14px' }}>{actual !== undefined ? actual : '-'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', fontSize: '13px', color: achColor }}>{ach !== null ? `${ach}%` : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #E5E5E5', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', zIndex: 10 }}>
              <span style={{ color: '#999', fontSize: '13px', alignSelf: 'center', fontWeight: '500' }}>
                {Object.keys(salesTargetValues).length} targets configured
              </span>
              <button
                onClick={saveSalesTargets}
                disabled={salesSaving}
                style={{ background: salesSaving ? '#E5E5E5' : '#FFC947', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 28px', fontWeight: '800', fontSize: '15px', cursor: salesSaving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px 0 rgba(255, 201, 71, 0.39)', transition: 'all 0.2s ease' }}
              >
                {salesSaving ? 'Saving...' : 'Save Sales Targets'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'client' && <><Card className="p-6 bg-muted/20 border-none shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Client</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="bg-background font-bold h-11">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} - {c.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Type</Label>
            <Tabs value={targetType} onValueChange={(v: any) => setTargetType(v)} className="w-full">
              <TabsList className="grid grid-cols-2 h-11 p-1 bg-background border">
                <TabsTrigger value="weekly" className="font-bold data-[state=active]:bg-gold data-[state=active]:text-black">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="font-bold data-[state=active]:bg-gold data-[state=active]:text-black">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Period</Label>
            {targetType === 'weekly' ? (
              <Select value={selectedWeekStart} onValueChange={setSelectedWeekStart}>
                <SelectTrigger className="bg-background font-bold h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map(w => (
                    <SelectItem key={w.weekStart} value={w.weekStart}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-background font-bold h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => (
                    <SelectItem key={m.period} value={m.period}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </Card>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FFC947' }}>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                METRIC
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {targetType === 'weekly' ? 'THIS WEEK TARGET' : 'THIS MONTH TARGET'}
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {targetType === 'weekly' ? 'LAST WEEK TARGET' : 'LAST MONTH TARGET'}
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {targetType === 'weekly' ? 'THIS WEEK ACTUAL' : 'MTD ACTUAL'}
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                ACH%
              </th>
            </tr>
          </thead>
          <tbody>
            {renderSection("Content Metrics", targetableContent)}
            {renderSection("Lead Gen Metrics", targetableLeadGen)}
          </tbody>
        </table>
        
        <div style={{
          position: 'sticky',
          bottom: 0,
          background: 'white',
          borderTop: '1px solid #E5E5E5',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          zIndex: 10
        }}>
          <span style={{ color: '#999', fontSize: '13px', alignSelf: 'center', fontWeight: '500' }}>
            {Object.keys(targetValues).length} targets configured
          </span>
          <button
            onClick={saveAllTargets}
            disabled={saving || !selectedClientId}
            style={{
              background: saving ? '#E5E5E5' : '#FFC947',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 28px',
              fontWeight: '800',
              fontSize: '15px',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px 0 rgba(255, 201, 71, 0.39)',
              transition: 'all 0.2s ease'
            }}
          >
            {saving ? 'Saving...' : 'Save All Targets'}
          </button>
        </div>
      </div>
      </>}
    </div>
  )
}
