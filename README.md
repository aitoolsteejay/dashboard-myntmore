# Myntmore Command Center

Myntmore Command Center is the internal operations dashboard and client portal for Myntmore, a LinkedIn growth / lead-generation agency. It is the single system of record for weekly delivery across content production, lead-generation outreach, campaigns, targets, actionables, sales, company brand channels, and client-facing reporting.

- **Production:** [dashboard.myntmore.com](https://dashboard.myntmore.com)
- **Repository:** [aitoolsteejay/dashboard-myntmore](https://github.com/aitoolsteejay/dashboard-myntmore)
- **Admin contact:** Sanyam (sanyam@myntmore.com)

This README is intentionally exhaustive. It is meant to let a new engineer (or an AI agent) go from zero context to being able to safely ship a change without needing to reverse-engineer the domain model from scratch.

---

## Table of contents

1. [What the application does](#what-the-application-does)
2. [Technology stack](#technology-stack)
3. [Local setup](#local-setup)
4. [NPM scripts](#npm-scripts)
5. [Project structure](#project-structure)
6. [Routing](#routing)
7. [Domain model](#domain-model)
   - [Roles and identities](#roles-and-identities)
   - [Clients and services](#clients-and-services)
   - [The weekly/monthly cadence](#the-weeklymonthly-cadence)
   - [The metrics system](#the-metrics-system)
   - [Targets](#targets)
   - [High scores](#high-scores)
8. [Feature walkthrough](#feature-walkthrough)
9. [Database schema](#database-schema)
10. [Row Level Security (RLS) model](#row-level-security-rls-model)
11. [Critical conventions and gotchas](#critical-conventions-and-gotchas)
12. [How to add a new metric](#how-to-add-a-new-metric)
13. [Exports](#exports)
14. [Deployment](#deployment)
15. [Troubleshooting](#troubleshooting)
16. [Contribution checklist](#contribution-checklist)

---

## What the application does

- Captures weekly content and lead-generation metrics per client, with autosave, note fields, and target tracking.
- Compares weekly and monthly actuals against admin-configured targets, with an achievement-percentage ("ACH%") color scale used consistently everywhere in the app.
- Shows a company-wide dashboard: per-client summary rows, expandable weekly breakdowns, month-to-date aggregates, lifetime high scores ("Best Ever Week"/"Best Ever Month"), and birthday/anniversary reminders.
- Tracks LinkedIn campaigns (via Waalaxy CSV import or manual entry), campaign weeks, and campaign-level targets.
- Tracks TJ's personal brand (Instagram, YouTube, Email Newsletter, LinkedIn Newsletter, Video Pipeline) as its own company-wide entity, separate from any individual client.
- Tracks Myntmore's own company content and marketing presence (LinkedIn, Instagram, Website + SEO, Quora/Reddit/Medium, Google/Meta Ads).
- Provides a locked-down client portal: clients see their own weekly/monthly performance, campaigns, and action plan, and can update their own action items, but never see internal-only data or other clients' data.
- Manages actionables (internal + client-visible tasks), internal processes with weekly status updates, sales & outreach tracking, and finance data.
- Generates spreadsheet exports (lifetime export, weekly summary, EOM reports) directly from the same operational data used on-screen, so exports never drift from what the dashboard shows.
- Supports admin-defined **custom metrics** per client and for TJ's personal brand, so new fields can be added without a code deploy.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7 |
| Routing | TanStack Router (file-based, code-generated route tree) |
| Data & auth | Supabase (Postgres + Auth), accessed directly from the browser with a publishable key |
| Styling | Tailwind CSS 4, Radix UI primitives (shadcn-style components in `src/components/ui/`) |
| Charts | Recharts |
| Forms & validation | React Hook Form, Zod |
| Drag & drop | `@dnd-kit` (used for the Actionables kanban board) |
| Spreadsheet export | `write-excel-file` |
| Hosting | Vercel, deployed from `main` |

The browser talks **directly** to Supabase using a publishable (anon) key — there is no application server in the request path for reads/writes. This means **Supabase Row Level Security (RLS) is the actual security boundary**, not React route guards or hidden navigation. Every new table needs an explicit RLS policy before it can safely hold real data; frontend-only gating (e.g. `{isAdmin && <Button>...}`) is a UX nicety, not a security control, and this codebase has had to retroactively patch several tables where RLS was broader than the UI implied.

## Local setup

Requirements:
- Node.js 20+
- npm
- Access to the Myntmore Supabase project for live data
- Supabase CLI only if you need to test/apply database changes locally

```bash
git clone git@github.com:aitoolsteejay/dashboard-myntmore.git
cd dashboard-myntmore
npm install
cp .env.example .env.local
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`).

Configure `.env.local` with **browser-safe** Supabase credentials:

```dotenv
VITE_MYNTMORE_SUPABASE_URL=https://your-project.supabase.co
VITE_MYNTMORE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Both variables are consumed in `src/integrations/supabase/client.ts`. **Never** put a Supabase service-role key in a `VITE_` variable — Vite embeds every `VITE_`-prefixed variable directly into the browser bundle. Service-role credentials only belong in Supabase Edge Functions (see `supabase/functions/create-portal-user`), which run server-side.

## NPM scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run typecheck` | Run `tsc --noEmit` (no build output) |
| `npm run build` | Production build into `dist/` |
| `npm run check` | `typecheck` then `build` — run this before every push |
| `npm run preview` | Serve the production build locally |

There is currently no automated test suite. Correctness is verified via `npm run check` plus manual verification of the affected screen(s) — see [Contribution checklist](#contribution-checklist).

## Project structure

```
src/
  routes/                  Thin TanStack Router route files — most just render a page component
  components/
    dashboard/              Main company dashboard (DashboardPage.tsx — the largest file in the app)
    data-entry/              Weekly data entry for per-client content/leadgen metrics
    clients/                 Client CRUD (list, detail, create/edit modal)
    portal/                  Client-facing portal (ClientPortalPage, ClientActionPlan, campaigns view)
    monthly/                 Monthly progress / targets-vs-actuals page (MonthlyProgressPage)
    leaderboard/             Client leaderboard
    high-scores/             Lifetime high-scores page
    reports/                 Reports page
    sales/                   Sales & Outreach data entry
    settings/                Settings area: Team, Targets, Export, Client Settings, Metric Fields,
                              TJ Channel Assignments — see below
    tj-brand/                TJ Personal Brand data entry (TJBrandPage.tsx)
    mm/                      MM Company Content data entry (MMContentPage.tsx)
    monday/                  Campaign/Monday-style board components (EditCampaignModal, CampaignMonthTable, etc.)
    actionables/             Actionables kanban + table (ActionablesPage.tsx)
    processes/               Internal processes tracker
    finance/                 Finance data entry
    auth/                    Login, invite-acceptance flows
    ui/                      Radix-based shared primitives (button, card, table, dialog, select, switch, ...)
    AppSidebar.tsx           Left nav
    AppTopbar.tsx            Top bar: week selector, command palette, notification/overdue badges
    MetricCard.tsx           Shared per-client metric input card (number/percentage/boolean/slider/textarea)
    StatusBadge.tsx          Small status pill component
  data/
    metrics.ts               Per-client metric catalog: CONTENT_METRICS, LEADGEN_METRICS, ALL_METRICS
    company_metrics.ts       TJ Personal Brand + MM Company Content metric catalogs (CompanyMetric type)
  hooks/
    useAutoSave.ts           Debounced upsert + save-state machine used by data entry pages
    useEffectiveMetrics.ts   Merges CONTENT_METRICS/LEADGEN_METRICS with a client's active custom_metrics
    useEffectiveTjMetrics.ts Merges TJ's static catalogs with tj_custom_metrics, bucketed by channel
    use-mobile.tsx           Responsive breakpoint hook
  lib/
    auth.tsx                 AuthProvider — session, role (admin/member/client), profile, client linkage
    export.ts                Builds every spreadsheet export (lifetime, weekly summary, EOM report)
    health.ts                Per-client "health score" computation
    notifications.ts         Client-notification sync (birthdays/anniversaries) used by the dashboard
    metrics.ts                (legacy) metric helpers
    utils.ts                  `cn()` class-merging helper and other small utilities
    week.ts                   Small week-related helpers
    workspace.tsx             Global "selected week" workspace context (useWorkspace())
  utils/
    dateUtils.ts             getTodayIST(), formatWeekDate() — the canonical "what day is it" helpers
    weekUtils.ts             Week-start/week-label/week-options generation, all UTC-safe
    metricCalculations.ts    buildWeekMetrics() (resolves 'auto' formulas), formatMetricDisplay(), formatPct()
    readMetric.ts            readNum/readText/readBool/calcRateCapped and other low-level jsonb readers
    dataUtils.ts             fmt(), mv(), tjVal(), salesVal(), formatDashboardValue() — display formatting
    format.tsx               fmt() with unit support ('%', '₹', 'hrs', 'K', 's'), fmtDelta(), <Delta/>
    targets.ts               findTarget() — the single shared "look up a target with period fallback" function
    rateAggregation.ts       RATE_DEPENDENCIES map + computeVolumeWeightedRate() for true rate metrics
    highScores.ts            Per-client lifetime high-score detection/backfill (writes to `high_scores` table)
    tjHighScores.ts          TJ's on-the-fly lifetime high computation (weekly + monthly bests)
    mmHighScores.ts          MM Company Content's on-the-fly lifetime high computation
    campaignSync.ts          Rolls campaign_weekly_data up into a client's weekly_data campaign totals
    campaignRollup.ts        Campaign-level aggregation helpers
    clientScope.ts           assertClientRows() — defense-in-depth check that portal queries stayed scoped
    routeGuards.ts           requireAdmin/requireInternalUser route-level guards
    eomReport.ts             End-of-month plain-text report generator
    waalaxyImport.ts         Waalaxy CSV → weekly campaign metrics parser (with duplicate-row detection)
    sort.ts                  sortAlphabetically()
  integrations/supabase/
    client.ts                Supabase client instance (reads VITE_ env vars)
    types.ts                 Generated database types (Database['myntmore']['Tables'][...]) — do not hand-edit
  types/                     Shared TypeScript domain types (Actionable, Client, Profile, etc.)
supabase/                    Hand-written SQL: RLS policies, migrations, data-fix scripts (see below)
docs/                        Older architecture/ops docs (see note below — may be stale relative to this README)
```

Two files are **generated and must never be hand-edited**:
- `src/routeTree.gen.ts` — generated by TanStack Router's Vite plugin from `src/routes/`.
- `src/integrations/supabase/types.ts` — generated from the live database schema; regenerate it after any schema change (new table/column).

> **Note on `docs/`:** this repo also has an older `docs/` folder (`ARCHITECTURE.md`, `DATA_MODEL.md`, `DEVELOPMENT_GUIDE.md`, `OPERATIONS_RUNBOOK.md`, `DASHBOARD_USER_GUIDE.md`, `MYNTMORE_DASHBOARD_NOTION.md`) written before TJ Personal Brand, MM Company Content, custom metrics, and the current targets system existed in their current form. Treat this README as the authoritative, current source; the `docs/` files may describe an earlier version of the schema and are due for a refresh.

## Routing

All routes are defined in `src/routes/` and compiled into `src/routeTree.gen.ts`. Route files are deliberately thin — they mostly just import and render a page component from `src/components/`.

| Route file | Path | Renders | Access |
| --- | --- | --- | --- |
| `index.tsx` | `/` | Redirects to dashboard or portal | — |
| `login.tsx` | `/login` | Sign-in | Public |
| `accept-invite.tsx` | `/accept-invite` | Invite acceptance flow | Public (token-gated) |
| `dashboard.tsx` | `/dashboard` | `DashboardPage` — the main company dashboard | Internal |
| `data-entry.tsx` | `/data-entry` | `DataEntryPage` — weekly per-client content/leadgen entry | Internal |
| `clients.tsx` / `clients.$id.tsx` | `/clients`, `/clients/:id` | Client list + client detail | Internal (writes admin-only) |
| `monthly-targets.tsx` | `/monthly-targets` | `MonthlyProgressPage` | Internal |
| `client-leaderboard.tsx` | `/client-leaderboard` | `ClientLeaderboardPage` | Internal |
| `high-scores.tsx` | `/high-scores` | `HighScoresPage` | Internal |
| `reports.tsx` | `/reports` | `ReportsPage` | Internal |
| `sales.tsx` | `/sales` | Sales & Outreach entry | Internal |
| `actionables.tsx` | `/actionables` | Actionables kanban/table | Internal (client-visible subset also shown in portal) |
| `processes.tsx` | `/processes` | Internal processes tracker | Internal |
| `finance.tsx` | `/finance` | Finance data entry | **Admin-only** route guard |
| `tj-personal-brand.tsx` | `/tj-personal-brand` | `TJBrandPage` — TJ's own data entry | Internal |
| `mm-content.tsx` | `/mm-content` | `MMContentPage` — Myntmore's own company content entry | Internal |
| `settings.tsx` (layout) | `/settings/*` | Settings shell | **Admin-only** route guard |
| `settings.team.tsx` | `/settings/team` | Team management (`TeamSettingsPage`) — invite, promote/revoke admin, disable users | Admin |
| `settings.targets.tsx` | `/settings/targets` | `SettingsTargetsPage` — weekly/monthly targets for clients, TJ, and Sales | Admin |
| `settings.export.tsx` | `/settings/export` | `ExportPage` — spreadsheet exports | Admin |
| `portal.tsx` | `/portal` | `ClientPortalPage` — the client-facing app | Client (own data only) |

Internal-route gating uses `src/utils/routeGuards.ts` (`requireAdmin`/`requireInternalUser`) plus a force-redirect in `__root.tsx` that sends a client session (`isClient && !isAdmin`) off any non-portal path. **This is defense-in-depth, not the real boundary** — RLS is what actually prevents a client session from reading another client's rows even if it somehow reached an internal route.

## Domain model

### Roles and identities

Auth state lives in `src/lib/auth.tsx` (`AuthProvider`/`useAuth()`), backed by Supabase Auth + two tables:
- `myntmore.profiles` — one row per authenticated user (name, email, department, linked `client_id` if it's a portal account).
- `myntmore.user_roles` — one row per user with a `role` (currently `'admin'` or `'member'` for internal staff; a portal user has no row here and is instead identified by `profiles.client_id` / `is_own_client()`).

Three effective identity classes:
1. **Admin** — full access. Can manage team, targets, exports, client CRUD, and any admin-gated write (see RLS section).
2. **Member** — internal, non-admin. Can read/write day-to-day operational data (weekly data entry, actionables, most channel data) but is blocked from admin-only actions (client CRUD, targets, team management, TJ/MM custom-metric writes, portal-account linking) at the RLS level, not just the UI level.
3. **Client (portal user)** — external. Strictly read-only except for their own action-plan items and campaign/actionable comments explicitly marked client-editable. Scoped everywhere by `myntmore.is_own_client(client_id)`.

`myntmore.is_internal_user()` (a Postgres function) is the umbrella check used by almost every internal-facing RLS policy: true for any authenticated user who is not a client and not disabled.

### Clients and services

A `clients` row represents one paying client. Each client independently has:
- `content_enabled` / `leadgen_enabled` — which of the two service lines this client is on (`client_settings` table). Almost every screen checks `isServiceEnabled(clientId, 'content'|'leadgen')` before rendering that service's UI.
- `active_content_metrics` / `active_leadgen_metrics` (`client_settings`, nullable arrays) — which metric ids are actually shown/editable for this client. **`null` means "every standard metric is active"**; a non-null array is an explicit allowlist. This is a recurring source of bugs: a metric added to the shared catalog *after* a client's array was snapshotted won't show for that client until an admin explicitly adds it via **Settings → Client Settings → Metric Fields**, or it's backfilled via SQL. See [Critical conventions](#critical-conventions-and-gotchas).
- Content/lead-gen manager assignments (`client_assignments`), birthday/`myntmore_start_date` (drives the dashboard's reminder banner), and status (`active`/`archived`).
- Optional custom metrics (`custom_metrics` table, admin-added via **Settings → Client Settings → Metric Fields**), with a reserved `X##` id prefix.

### The weekly/monthly cadence

The whole app is organized around **Monday-starting weeks**. A `week_start` is always a Monday date string (`YYYY-MM-DD`). **A week belongs to the month its Monday falls in**, even if the week's Sunday spills into the next month — this rule is applied consistently in monthly aggregation everywhere (`aggregateChannelRows`, `monthTjAgg`, `monthMmAgg`, `WeeklyBreakdown`, etc.).

The globally-selected week lives in `src/lib/workspace.tsx` (`useWorkspace()` → `selectedWeek`/`displayWeek`), driven by the week picker in `AppTopbar`. Most pages read this instead of keeping their own local week state, so switching weeks anywhere updates the whole app coherently.

"Month to Date" (MTD) means: every week in the selected month up to and including the currently-selected week — **not** the whole month, and **not** just the current week. This distinction is applied in `mtdTjRows`/`mtdSalesRows`/`clientMtdRows` filters.

### The metrics system

There are two parallel, differently-shaped metric type systems in this codebase — don't confuse them:

**1. Per-client metrics — `src/data/metrics.ts`, the `Metric` interface:**
```ts
interface Metric {
  id: string            // e.g. 'C01', 'L10' (C = content, L = leadgen)
  name: string
  type: MetricType       // 'number' | 'percentage' | 'textarea' | 'boolean' | 'slider' | 'auto'
  category: 'content' | 'leadgen'
  group: string           // section heading, e.g. 'Production Pipeline', 'Email Newsletter'
  autoFormula?: string     // e.g. 'C06+C07+C08', resolved at render time by buildWeekMetrics()
  dependsOn?: string[]
  hasTarget: boolean
  hasNote: boolean
  unit?: string
}
```
`CONTENT_METRICS` and `LEADGEN_METRICS` are the two static catalogs; `ALL_METRICS` is their concatenation. A client's **custom metrics** (`custom_metrics` table, `X##` id prefix, `category: 'content'|'leadgen'`) are fetched per-client via `useEffectiveMetrics()`/`fetchEffectiveMetricsForClients()` and merged onto the static catalog at render time — they are never mixed into `ALL_METRICS` itself.

**2. Company metrics (TJ Personal Brand + MM Company Content) — `src/data/company_metrics.ts`, the `CompanyMetric` interface:**
```ts
interface CompanyMetric {
  id: string             // e.g. 'TJI01' (TJ Instagram), 'MML01' (MM LinkedIn), 'MMS01' (MM SEO)
  name: string
  type: 'number' | 'percentage' | 'textarea' | 'auto' | 'boolean'
  unit?: string
  hasTarget?: boolean
  hasNote?: boolean
}
```
Catalogs: `TJ_INSTAGRAM_METRICS`, `TJ_YOUTUBE_METRICS`, `TJ_PODCAST_METRICS` (TJ's email-newsletter channel — the UI label is "Newsletter"/"Email Newsletter", the DB column is `email_newsletter`, and the internal id prefix stays `TJP` for historical reasons), `TJ_VIDEO_METRICS`, `MM_LINKEDIN_METRICS`, `MM_INSTAGRAM_METRICS`, `MM_WEBSITE_METRICS`, `MM_SEO_METRICS` (a labeled sub-section within the Website tab, sharing the same `website` jsonb column), `MM_OTHER_METRICS` (Quora/Reddit/Medium), `MM_ADS_METRICS`.

TJ also supports admin-added **custom metrics** (`tj_custom_metrics` table, reserved `Y##` id prefix — deliberately distinct from the per-client `X##` prefix so the two id namespaces can never collide), fetched via `useEffectiveTjMetrics()` and bucketed by channel (`instagram`/`youtube`/`newsletter`/`video`). MM Company Content currently has **no** custom-metrics feature — every MM field is a static catalog entry.

Metric ids are **globally unique strings, never array positions** — every consumer looks a metric up by id (`m.id === 'C09'`, `findTarget(rows, 'TJI04', ...)`), never by array index. Do not "look up the Nth metric" anywhere; a previous bug class in this codebase came from exactly that (a channel's data landing in the wrong bucket after a catalog array was reordered).

`'auto'`-type metrics (e.g. `C09` Total Posts Posted = `C06+C07+C08`, `TJI04` Total Posts, `MML12` Avg Impressions Per Post) are **not stored as raw jsonb values that get read directly** — some are computed live at render time via `buildWeekMetrics()`/`formatMetricDisplay()`, and some (TJI04, MML02→MML12) are additionally *persisted* at save time so historical high-score/target readers don't need to know the formula. Check the specific field's save path before assuming either behavior.

### Targets

Targets live in one shared table, `myntmore.targets`, keyed by `(client_id, metric_id, target_type, period)`:
- `client_id` is a real client id for per-client targets, or **`NULL`** for TJ's and Sales & Outreach's targets (they share the same table, distinguished only by `client_id IS NULL` + the metric id's prefix).
- `target_type` is `'weekly'` or `'monthly'`.
- `period` is the week's `week_start` (`YYYY-MM-DD`) for weekly targets, or `YYYY-MM` for monthly targets.
- A target is **not** re-entered every period — most periods have no row of their own. **Every reader must use `findTarget()`** (`src/utils/targets.ts`), which prefers an exact-period match and otherwise falls back to the most recently-set target for that metric. Skipping this fallback silently treats "target not re-entered this period" as "target is 0", which cascades into wrong achievement percentages everywhere (this has been a real, repeated bug in this codebase).

Targets are managed in **Settings → Targets** (`SettingsTargetsPage.tsx`), which has three sub-tabs: **Client** (per-client, weekly or monthly toggle), **TJ** (weekly or monthly toggle, `client_id IS NULL`), and **Sales** (weekly only, `client_id IS NULL`). MM Company Content is the one exception: it has **no** Settings-page target UI — a target for an MM field (e.g. Active Users, City Pages on Page 1) is entered **inline on the data-entry card itself** (`MMContentPage.tsx`), stored in the same jsonb object as the value (`{value, target}`), not in the `targets` table at all.

### High scores

Three independent implementations, because the three domains (per-client, TJ, MM) evolved separately:
- **Per-client** (`src/utils/highScores.ts`): a real persisted table, `myntmore.high_scores` (one row per `client_id` + `metric_id`, storing `lifetime_high`/`achieved_week`/`lifetime_high_month`/`achieved_month`), rebuilt by `backfillHighScores()` and updated incrementally by `detectAndUpdateHighScores()` on every save. Handles both plain counts and true rate metrics (`RATE_DEPENDENCIES`-listed, volume-weighted) and plain percentage metrics (averaged).
- **TJ** (`src/utils/tjHighScores.ts`): **no persisted table** — `fetchTJLifetimeHighs()` scans every historical week in `tj_weekly_data` on the fly, computing both a weekly best and a monthly best (correctly averaging percentage-type metrics per month, and excluding the current in-progress month from the "best month" comparison so a strong week or two early in the month can't set a record that hasn't been earned yet).
- **MM Company Content** (`src/utils/mmHighScores.ts`): same on-the-fly approach as TJ, weekly-only (no monthly-best concept for MM yet).

A metric's "New High" star (`★`) means its current value equals the recorded lifetime high **and** it's greater than 0 — a fresh client/metric with everything at 0 must never show a false "record".

## Feature walkthrough

- **Dashboard** (`/dashboard`, `DashboardPage.tsx` — by far the largest component in the app): company-wide view with collapsible sections — per-client Client Performance rows (each expandable into Content Metrics + Lead Gen Metrics, each of which shows monthly goal-progress cards for a few key targeted metrics plus a full metric table with ACH% coloring, weekly/monthly target status, and best-ever week/month), TJ Personal Brand (one full-width section per channel, same goal-cards + full-table treatment), Sales & Outreach, MM Company Content (LinkedIn/Instagram/Website/SEO/Other/Ads rows), Processes, and a birthday/anniversary reminder banner. Supports a Weekly ⇄ Monthly (Month-to-Date) view toggle.
- **Data Entry** (`/data-entry`, `DataEntryPage.tsx`): per-client weekly Content/Lead Gen form, autosaved via `useAutoSave`, grouped by metric `group`, with inline Waalaxy CSV import for campaign weeks.
- **TJ Personal Brand** (`/tj-personal-brand`, `TJBrandPage.tsx`): TJ's own weekly entry across Instagram/YouTube/Newsletter/Video Pipeline, one row per week in `tj_weekly_data` (no `client_id` — a single company-wide entity).
- **MM Company Content** (`/mm-content`, `MMContentPage.tsx`): Myntmore's own weekly entry across LinkedIn/Instagram/Website (+ SEO sub-section)/Other Channels/Ads, one row per week in `mm_weekly_data`.
- **Clients** (`/clients`): admin-gated CRUD, manager assignment, service enable/disable, archive/restore.
- **Client Portal** (`/portal`, `ClientPortalPage.tsx`): the client-facing app — weekly/monthly performance grouped into labeled sections (Production Pipeline, Content Published, Audience Performance, Email Newsletter, LinkedIn Newsletter, campaign outreach groups, ...), campaigns, and `ClientActionPlan` (clients can update status/comment on their own action items).
- **Monthly Targets/Progress** (`/monthly-targets`, `MonthlyProgressPage.tsx`): per-client monthly target-vs-actual status (Hit/On Track/Slightly Behind/Behind/No Data) with a days-left-in-month banner.
- **Client Leaderboard** (`/client-leaderboard`): ranks clients by a chosen metric.
- **High Scores** (`/high-scores`): browses every client's lifetime highs.
- **Reports** (`/reports`): report generation from the same operational data.
- **Actionables** (`/actionables`): kanban + table view of internal/client tasks, drag-and-drop via `@dnd-kit`, with client-visible items surfaced in the portal too.
- **Processes** (`/processes`): recurring internal process tracker with weekly status updates, admin-gated create/delete, open to all internal users for read/update.
- **Sales & Outreach** (`/sales`): cold-email and outreach-section weekly entry, `client_id IS NULL` (company-wide).
- **Finance** (`/finance`): finance data entry, admin-gated.
- **Settings** (`/settings/*`, admin-only route): **Team** (invite/promote/revoke/disable users — with a self-disable lockout guard so an admin can't accidentally lock themselves out), **Targets** (see above), **Export** (spreadsheet generation), plus non-routed tabs reached from within Settings for **Client Settings** (per-client active-metrics toggle, custom metrics, portal-account linking) and **TJ Channel Assignments** (per-channel team-member assignment + TJ custom metrics management).

## Database schema

All application tables live in the **`myntmore`** Postgres schema (not `public`). RLS is enabled on every table.

| Table | Purpose |
| --- | --- |
| `clients` | Client identity, birthday/start date, status, service flags |
| `client_settings` | Per-client active-metrics allowlists + content/leadgen enabled flags |
| `client_assignments` | Content/lead-gen manager assignment per client |
| `weekly_data` | Weekly content + lead-gen metrics per client (one row per client per week) |
| `custom_metrics` | Admin-defined per-client metric definitions (`X##` id prefix) |
| `campaigns` | Client LinkedIn campaigns |
| `campaign_weekly_data` | Weekly performance per campaign (rolls up into `weekly_data`) |
| `targets` | Weekly/monthly targets — per-client (`client_id` set) or company-wide (`client_id NULL`, for TJ/Sales) |
| `high_scores` | Per-client persisted lifetime high-score records |
| `tj_weekly_data` | TJ Personal Brand's weekly data across all channels (no `client_id` — single entity) |
| `tj_custom_metrics` | Admin-defined TJ custom metric definitions (`Y##` id prefix) |
| `tj_channel_assignments` | Which internal team member owns which TJ channel |
| `mm_weekly_data` | Myntmore's own company-content weekly data across all channels |
| `sales_weekly_data` | Sales & Outreach weekly data (cold email, TJ/Jahnvi/Shirin outreach, meeting tracker) |
| `myntmore_processes` | Internal recurring processes |
| `process_weekly_updates` | Weekly status update per process |
| `actionables` | Internal + client-visible tasks (kanban) |
| `client_alerts` | Alerts surfaced on the dashboard per client |
| `client_context_notes` | Free-text internal notes per client |
| `client_health_scores` | Computed per-client health score history |
| `client_notifications` | Persisted birthday/anniversary/overdue reminder state (dedup + dismiss tracking) |
| `growth_initiatives` / `growth_initiative_comments` | Growth-initiative tracking and discussion |
| `hot_leads` | Hot-lead tracking |
| `initiatives` | General initiative tracking |
| `aha_moments` | Notable client-shared moments/quotes |
| `expenses` / `finance_data` | Finance tracking (admin-only) |
| `profiles` | One row per authenticated user (name, email, department, linked `client_id` for portal accounts) |
| `user_roles` | Role per internal user (`admin`/`member`) |
| `invites` | Pending user invitations |

Postgres helper functions used throughout the RLS policies: `myntmore.is_internal_user()`, `myntmore.has_role(user_id, role)`, `myntmore.is_own_client(client_id)`, `myntmore.is_own_campaign(campaign_id)`, `myntmore.is_assigned(...)`, `myntmore.get_invite_by_token(...)`, `myntmore.client_update_actionable(...)` (an RPC used by the portal to let a client update their own actionable without needing broader UPDATE rights).

Generated types live in `src/integrations/supabase/types.ts` — **regenerate this after any schema change** rather than hand-editing it.

## Row Level Security (RLS) model

SQL for schema, RLS policies, and one-off data fixes lives in `supabase/*.sql`. There is **no migration runner** in this session's toolchain — every `.sql` file here has to be run manually by an admin in Supabase's SQL editor. When an agent or contributor needs a schema/policy/data change and has no direct DB execution access, the correct move is to write the SQL to a new file in `supabase/` and tell the user to run it, not to skip the change.

The dominant, load-bearing pattern (repeat this for any new table holding client-linked or internal-only data):
```sql
-- Readable/writable by every non-disabled internal user, no admin split:
create policy X_internal_all on myntmore.X for all to authenticated
  using (myntmore.is_internal_user()) with check (myntmore.is_internal_user());

-- Or, when the UI restricts writes to admins (the common, correct pattern
-- whenever a table has an admin-only "Add"/"Delete" button):
create policy X_internal_read on myntmore.X for select to authenticated
  using (myntmore.is_internal_user());
create policy X_admin_all on myntmore.X for all to authenticated
  using (myntmore.has_role(auth.uid(), 'admin')) with check (myntmore.has_role(auth.uid(), 'admin'));

-- Client-portal read access, scoped to their own client only:
create policy X_portal_own_read on myntmore.X for select to authenticated
  using (myntmore.is_own_client(client_id));
```

**A recurring, previously-real bug class in this repo:** a table gets a single broad `FOR ALL` policy for all internal users, while the UI only shows the write action (Add/Edit/Delete) to admins — meaning any non-admin internal user could bypass the UI and write via a direct Supabase client call. `clients`, `targets`, `tj_custom_metrics`, and `myntmore_processes` have all previously had this exact gap and been fixed by splitting into `_internal_read` + `_admin_all`. **Whenever you add a table whose UI has any admin-only write control, give it the split-policy pattern from the start**, and whenever you touch RLS on an existing table, check whether the UI's actual gating still matches it.

## Critical conventions and gotchas

This codebase has accumulated a well-defined recurring-bug taxonomy over many rounds of auditing. Internalize these before making changes:

1. **Timezone: the team is in IST (UTC+5:30). Never mix a locally-constructed `Date`/local getters with `.toISOString()`/UTC getters in the same computation.** `new Date(y, m, d)` and `.getDate()`/`.getMonth()`/`.getDay()`/`.setDate()` are all **local time**; `.toISOString()` and `.getUTCDate()`/`.getUTCMonth()`/`.getUTCDay()` are all **UTC**. Mixing the two silently shifts a date by a day (or a "today" check by ~5.5 hours) for IST viewers. The safe patterns are: fully UTC (`Date.UTC(...)` + `getUTCDay()`/`setUTCDate()`), or fully local with an explicit `timeZone` passed to `toLocaleDateString`/`toLocaleString`. **Use `getTodayIST()` from `src/utils/dateUtils.ts`** for any "what is today's date" check (overdue items, "is this the current month") instead of `new Date().toISOString().slice(0,10)`, which lags IST by up to ~5.5 hours every day.
2. **A percentage-type metric must be averaged across weeks/rows, never summed.** A rate that's stored as a raw entered percentage (not derived from a numerator/denominator pair) — e.g. Newsletter Open Rate, TJ's Delivery Rate — is averaged directly. A **true rate metric** with a separate raw numerator/denominator pair (e.g. `L12` Acceptance Rate = accepted/sent) must be **volume-weighted**: sum the raw numerator and denominator across the period first, then divide once — never average the per-week already-computed rates (that overweights low-volume weeks). The canonical numerator/denominator pairs are in `RATE_DEPENDENCIES` (`src/utils/rateAggregation.ts`). **Always derive "is this a percentage" from `metric.type === 'percentage'`, never a hardcoded id list** — a hardcoded allowlist silently misses every new percentage metric added later (this exact bug has recurred across at least half a dozen files/rounds in this codebase).
3. **A boolean-type field's `Number(true)`/`Number(false)` both pass an `isNaN` check** (`1`/`0`), so any generic "sum every numeric field" aggregator will silently corrupt a boolean field unless it explicitly excludes boolean-type ids first. Check `aggregateChannelRows`'s `booleanIds` guard in `DashboardPage.tsx` and `mmHighScores.ts`'s `MM_BOOLEAN_IDS` for the pattern to copy.
4. **`null` and `0` are semantically different and must both be preserved.** `null`/`undefined` means "no data submitted"; `0` means "the value was submitted and is genuinely zero" (e.g. 0 posts this week is bad performance, not missing data). A truthy check (`if (value)`) or an early-return on `value === 0` will misread a real 0 as "no data" — always use explicit `!== null`/`!== undefined` checks. This has bitten both metric-value display (`formatDashboardValue`/`formatMetricDisplay` used to shortcut `n === 0` to a bare `'0'` before checking the metric's type, so a real 0% displayed identically to a count's 0) and target-progress cards (a client with no data yet this month used to render a false "Target hit ✓" because a `null` MTD value collapsed the same way a real 0 remaining would).
5. **A newly-added catalog metric is invisible to any consumer that lists metrics by explicit id/name instead of iterating the shared catalog array.** This has repeatedly bitten: per-client exports/reports, the dashboard's hardcoded per-card metric lists, and `active_content_metrics`/`active_leadgen_metrics` allowlists snapshotted before the new metric existed. When you add a metric, grep for every place that iterates its catalog array (`ALL_METRICS`, `MM_WEBSITE_METRICS`, etc.) by name rather than importing and mapping over the array, and update each one.
6. **Metric ids are looked up, never positionally indexed.** Don't destructure "the first/second item" of a metrics array; always `.find(m => m.id === '...')`.
7. **A target is not re-entered every period — always use `findTarget()`**, never an exact-period-only lookup (see [Targets](#targets)).
8. **RLS breadth must match the UI's actual gating**, not just look plausible (see [RLS model](#row-level-security-rls-model)).
9. **No direct database execution access is assumed by default in this session's workflow.** Schema/RLS/data-fix changes are written as `.sql` files under `supabase/` and handed to an admin to run manually in Supabase's SQL editor — they are not applied automatically by pushing frontend code.

## How to add a new metric

**Per-client metric** (in `src/data/metrics.ts`):
1. Add the entry to `CONTENT_METRICS` or `LEADGEN_METRICS` with a fresh, never-reused id, correct `type`/`group`/`hasTarget`/`hasNote`/`unit`.
2. If it's a rate metric with a raw numerator/denominator pair, add it to `RATE_DEPENDENCIES` (`src/utils/rateAggregation.ts`).
3. It will show automatically in `DataEntryPage.tsx` (groups metrics dynamically by `.group`) and in most dashboard tables (which iterate `ALL_METRICS` generically) — but check any place that hardcodes a metric-id list (search the id/name) and update it, especially: the Client Portal's `contentMetricGroups`/`leadgenMetricGroups` whitelist (`ClientPortalPage.tsx`), `src/lib/export.ts`'s per-client sheet builder, and `ReportsPage.tsx`.
4. If it's `hasTarget: true`, existing clients with a non-null `active_content_metrics`/`active_leadgen_metrics` array won't see it until an admin enables it in **Settings → Client Settings → Metric Fields**, or you write a one-off SQL data-fix (see `supabase/enable_newsletter_metrics_for_amey.sql` for the pattern: append the missing id(s), don't overwrite the whole array).
5. Verify: `npx tsc --noEmit && npx vite build`, then manually check data entry, the dashboard, targets (if `hasTarget`), and export.

**TJ Personal Brand metric** (in `src/data/company_metrics.ts`): same idea, added to `TJ_INSTAGRAM_METRICS`/`TJ_YOUTUBE_METRICS`/`TJ_PODCAST_METRICS`/`TJ_VIDEO_METRICS`. It auto-appears in `TJBrandPage.tsx`, the dashboard's per-channel `TJMetricTable`/`TJGoalCards`, and (if percentage-type) needs no special handling since averaging is type-driven. Or, an **admin can add one without a code change at all** via Settings → TJ Channel Assignments' "Add Custom Metric" — this writes to `tj_custom_metrics` with a server-generated `Y##` key.

**MM Company Content metric**: added to the relevant `MM_*_METRICS` array. No custom-metrics feature exists for MM, so this always requires a code change. Remember to wire a `type: 'boolean'` field into `MMContentPage.tsx`'s render (Switch + optional note), `DashboardPage.tsx`'s `MMContentRow` (Pass/Fail display, not a numeric delta), `aggregateChannelRows`'s boolean exclusion, and `mmHighScores.ts`'s boolean exclusion if you add another one.

## Exports

`src/lib/export.ts` builds every spreadsheet: a full lifetime export (`generateLifetimeExport`, one sheet per domain: per-client, TJ, MM, Sales), and a plain-text `generateWeeklySummary`. Exports read the exact same tables the dashboard reads, using `readField`/`readNum`/`readText`/`readBool` helpers that mirror the display-layer readers, so a value shown on-screen and a value in an export should always agree. Known, deliberately-deferred gap: per-client **custom metrics** are not yet wired into `buildClientSheet`, `ReportsPage.tsx`, or `MonthlyProgressPage.tsx` — this is tracked as follow-up work, not a regression.

## Deployment

Vercel deploys the production app from `main` automatically on push.

```bash
npm run check
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

After pushing, confirm the Vercel deployment reaches `READY` and manually test the changed workflow on [dashboard.myntmore.com](https://dashboard.myntmore.com). **A frontend deploy never applies database migrations** — any pending `.sql` file in `supabase/` must be run manually by an admin in Supabase's SQL editor, independently of the code deploy, and ideally before the frontend code that depends on it goes live.

## Troubleshooting

**"Missing Supabase configuration" on load** — check `.env.local` variable names exactly match `VITE_MYNTMORE_SUPABASE_URL`/`VITE_MYNTMORE_SUPABASE_PUBLISHABLE_KEY`, restart Vite after editing.

**A save reports a missing/unknown column** — compare the payload against the deployed table schema and `supabase/*.sql`; a frontend TypeScript type does not create a database column. Either the field needs a migration, or it's writing to the wrong jsonb key.

**Saved values disappear after reload** — check: did the save actually complete (see `useAutoSave`'s status)? Is the upsert's conflict target (`onConflict`) correct for this table? Is a `0` value being treated as empty somewhere in the read path? Is a slower, stale save request overwriting a newer one (race condition — check for a "stale request" guard)?

**A metric that should be visible for a client isn't showing anywhere** — almost always the `active_content_metrics`/`active_leadgen_metrics` allowlist snapshot issue described in [Clients and services](#clients-and-services) — check Settings → Client Settings → Metric Fields for that client, or whether the metric is genuinely new and needs a data-fix.

**A monthly value looks summed instead of averaged, or vice versa** — check the metric's `type` and whether the consumer computing it derives "should this average" from `type === 'percentage'` or from a stale hardcoded id list (see gotcha #2 above).

**Client data appears under the wrong account, or a client can see something they shouldn't** — stop and treat this as a security incident. Check `client_id` scoping in the query, the portal's `is_own_client()` RLS policy on the affected table, and `clientScope.ts`'s `assertClientRows()` defense-in-depth check, before making any further writes.

## Contribution checklist

- Keep changes focused; don't fix unrelated things in the same commit, and don't leave the user's other in-progress worktree changes touched.
- Run `npm run check` (`typecheck` + `build`) before every commit; resolve all errors.
- Manually test the actual feature affected — a passing typecheck/build verifies code compiles, not that the feature behaves correctly (there's no automated test suite here).
- Test empty, zero, partial, and fully-populated data states — not just the happy path.
- For any date/time logic: verify it behaves correctly for an IST viewer specifically, not just "doesn't crash" (see gotcha #1).
- For any new/changed metric: verify data entry, the dashboard, targets (if applicable), exports, and (for per-client metrics) the client portal.
- For any new table or RLS change: verify the UI's actual write-gating matches the RLS policy exactly (see [RLS model](#row-level-security-rls-model)).
- Review the diff (`git diff`) line by line before committing — don't just trust that "it built."
- Commit messages should explain *why*, not just *what* — the "why" is what future debugging (and future you) actually needs.
- Never commit local secrets, `dist/`, or `.DS_Store`.
- If you have no direct database execution access, write schema/RLS/data-fix changes as a new `.sql` file under `supabase/` and clearly tell the user what to run and why — never silently skip a needed database change.
