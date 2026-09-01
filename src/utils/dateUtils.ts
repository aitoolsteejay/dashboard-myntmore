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
