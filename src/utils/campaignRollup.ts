export type CampaignRollupTotals = {
  connRequestsSent: number
  accepted: number
  answered: number
  positiveReplies: number
  negativeReplies: number
  meetingsBooked: number
}

// This is intentionally an allowlist. Client-level outreach, qualitative fields,
// notes, and every other manually entered metric must survive a campaign rollup.
export const CAMPAIGN_ROLLUP_METRIC_IDS = ['L10', 'L11', 'L13', 'L15', 'L16', 'L24'] as const

export function mergeCampaignRollupMetrics(
  current: Record<string, any>,
  totals: CampaignRollupTotals,
): Record<string, any> {
  const values: Record<(typeof CAMPAIGN_ROLLUP_METRIC_IDS)[number], number> = {
    L10: totals.connRequestsSent,
    L11: totals.accepted,
    L13: totals.answered,
    L15: totals.positiveReplies,
    L16: totals.negativeReplies,
    L24: totals.meetingsBooked,
  }

  const merged = { ...current }
  CAMPAIGN_ROLLUP_METRIC_IDS.forEach(metricId => {
    merged[metricId] = {
      ...(typeof current[metricId] === 'object' && current[metricId] !== null ? current[metricId] : {}),
      value: values[metricId],
    }
  })
  return merged
}
