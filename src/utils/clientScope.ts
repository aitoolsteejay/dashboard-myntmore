export function assertClientRows<T extends { client_id?: string | null }>(
  rows: T[] | null | undefined,
  expectedClientId: string,
  source: string,
): T[] {
  const safeRows = rows || []
  const mismatch = safeRows.find(row => row.client_id !== expectedClientId)
  if (mismatch) {
    console.error(`Client isolation blocked a mismatched ${source} response.`)
    throw new Error('Client data isolation check failed. No data was displayed.')
  }
  return safeRows
}

export function assertClientRow<T extends { client_id?: string | null }>(
  row: T | null | undefined,
  expectedClientId: string,
  source: string,
): T | null {
  if (!row) return null
  assertClientRows([row], expectedClientId, source)
  return row
}
