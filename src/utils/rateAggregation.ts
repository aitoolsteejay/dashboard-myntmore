import { readNum, calcRateCapped } from './readMetric'

// Every auto-computed rate metric's [numerator, denominator] raw field pair,
// mirroring their autoFormula in src/data/metrics.ts. A rate metric can never
// be correctly summed or averaged across weeks directly — two weeks at 50%
// and 10% do NOT average to "the rate for both weeks combined" unless the
// underlying volumes happen to be equal. The only correct way to combine them
// is to sum each week's raw numerator and denominator first, then compute one
// rate from those totals. (C26 "Avg Impressions Per Post" is a similar ratio
// but isn't a percentage/autoFormula-in-this-shape metric, so it's handled
// separately wherever it's aggregated.)
export const RATE_DEPENDENCIES: Record<string, [string, string]> = {
  L05: ['L03', 'L02'],
  L12: ['L11', 'L10'],
  L14: ['L13', 'L11'],
  L17: ['L15', 'L13'],
  L18: ['L16', 'L13'],
  L21: ['L20', 'L19'],
  L26: ['L25', 'L24'],
}

/**
 * Sums the raw numerator/denominator fields for a rate metric across a set of
 * weekly_data-shaped rows and computes ONE volume-weighted rate, instead of
 * averaging each week's already-computed rate. Returns null if the metric
 * isn't a known rate, or if no row in `rows` had either field populated.
 */
export function computeVolumeWeightedRate(
  rows: Array<{ content_metrics?: any; leadgen_metrics?: any }>,
  metricId: string,
  category: 'content' | 'leadgen',
): number | null {
  const deps = RATE_DEPENDENCIES[metricId]
  if (!deps) return null
  const [numId, denId] = deps

  let numSum = 0
  let denSum = 0
  let any = false
  for (const row of rows) {
    const col = category === 'content' ? row.content_metrics : row.leadgen_metrics
    const n = readNum(col, numId)
    const d = readNum(col, denId)
    if (n !== null) { numSum += n; any = true }
    if (d !== null) { denSum += d; any = true }
  }
  if (!any) return null
  return calcRateCapped(numSum, denSum) ?? 0
}
