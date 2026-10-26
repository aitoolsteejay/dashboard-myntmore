// PostgREST returns at most 1000 rows per request, and silently drops the rest. Anything that can
// grow past that (weekly targets re-saved every week, high scores...) is read in ordered pages.
// Resolves to the same { data, error } shape a plain select does, so it drops into existing code.
export async function pagedSelect<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<{ data: T[]; error: any }> {
  const pageSize = 1000
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}
