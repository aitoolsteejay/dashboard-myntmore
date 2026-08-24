# Myntmore Command Center

Myntmore Command Center is the internal operations dashboard and client portal used to manage weekly delivery across content, lead generation, campaigns, targets, actionables, sales, reporting, and internal processes.

Production: [dashboard.myntmore.com](https://dashboard.myntmore.com)

Repository: [aitoolsteejay/dashboard-myntmore](https://github.com/aitoolsteejay/dashboard-myntmore)

## What the application does

- Captures weekly content and lead-generation metrics with autosave.
- Compares weekly and monthly performance against client targets.
- Shows client summaries, weekly breakdowns, leaderboards, and lifetime high scores.
- Tracks campaigns, campaign weeks, action plans, and client-facing updates.
- Provides a restricted client portal alongside internal admin and member views.
- Manages actionables, processes, company content, sales, finance, and personal-brand reporting.
- Generates reports and spreadsheet exports from the same operational data.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7 |
| Routing | TanStack Router |
| Data and authentication | Supabase |
| Styling | Tailwind CSS 4 and Radix UI primitives |
| Charts | Recharts |
| Forms and validation | React Hook Form and Zod |
| Hosting | Vercel |

The browser talks directly to Supabase through a publishable key. Supabase Row Level Security (RLS), rather than hidden navigation or frontend route guards, enforces access control.

## Requirements

- Node.js 20 or newer
- npm
- Access to the Myntmore Supabase project for live data
- Supabase CLI only when testing or applying database changes locally

## Local setup

```bash
git clone git@github.com:aitoolsteejay/dashboard-myntmore.git
cd dashboard-myntmore
npm install
cp .env.example .env.local
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Configure `.env.local` with browser-safe Supabase credentials:

```dotenv
VITE_MYNTMORE_SUPABASE_URL=https://your-project.supabase.co
VITE_MYNTMORE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never put a Supabase service-role key in a `VITE_` variable. Vite embeds those variables in the browser bundle. Service-role credentials belong only in secure server-side environments such as Supabase Edge Functions.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run typecheck` | Run TypeScript checks without emitting files |
| `npm run build` | Create a production build in `dist/` |
| `npm run check` | Run the typecheck and production build |
| `npm run preview` | Serve the production build locally |

Run `npm run check` before pushing a change.

## Project structure

The route files in `src/routes/` are intentionally thin. Most page behavior lives under `src/components/`.

| Area | Main implementation |
| --- | --- |
| Dashboard | `src/components/dashboard/DashboardPage.tsx` |
| Weekly data entry | `src/components/data-entry/DataEntryPage.tsx` |
| Clients | `src/components/clients/` |
| Client portal | `src/components/portal/ClientPortalPage.tsx` |
| Monthly targets | `src/components/monthly/MonthlyProgressPage.tsx` |
| Client leaderboard | `src/components/leaderboard/ClientLeaderboardPage.tsx` |
| High scores | `src/components/high-scores/HighScoresPage.tsx` |
| Reports | `src/components/reports/ReportsPage.tsx` |
| Sales and outreach | `src/components/sales/SalesPage.tsx` |
| Settings | `src/components/settings/` |

Important shared logic:

- `src/data/metrics.ts` and `src/lib/metrics.ts` define metric metadata and formulas.
- `src/utils/metricCalculations.ts` calculates derived weekly values.
- `src/utils/highScores.ts` detects and rebuilds client high scores.
- `src/utils/weekUtils.ts` and `src/utils/dateUtils.ts` contain calendar rules.
- `src/hooks/useAutoSave.ts` owns data-entry persistence and save state.
- `src/utils/clientScope.ts` and Supabase RLS protect client-specific data.
- `src/integrations/supabase/types.ts` contains generated database types.

Do not edit `src/routeTree.gen.ts` manually. TanStack Router generates it from `src/routes/`.

## Data model

Application tables use the `myntmore` Supabase schema. The central records are:

| Table | Purpose |
| --- | --- |
| `clients` | Client identity, ownership, and enabled services |
| `weekly_data` | Weekly content and lead-generation metrics per client |
| `campaigns` | Client campaigns and campaign-level configuration |
| `campaign_weekly_data` | Weekly campaign performance tied to a campaign |
| `targets` | Weekly and monthly metric targets |
| `high_scores` | Lifetime weekly and monthly client records |
| `app_users` | Application user profiles and roles |
| `client_user_access` | Links portal users to clients they may access |
| `actionables` | Internal tasks and client action items |

See [Data model](docs/DATA_MODEL.md) for the complete table map and ownership rules.

## Metric and calendar rules

These rules affect multiple screens and must remain consistent:

- A week belongs to the month in which it begins. A week starting in July and ending in August is a July week.
- Monthly count metrics are summed across included weeks.
- Percentage metrics must not be summed. Acceptance and response rates are derived from their monthly numerator and denominator totals.
- In-network and out-of-network impression shares are weekly percentages, so monthly values are averaged across weeks with data.
- High-score stars identify a value matching the recorded lifetime high and the week in which the record was achieved.
- Missing data differs from a submitted zero. Preserve `null` when no value was supplied and `0` when zero was intentionally submitted.

When adding a metric, update its metadata, calculation, data-entry field, dashboard presentation, targets, reports, exports, and high-score behavior as applicable. The [Development guide](docs/DEVELOPMENT_GUIDE.md) contains the full checklist.

## Autosave behavior

Weekly data entry uses `useAutoSave` to upsert one record per owner and period. The UI distinguishes saving, saved, and failed states.

When changing autosave code:

1. Keep the correct conflict columns for the destination table.
2. Send only columns that exist in the deployed schema.
3. Do not replace saved sibling metric groups with incomplete local state.
4. Confirm that intentional zero values survive save and reload.
5. Test rapid edits, navigation during a save, and retry behavior after failure.

A Supabase “column not found in schema cache” error normally means the frontend is sending a field absent from the deployed table, or a migration has not been applied. Remove the unsupported field or deploy the migration, then reload the Supabase schema cache if necessary.

## Database changes

SQL migrations and security policies are stored in `supabase/`. Treat production data as non-recoverable unless a backup has been verified.

Before applying a database change:

1. Identify every affected table, policy, view, function, and frontend query.
2. Back up affected production rows and record row counts.
3. Test the SQL against a non-production project when possible.
4. Apply additive changes before deploying frontend code that depends on them.
5. Regenerate or update `src/integrations/supabase/types.ts`.
6. Test as an admin, internal member, and client portal user.

Never run `DROP`, `TRUNCATE`, an unscoped `DELETE`, or a destructive database reset against production.

## Authentication and authorization

The application supports internal administrators, team members, and client portal users. Frontend guards improve navigation, but RLS is the security boundary.

Every client-owned query must be scoped by `client_id`. Campaign weekly data must also remain associated with its parent campaign. Any new table containing client data needs an explicit RLS policy before production use.

Portal users are provisioned through the `create-portal-user` Supabase Edge Function. Keep privileged user-management operations out of the browser.

## Deployment

Vercel deploys the production application from the `main` branch.

Normal release flow:

```bash
npm run check
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

After pushing, verify that the Vercel deployment reaches `READY` and test the changed workflow on [dashboard.myntmore.com](https://dashboard.myntmore.com). Database migrations are not applied automatically by a frontend deployment.

## Documentation

- [Dashboard user guide](docs/DASHBOARD_USER_GUIDE.md) — features and the weekly workflow
- [Architecture](docs/ARCHITECTURE.md) — application, authentication, data flow, and security
- [Development guide](docs/DEVELOPMENT_GUIDE.md) — safe procedures for routes, metrics, pages, and schema changes
- [Operations runbook](docs/OPERATIONS_RUNBOOK.md) — deployments, migrations, backups, incidents, and access
- [Data model](docs/DATA_MODEL.md) — Supabase tables and ownership
- [Notion-ready dashboard guide](docs/MYNTMORE_DASHBOARD_NOTION.md) — team-workspace documentation

## Contribution checklist

Before handing off a change:

- Keep the change focused and preserve unrelated worktree changes.
- Run `npm run check` and resolve TypeScript or build failures.
- Test empty, zero, partial, and fully populated data states.
- Confirm desktop and narrow-screen layouts for UI changes.
- Verify role-based access for data or navigation changes.
- Confirm autosaved values remain after reload.
- Document new environment variables, migrations, and operational steps.
- Do not commit local secrets, generated `dist/`, or `.DS_Store`.

## Troubleshooting

### The application reports missing Supabase configuration

Check `.env.local`, use the exact variable names above, and restart Vite after editing environment variables.

### A save reports a missing column

Compare the request payload with the deployed table schema and migrations in `supabase/`. Frontend TypeScript types do not create database columns.

### Saved values disappear after reload

Check that the save completed, the upsert conflict target identifies the intended row, zero values are not treated as empty, and a later autosave is not overwriting the record with stale state.

### Client data appears under the wrong account

Stop the release and inspect `client_id` scoping, portal access mappings, and RLS policies before making further writes. Follow the incident procedure in the [Operations runbook](docs/OPERATIONS_RUNBOOK.md).
