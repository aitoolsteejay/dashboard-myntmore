// How a metric behaves when it is rolled up across weeks, and whether a bigger
// number is actually "better". Kept in one place so every aggregator (month
// to date, best-ever month, reports) agrees — a per-file hardcoded list is
// exactly how these drifted apart before.

// Running totals / point-in-time snapshots: a month's value is the LATEST
// week's reading (the max, for best-ever), never the sum — summing four weeks
// of "10,000 followers" is not 40,000 followers.
export const CUMULATIVE_METRIC_IDS: ReadonlySet<string> = new Set([
  // per client
  'C16', 'C32', 'C41',
  // TJ Personal Brand: Total Follower Count, Total Subscribers
  'TJI11', 'TJY07',
  // MM Company Content: Total Followers (LinkedIn / Instagram)
  'MML06', 'MMI08',
  // MM SEO weekly snapshots (queries in top 10, city pages on page 1,
  // indexed / submitted pages, AI citation rate)
  'MMS04', 'MMS05', 'MMS06', 'MMS07', 'MMS11',
])

// Plain number-type fields that are per-week averages/ratios rather than
// counts, so a month's value is the average of its weeks, not the sum.
export const AVERAGED_NUMBER_IDS: ReadonlySet<string> = new Set([
  'MMA09', 'MMA10', // ads cost per lead
  'MMW03',          // average session duration
])

// Metrics where a LOWER value is the good outcome, so a "new high" is not a
// celebration (more negative replies, a higher bounce rate, more spend...).
// They still keep their Best Ever columns, but never get the ★ or the
// "new record" toast.
export const LOWER_IS_BETTER_METRIC_IDS: ReadonlySet<string> = new Set([
  'L04', 'L16', 'L18', 'C40',
  'TJP13',
  'MMA04', 'MMA06', 'MMA09', 'MMA10', 'MMW04',
  'SO08', 'SO17', 'SO28', 'SO34', 'SO42',
])

// Rolls a list of per-week readings (oldest first, blanks already removed) up
// to one "Total" for a reports table: a running total is the latest reading,
// a per-post ratio (C26) is the mean (summing ratios means nothing), and
// everything else is a plain sum.
export function periodTotal(metricId: string, values: number[]): number {
  if (values.length === 0) return 0
  if (CUMULATIVE_METRIC_IDS.has(metricId)) return values[values.length - 1]
  const sum = values.reduce((a, b) => a + b, 0)
  return metricId === 'C26' ? sum / values.length : sum
}
