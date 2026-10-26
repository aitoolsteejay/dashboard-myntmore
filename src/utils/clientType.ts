// Internal clients are Myntmore's own (Enwil, Tejas Jhaveri); everyone else is external.
// Stored in clients.client_type — a row from before that column existed has no value and
// counts as external.
export type ClientType = 'internal' | 'external'

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  internal: 'Internal Clients',
  external: 'External Clients',
}

export function getClientType(client: { client_type?: string | null } | null | undefined): ClientType {
  return client?.client_type === 'internal' ? 'internal' : 'external'
}

// External first, internal below, keeping the incoming (alphabetical) order inside each group.
export function sortByClientType<T extends { client_type?: string | null }>(clients: T[]): T[] {
  const rank = (c: T) => (getClientType(c) === 'internal' ? 1 : 0)
  return clients
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(x => x.c)
}
