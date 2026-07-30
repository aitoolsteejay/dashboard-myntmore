export function sortAlphabetically<T>(
  items: readonly T[],
  getLabel: (item: T) => string | null | undefined,
): T[] {
  return [...items].sort((a, b) =>
    (getLabel(a) ?? '').localeCompare(getLabel(b) ?? '', undefined, {
      sensitivity: 'base',
      numeric: true,
    }),
  )
}
