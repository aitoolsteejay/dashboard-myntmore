# Myntmore Dashboard

Myntmore's internal operations dashboard and client portal. It tracks weekly client delivery, lead-generation campaigns, content performance, targets, actionables, internal processes, sales, finance, and TJ personal-brand channels.

Production: [dashboard-myntmore-five.vercel.app](https://dashboard-myntmore-five.vercel.app)

## Start here

- [Dashboard user guide](docs/DASHBOARD_USER_GUIDE.md) — what each area does and the normal weekly workflow.
- [Architecture](docs/ARCHITECTURE.md) — how the application, authentication, data, and security fit together.
- [Development guide](docs/DEVELOPMENT_GUIDE.md) — setup and safe procedures for changing pages, metrics, routes, and database fields.
- [Operations runbook](docs/OPERATIONS_RUNBOOK.md) — deployments, users, migrations, backups, incidents, and security checks.
- [Data model](docs/DATA_MODEL.md) — ownership and purpose of the main Supabase tables.

## Local setup

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these values in `.env.local`:

```dotenv
VITE_MYNTMORE_SUPABASE_URL=https://gapaawxbkfmpthfesuyw.supabase.co
VITE_MYNTMORE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Never put a Supabase service-role key in a `VITE_` variable. Vite exposes all `VITE_` variables to the browser.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite server |
| `npm run typecheck` | Run TypeScript checks |
| `npm run build` | Create the production build |
| `npm run check` | Run typecheck and production build |
| `npm run preview` | Preview the production build locally |

## Non-negotiable safety rules

1. Never run `DROP`, `TRUNCATE`, an unscoped `DELETE`, or a destructive database reset against production.
2. Back up affected tables and record row counts before any data migration.
3. Every client-owned query must be scoped by `client_id`. Campaign weekly data must also remain tied to its parent campaign.
4. Security belongs in Supabase RLS. A hidden button or route redirect is not sufficient authorization.
5. Keep the service-role key server-side, currently inside Supabase Edge Functions only.
6. Test changes as an admin, member, and client user before deployment.
7. Do not edit `src/routeTree.gen.ts`; TanStack Router generates it.
