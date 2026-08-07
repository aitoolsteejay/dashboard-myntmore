# Architecture

## System overview

```text
Browser
  └─ React 19 + TanStack Router + TanStack Query
       ├─ Supabase Auth (session and identity)
       ├─ Supabase Data API, schema: myntmore
       │    └─ PostgreSQL RLS (final authorization boundary)
       └─ Supabase Edge Function
            └─ privileged account creation/password operations

GitHub (aitoolsteejay/dashboard-myntmore)
  └─ Vercel production deployment
```

The application is a Vite single-page app. `vercel.json` rewrites browser routes to `index.html`. TanStack Router discovers files under `src/routes/` and generates `src/routeTree.gen.ts`.

## Important directories

| Path | Responsibility |
| --- | --- |
| `src/routes/` | Route definitions and `beforeLoad` authorization guards |
| `src/components/` | Page and reusable UI components, grouped by feature |
| `src/data/metrics.ts` | Current metric definitions used by data entry/dashboard flows |
| `src/hooks/` | Data hooks and autosave behavior |
| `src/lib/auth.tsx` | Session, profile, role, and client identity state |
| `src/lib/workspace.tsx` | Selected reporting week shared across the app |
| `src/utils/routeGuards.ts` | Internal/admin route guards |
| `src/integrations/supabase/` | Supabase browser client and generated database types |
| `supabase/` | SQL migrations, RLS hardening, integrity rules, and Edge Functions |

## Application boot and state

`src/main.tsx` creates the router and mounts React. It also detects stale JavaScript chunks after a deployment and reloads once, preventing an old open tab from becoming a blank page.

The root route installs:

- TanStack Query for server-state fetching and invalidation.
- `AuthProvider` for the logged-in user, profile, role, and client mapping.
- `WorkspaceProvider` for the selected week. The choice is stored under `myntmore.workspace.v1` in browser local storage.
- The global sidebar, top bar, and toast system.

## Roles and access

| Role | Intended access |
| --- | --- |
| Admin | All internal features, settings, user management, and finance |
| Member | Operational dashboard/data for assigned work; no admin-only settings or finance |
| Client account | Stored as a member-compatible Auth role, identified as client-facing by profile department/client linkage; portal-only access |
| Disabled | No usable dashboard access; session is rejected/signed out |

`requireInternalUser` protects operational routes and `requireAdmin` protects administrative routes. Client portal accounts currently share the member role value, so `profiles.department = 'client'` and the linked `clients.user_id` distinguish them from internal members. The root layout also redirects signed-out users to login and client-only users to the portal.

These checks improve navigation and user experience. Supabase RLS remains the security boundary. Any new table must enable RLS and receive explicit admin/member/client policies before it is used by the browser.

## Data flow

1. A route/page gets the authenticated identity and selected week.
2. Its query filters records by week and, for client-owned data, by `client_id`.
3. TanStack Query caches the result using a key that must include every scoping value, especially client and week.
4. Edits are written through the Supabase browser client and the relevant queries are invalidated/refetched.
5. PostgreSQL RLS verifies that the authenticated user can access the row.

Never reuse a cache key across clients. Never fetch a client-owned table without a client filter simply because the UI currently shows one client.

## Weekly metrics

Most client weekly metrics live in `weekly_data`:

- `content_metrics`: JSON object keyed by metric codes such as `Cxx`.
- `leadgen_metrics`: JSON object keyed by metric codes such as `Lxx`.

The active UI definitions are in `src/data/metrics.ts`. Automatic/derived metrics are resolved by `resolveAutoCalc`; totals and averages should be calculated from stored source fields, not stored as a second conflicting source of truth.

There is also a parallel `src/lib/metrics.ts`. Treat it as legacy/parallel code: search imports before changing a metric and do not assume that modifying one file updates every screen. Consolidating these definitions is technical debt worth addressing separately.

## Campaign data and leakage prevention

`campaigns` owns campaign identity and `campaign_weekly_data` stores weekly campaign values. Weekly rows contain both `campaign_id` and `client_id`.

Protection is deliberately redundant:

- Frontend reads and writes scope by client.
- `campaign_weekly_data.client_id` is derived/validated against the parent campaign by `supabase/campaign_client_integrity.sql`.
- RLS restricts rows to the correct internal or client identity.
- Autosave queues retain the client and week that created the save, so switching screens cannot apply a pending value to another client.

Do not weaken any of these controls.

## Waalaxy import

Campaign weekly entry supports manual editing and CSV prefill. `src/utils/waalaxyImport.ts` parses a per-prospect Waalaxy export, validates its columns, and counts request, acceptance, and reply dates inside the selected inclusive week. Import only fills those fields; the user reviews the result, completes qualitative fields manually, and clicks Save. The CSV is processed in the browser and is not uploaded as a file.

## Privileged account operations

The browser publishable key cannot safely create or alter arbitrary Auth users. `supabase/functions/create-portal-user/index.ts` performs invite acceptance, portal-account creation, and administrator password resets. It validates the caller and keeps the service-role credential server-side.
