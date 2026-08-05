import Papa from 'papaparse'

const REQUIRED_COLUMNS = [
  'connectionRequestDate',
  'connectedAt',
  'lastReplyDetectedDate',
] as const

type WaalaxyRow = Record<string, string | undefined>

export type WaalaxyImportSummary = {
  conn_requests_sent: number
  accepted: number
  answered: number
  totalRows: number
  skippedRows: number
}

function isInWeek(value: string | undefined, weekStart: string, weekEnd: string) {
  if (!value?.trim()) return false
  const date = value.trim().slice(0, 10)
  return date >= weekStart && date <= weekEnd
}

export function parseWaalaxyExport(
  csvText: string,
  weekStart: string,
  weekEnd: string,
): WaalaxyImportSummary {
  const parsed = Papa.parse<WaalaxyRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const fields = parsed.meta.fields ?? []
  const missingColumns = REQUIRED_COLUMNS.filter(column => !fields.includes(column))
  if (missingColumns.length > 0) {
    throw new Error(
      `This doesn't look like a Waalaxy export. Missing required column${missingColumns.length === 1 ? '' : 's'}: ${missingColumns.join(', ')}.`,
    )
  }

  if (!fields.includes('linkedinUrl')) {
    throw new Error("This doesn't look like a Waalaxy export. Missing required column: linkedinUrl.")
  }

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0]
    throw new Error(`The Waalaxy CSV could not be parsed${firstError.row !== undefined ? ` near row ${firstError.row + 2}` : ''}: ${firstError.message}`)
  }

  let connRequestsSent = 0
  let accepted = 0
  let answered = 0
  let totalRows = 0
  let skippedRows = 0

  for (const row of parsed.data) {
    if (!row.linkedinUrl?.trim()) {
      skippedRows += 1
      continue
    }

    totalRows += 1
    if (isInWeek(row.connectionRequestDate, weekStart, weekEnd)) connRequestsSent += 1
    if (isInWeek(row.connectedAt, weekStart, weekEnd)) accepted += 1
    if (isInWeek(row.lastReplyDetectedDate, weekStart, weekEnd)) answered += 1
  }

  return {
    conn_requests_sent: connRequestsSent,
    accepted,
    answered,
    totalRows,
    skippedRows,
  }
}
