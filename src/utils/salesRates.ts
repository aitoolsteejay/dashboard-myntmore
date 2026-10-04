// Sales & Outreach rate fields are persisted per week (see DERIVED_FIELDS in
// SalesPage.tsx) as numerator/denominator ratios. Any multi-week aggregate
// must recompute them from the summed raw fields — summing the weekly rates
// themselves (the previous behavior) reads far above 100% for a month.
// Ids are unique across sections, so one flat map covers all of them.
export const SALES_RATE_DEPENDENCIES: Record<string, [string, string]> = {
  SO04: ['SO03', 'SO02'],
  SO06: ['SO05', 'SO03'],
  SO13: ['SO12', 'SO11'],
  SO15: ['SO14', 'SO12'],
  SO21: ['SO20', 'SO19'],
  SO24: ['SO23', 'SO22'],
  SO26: ['SO25', 'SO23'],
  SO31: ['SO30', 'SO29'],
  SO35: ['SO32', 'SO29'],
  SO52: ['SO51', 'SO50'],
  SO54: ['SO53', 'SO51'],
  SO43: ['SO41', 'SO40'],
  SO47: ['SO46', 'SO40'],
}

// Mutates and returns `totals` (a summed section): replaces each rate with
// numerator/denominator from the summed raw fields. Same rounding as the
// per-week getRate (1 decimal, 0 when the denominator is 0).
export function applySalesRates(totals: Record<string, number>): Record<string, number> {
  for (const [rateId, [numId, denId]] of Object.entries(SALES_RATE_DEPENDENCIES)) {
    if (totals[numId] === undefined && totals[denId] === undefined) continue
    const num = totals[numId] ?? 0
    const den = totals[denId] ?? 0
    totals[rateId] = den > 0 ? Math.round((num / den) * 1000) / 10 : 0
  }
  // Average deal size summed across weeks is meaningless; derive it from
  // total revenue (SO49) / total conversions (SO46) instead.
  if (totals.SO48 !== undefined) {
    if ((totals.SO46 ?? 0) > 0 && totals.SO49 !== undefined) {
      totals.SO48 = Math.round(totals.SO49 / totals.SO46)
    } else {
      delete totals.SO48
    }
  }
  return totals
}
