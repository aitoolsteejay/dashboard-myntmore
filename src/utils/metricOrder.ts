import type { Metric } from '@/data/metrics'

// One display order for a client's metrics, shared by Data Entry and the Dashboard:
// the catalogue order, with each (category, group) kept together. A custom metric
// that names an existing group therefore sits inside that group on both sides
// instead of trailing at the end of the list on one of them.
export function orderMetricsByGroup<T extends Pick<Metric, 'category' | 'group'>>(metrics: T[]): T[] {
  const order = new Map<string, number>()
  metrics.forEach(m => {
    const key = `${m.category}|${m.group}`
    if (!order.has(key)) order.set(key, order.size)
  })
  return metrics
    .map((m, index) => ({ m, index, rank: order.get(`${m.category}|${m.group}`) ?? 0 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(item => item.m)
}
