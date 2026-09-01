export function getWeeksInSameMonth(selectedWeekStart: string) {
  const selected = new Date(selectedWeekStart + 'T00:00:00Z')
  const year = selected.getUTCFullYear()
  const month = selected.getUTCMonth()
  // Absolute month ordinal — comparing year/month as two separate fields broke
  // for January, since a cursor sitting in December of the PRIOR year has a
  // raw month index (11) greater than January's (0) even though it's earlier;
  // this silently returned zero weeks for almost every January.
  const targetOrdinal = year * 12 + month

  const weeks: { weekStart: string; shortLabel: string; isSelected: boolean }[] = []

  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const firstDow = firstOfMonth.getUTCDay()
  const daysBack = firstDow === 0 ? 6 : firstDow - 1
  const cursor = new Date(firstOfMonth)
  cursor.setUTCDate(firstOfMonth.getUTCDate() - daysBack)

  while (true) {
    const cursorOrdinal = cursor.getUTCFullYear() * 12 + cursor.getUTCMonth()
    const startsInMonth = cursorOrdinal === targetOrdinal

    // A week belongs only to the month containing its Monday. Do not include a
    // July week in August merely because its Sunday falls in August.
    if (!startsInMonth) {
      if (cursorOrdinal > targetOrdinal) break
      cursor.setUTCDate(cursor.getUTCDate() + 7)
      continue
    }

    const ws = cursor.toISOString().split('T')[0]
    weeks.push({
      weekStart: ws,
      shortLabel: cursor.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      isSelected: ws === selectedWeekStart,
    })

    cursor.setUTCDate(cursor.getUTCDate() + 7)
    if (cursor.getUTCFullYear() * 12 + cursor.getUTCMonth() > targetOrdinal) break
  }

  return weeks
}

export function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().split('T')[0]
}

export function getWeekLabel(weekStart: string): string {
  const monday = new Date(weekStart + 'T00:00:00Z')
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const fmtShort = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const fmtFull = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${fmtShort(monday)} – ${fmtFull(sunday)}`
}

function getMondayStart(now: Date, offsetWeeks = 0): string {
  const day = now.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday - (offsetWeeks * 7))
  return monday.toISOString().split('T')[0]
}

export function getCurrentWeekStart(now = new Date()): string {
  return getMondayStart(now)
}

export function getPreviousWeekStart(now = new Date()): string {
  return getMondayStart(now, 1)
}

export function getWeekOptions(count = 12, now = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    // Reporting always starts with the most recently completed Monday–Sunday week.
    const weekStart = getMondayStart(now, i + 1)
    return {
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      label: getWeekLabel(weekStart),
    }
  })
}

export function isLastWeekOfMonth(weekStart: string): boolean {
  const monday = new Date(weekStart + 'T00:00:00Z')
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  // Last week if Sunday falls in the same month or the next Monday would be in the next month
  const nextMonday = new Date(monday)
  nextMonday.setUTCDate(monday.getUTCDate() + 7)
  return nextMonday.getUTCMonth() !== monday.getUTCMonth() || nextMonday.getUTCFullYear() !== monday.getUTCFullYear()
}

export function getWeekStart(offsetWeeks: number, now = new Date()): string {
  return getMondayStart(now, offsetWeeks)
}


export function getWeekValue(date: Date = new Date()): string {
  const d = new Date(date)
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = (d.getTime() - startOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}
