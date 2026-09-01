import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { CONTENT_METRICS, LEADGEN_METRICS, Metric } from '@/data/metrics'
import { assertClientRows } from '@/utils/clientScope'

export interface EffectiveMetrics {
  all: Metric[]
  content: Metric[]
  leadgen: Metric[]
}

const EMPTY_EFFECTIVE_METRICS: EffectiveMetrics = {
  all: [...CONTENT_METRICS, ...LEADGEN_METRICS],
  content: CONTENT_METRICS,
  leadgen: LEADGEN_METRICS,
}

export function customMetricToMetric(row: Record<string, any>): Metric {
  return {
    id: row.metric_key,
    name: row.name,
    type: row.type,
    category: row.category,
    group: row.group,
    hasTarget: !!row.has_target,
    hasNote: !!row.has_note,
    unit: row.unit ?? undefined,
  }
}

/**
 * A client's effective metric list: the shared global catalog plus that
 * client's own (non-archived) custom metrics. Never mutates CONTENT_METRICS/
 * LEADGEN_METRICS — always returns a fresh merged array so callers that used
 * to import those constants directly can swap in this per-client result with
 * no other code changes.
 */
export async function fetchEffectiveMetrics(clientId: string | null | undefined): Promise<EffectiveMetrics> {
  if (!clientId) return EMPTY_EFFECTIVE_METRICS

  const { data, error } = await supabase
    .from('custom_metrics')
    .select('*')
    .eq('client_id', clientId)
    .eq('archived', false)
    .order('sort_order', { ascending: true })
  if (error) throw error

  // Defense-in-depth, matching every other client-portal-facing fetch (see
  // src/utils/clientScope.ts) — RLS already scopes this, but a second check
  // client-side catches a scoping regression before it ever renders.
  const custom = assertClientRows(data, clientId, 'custom metrics').map(customMetricToMetric)
  const content = [...CONTENT_METRICS, ...custom.filter(m => m.category === 'content')]
  const leadgen = [...LEADGEN_METRICS, ...custom.filter(m => m.category === 'leadgen')]
  return { all: [...content, ...leadgen], content, leadgen }
}

/**
 * Same per-client custom metrics, but for MANY clients at once — used by
 * screens (the main dashboard's client list) that would otherwise need one
 * fetch per client. Returns a map of clientId -> that client's custom metrics
 * merged with the shared catalog.
 */
export async function fetchEffectiveMetricsForClients(
  clientIds: string[]
): Promise<Record<string, EffectiveMetrics>> {
  const map: Record<string, EffectiveMetrics> = {}
  if (clientIds.length === 0) return map

  const { data, error } = await supabase
    .from('custom_metrics')
    .select('*')
    .in('client_id', clientIds)
    .eq('archived', false)
    .order('sort_order', { ascending: true })
  if (error) throw error

  const byClient: Record<string, Metric[]> = {}
  ;(data ?? []).forEach(row => {
    if (!byClient[row.client_id]) byClient[row.client_id] = []
    byClient[row.client_id].push(customMetricToMetric(row))
  })

  clientIds.forEach(clientId => {
    const custom = byClient[clientId] ?? []
    const content = [...CONTENT_METRICS, ...custom.filter(m => m.category === 'content')]
    const leadgen = [...LEADGEN_METRICS, ...custom.filter(m => m.category === 'leadgen')]
    map[clientId] = { all: [...content, ...leadgen], content, leadgen }
  })
  return map
}

export function useEffectiveMetrics(clientId: string | null | undefined): EffectiveMetrics {
  const [metrics, setMetrics] = useState<EffectiveMetrics>(EMPTY_EFFECTIVE_METRICS)

  useEffect(() => {
    let cancelled = false
    if (!clientId) {
      setMetrics(EMPTY_EFFECTIVE_METRICS)
      return
    }
    fetchEffectiveMetrics(clientId)
      .then(result => { if (!cancelled) setMetrics(result) })
      .catch(error => { console.error('Failed to load custom metrics:', error) })
    return () => { cancelled = true }
  }, [clientId])

  return metrics
}
