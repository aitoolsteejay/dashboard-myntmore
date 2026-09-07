import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  CompanyMetric,
  TJ_INSTAGRAM_METRICS,
  TJ_YOUTUBE_METRICS,
  TJ_PODCAST_METRICS,
  TJ_VIDEO_METRICS,
} from '@/data/company_metrics'

export interface EffectiveTjMetrics {
  instagram: CompanyMetric[]
  youtube: CompanyMetric[]
  newsletter: CompanyMetric[] // sourced from channel 'email_newsletter'
  video: CompanyMetric[] // sourced from channel 'video_pipeline'
}

const EMPTY_EFFECTIVE_TJ_METRICS: EffectiveTjMetrics = {
  instagram: TJ_INSTAGRAM_METRICS,
  youtube: TJ_YOUTUBE_METRICS,
  newsletter: TJ_PODCAST_METRICS,
  video: TJ_VIDEO_METRICS,
}

// DB channel value -> EffectiveTjMetrics bucket key. Note the one deliberate
// naming mismatch: the 'email_newsletter' channel (matching tj_weekly_data's
// column and tj_channel_assignments.channel) is exposed here as `newsletter`
// to match TJBrandPage.tsx's internal 'newsletter_podcast' form-section
// naming — see the comment there for the full explanation.
const CHANNEL_TO_BUCKET: Record<string, keyof EffectiveTjMetrics> = {
  instagram: 'instagram',
  youtube: 'youtube',
  email_newsletter: 'newsletter',
  video_pipeline: 'video',
}

export function tjCustomMetricToCompanyMetric(row: Record<string, any>): CompanyMetric {
  return {
    id: row.metric_key,
    name: row.name,
    type: row.type,
    hasTarget: !!row.has_target,
    unit: row.unit ?? undefined,
  }
}

/**
 * TJ Personal Brand's effective metric lists: the fixed static catalog per
 * channel plus any non-archived custom metrics for that channel. There's
 * only one TJ entity company-wide (no client_id to scope by), so unlike
 * fetchEffectiveMetrics there's no per-entity fan-out variant needed.
 */
export async function fetchEffectiveTjMetrics(): Promise<EffectiveTjMetrics> {
  const { data, error } = await supabase
    .from('tj_custom_metrics')
    .select('*')
    .eq('archived', false)
    .order('sort_order', { ascending: true })
  if (error) throw error

  const byBucket: Record<keyof EffectiveTjMetrics, CompanyMetric[]> = {
    instagram: [],
    youtube: [],
    newsletter: [],
    video: [],
  }
  ;(data ?? []).forEach(row => {
    const bucket = CHANNEL_TO_BUCKET[row.channel]
    if (bucket) byBucket[bucket].push(tjCustomMetricToCompanyMetric(row))
  })

  return {
    instagram: [...TJ_INSTAGRAM_METRICS, ...byBucket.instagram],
    youtube: [...TJ_YOUTUBE_METRICS, ...byBucket.youtube],
    newsletter: [...TJ_PODCAST_METRICS, ...byBucket.newsletter],
    video: [...TJ_VIDEO_METRICS, ...byBucket.video],
  }
}

export function useEffectiveTjMetrics(): EffectiveTjMetrics {
  const [metrics, setMetrics] = useState<EffectiveTjMetrics>(EMPTY_EFFECTIVE_TJ_METRICS)

  useEffect(() => {
    let cancelled = false
    fetchEffectiveTjMetrics()
      .then(result => { if (!cancelled) setMetrics(result) })
      .catch(error => { console.error('Failed to load TJ custom metrics:', error) })
    return () => { cancelled = true }
  }, [])

  return metrics
}
