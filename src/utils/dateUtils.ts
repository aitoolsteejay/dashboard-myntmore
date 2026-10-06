// The team's own calendar day, as a "YYYY-MM-DD" string. `new Date().toISOString().slice(0,10)`
// gives the UTC calendar day instead, which lags IST (+5:30) by a full day for the first
// ~5.5 hours of every IST day — an "overdue as of today" or "is this the current month"
// check built on that lags reality for that whole window. en-CA's date format is already
// "YYYY-MM-DD", so no manual reformatting is needed.
export function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// A Date whose UTC getters (getUTCDay/getUTCMonth/...) read the team's IST wall
// clock instead of UTC. "Now" built from `new Date()` + UTC getters is a day
// (or month) behind for the first ~5.5 hours of every IST day; this lets the
// existing all-UTC calendar maths keep working unchanged on IST "now".
export function nowAsIST(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
}

export function formatWeekDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    // A bare "YYYY-MM-DD" string parses as UTC midnight, but getDate()/getMonth()/
    // getFullYear() below read it back in local time — for any viewer west of
    // UTC that silently rolls the displayed date back by one day. Force local-
    // time parsing instead so the getters below read back what was stored.
    const d = new Date(dateStr + 'T00:00:00')
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}
