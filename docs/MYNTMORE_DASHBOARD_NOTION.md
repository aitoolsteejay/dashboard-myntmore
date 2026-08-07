# Myntmore Dashboard — Complete Documentation

> Internal handbook for operating, maintaining, changing, and securely deploying the Myntmore dashboard.

---

## Quick reference

| Item | Value |
| --- | --- |
| Production dashboard | https://dashboard-myntmore-five.vercel.app |
| GitHub repository | https://github.com/aitoolsteejay/dashboard-myntmore |
| Supabase project | `gapaawxbkfmpthfesuyw` |
| Dashboard database schema | `myntmore` |
| Hosting | Vercel |
| Frontend | React 19, TypeScript, Vite, TanStack Router and Query |
| Database and authentication | Supabase |

> ⚠️ The Supabase project is shared with another internal tool. Every dashboard SQL statement must explicitly target the `myntmore` schema. Never alter unrelated schemas.

---

## Table of contents

1. Dashboard overview
2. Roles and access
3. Dashboard sections
4. Weekly operating workflow
5. Architecture
6. Repository structure
7. Local development
8. How to make code changes
9. Metrics and calculations
10. Data entry and autosave
11. Waalaxy CSV imports
12. Database model
13. Security and client isolation
14. Testing checklist
15. Deployment
16. Database migrations and backups
17. User and password management
18. Incident runbooks
19. Definition of done

---

# 1. Dashboard overview

The Myntmore dashboard is the operating system for weekly client delivery and internal performance. It handles:

- Client content and lead-generation metrics
- Campaign-level lead-generation performance
- Monthly targets and high scores
- Team and personal actionables
- Myntmore processes
- Internal sales and outreach
- Myntmore content channels
- TJ personal-brand channels
- Client-facing portal access
- Admin-only settings and finance

Reporting is primarily week-based. The selected week follows the user across pages and is stored in browser local storage under `myntmore.workspace.v1`.

Dashboard totals, averages, achievement percentages, and alerts should be calculated from stored source data. Users should not enter derived values separately unless there is a specific business requirement.

---

# 2. Roles and access

## Admin

Admins can use the complete internal dashboard, manage clients and team accounts, configure targets and metrics, reset passwords, and access finance.

## Member

Members can use operational sections and work with assigned clients. They must not receive admin-only settings, user-management, or finance access.

## Client account

Client accounts enter through the portal and can see only their linked client's permitted data. Client portal accounts currently use a member-compatible Auth role and are distinguished using their profile department and linked client record.

## Disabled account

A disabled profile must be signed out and denied access even if an old browser session still exists.

## Three authorization layers

Authorization is enforced at three levels:

1. Route guards control navigation.
2. Queries filter records by client, week, and other ownership fields.
3. Supabase Row Level Security is the final security boundary.

Hiding a button or redirecting a page is not sufficient security.

---

# 3. Dashboard sections

| Section | Purpose |
| --- | --- |
| Dashboard | Weekly command centre, missing data, target status, client performance, TJ brand, and sales summaries |
| Clients | Client list and detailed client workspaces |
| Data Entry | Manual weekly entry and campaign CSV import |
| Actionables | Personal and team task boards, statuses, owners, and due dates |
| Monthly Targets | Monthly target setup and progress review |
| Reports | Aggregated performance analysis |
| Processes | Myntmore process cards and weekly process updates |
| Sales & Outreach | Internal outreach performance |
| Myntmore Content | Myntmore's social and content-channel performance |
| TJ Personal Brand | Instagram, YouTube, email newsletter, and video pipeline |
| Settings | Admin-only team, clients, portal access, targets, metrics, TJ channels, and export tools |
| Finance | Admin-only financial and expense data |

---

# 4. Weekly operating workflow

1. Select the correct reporting week and confirm its date range.
2. Open Data Entry and choose the intended client.
3. Enter content and lead-generation values for that client's enabled services.
4. Enter campaign data manually or import a Waalaxy CSV for each campaign.
5. Review imported fields and complete qualitative fields manually.
6. Save and confirm success.
7. Enter Myntmore, TJ, process, and sales performance where applicable.
8. Review missing-data and below-target indicators on the dashboard.
9. Create or update actionables with owners and due dates.
10. Spot-check the client portal where relevant.

Client service settings control whether content and lead-generation fields appear. Disabling a service must hide irrelevant fields without deleting historical data.

---

# 5. Architecture

```text
Browser
  └── React + TanStack Router + TanStack Query
       ├── Supabase Auth
       ├── Supabase Data API
       │    └── PostgreSQL schema: myntmore
       │         └── Row Level Security
       └── Supabase Edge Function
            └── Privileged account and password operations

GitHub
  └── Vercel production deployment
```

The dashboard is a Vite single-page application. Vercel rewrites browser routes to `index.html`. TanStack Router discovers route files and generates `src/routeTree.gen.ts`.

The root application installs:

- TanStack Query for remote state and cache invalidation
- `AuthProvider` for sessions, profiles, roles, and client linkage
- `WorkspaceProvider` for the shared reporting week
- Global navigation and toast notifications

The application also detects stale JavaScript chunks after deployment and performs one controlled reload to prevent blank pages in older open tabs.

---

# 6. Repository structure

| Path | Responsibility |
| --- | --- |
| `src/routes/` | Route definitions and authorization guards |
| `src/components/` | Feature and reusable UI components |
| `src/data/metrics.ts` | Main client metric definitions |
| `src/hooks/` | Data hooks and autosave behavior |
| `src/lib/auth.tsx` | Authentication and role state |
| `src/lib/workspace.tsx` | Shared selected week |
| `src/utils/routeGuards.ts` | Internal and admin guards |
| `src/integrations/supabase/` | Supabase client and database types |
| `supabase/` | SQL migrations, RLS, integrity rules, and Edge Functions |

Do not manually edit `src/routeTree.gen.ts`. TanStack Router regenerates it.

There is a parallel `src/lib/metrics.ts`. Search imports before editing metrics. Do not assume changing only one metrics file updates every page. Consolidating the two sources is technical debt.

---

# 7. Local development

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add the following environment variables:

```dotenv
VITE_MYNTMORE_SUPABASE_URL=https://gapaawxbkfmpthfesuyw.supabase.co
VITE_MYNTMORE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Never place a Supabase service-role key in a `VITE_` variable. Vite exposes every `VITE_` variable to the browser.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run typecheck` | Run TypeScript validation |
| `npm run build` | Create a production build |
| `npm run check` | Run typecheck and build |
| `npm run preview` | Preview the production build locally |

---

# 8. How to make code changes

## Before starting

1. Pull the latest `main` branch.
2. Inspect `git status` and preserve unrelated changes.
3. Identify the entire flow: route, component, query, table, RLS policy, and affected roles.
4. Back up affected tables before a data change.
5. Keep commits focused and reviewable.

## Adding or changing a page

1. Create or update the feature component under `src/components/`.
2. Add or update its file route under `src/routes/`.
3. Apply `requireInternalUser` to operational routes.
4. Apply `requireAdmin` to settings, finance, and user-management routes.
5. Validate client identity for portal routes.
6. Update sidebar and top-bar navigation when required.
7. Test direct URL entry as well as navigation clicks.

## UI conventions

- Reuse components from `src/components/ui/`.
- Follow existing spacing, type, color, and empty-state patterns.
- Show useful success and error toasts.
- Never log passwords, tokens, keys, or sensitive row data.
- Empty assignments should produce a stable empty state, not an error.
- Historical records missing a new field must continue to render safely.

## Adding client-owned data

Every client-owned row should have an explicit `client_id` foreign key.

- Filter every read and mutation by `client_id`.
- Include client ID in TanStack Query cache keys.
- Validate ownership in the database where multiple owners exist.
- Add RLS before exposing the table to browser code.
- Test cross-client access directly through the Data API.

---

# 9. Metrics and calculations

Most client weekly metrics are stored in `weekly_data`:

- `content_metrics`: JSON keyed by content metric codes such as `Cxx`
- `leadgen_metrics`: JSON keyed by lead-generation metric codes such as `Lxx`

The main definitions are in `src/data/metrics.ts`. Derived metrics are handled through `resolveAutoCalc`.

## Changing a metric

1. Search for its label and metric code across the repository.
2. Confirm its category and storage table.
3. Update data entry and dashboard presentation together.
4. Update automatic calculation logic if derived.
5. Treat missing historical values as empty or zero.
6. Test totals, averages, percentages, and zero denominators.
7. Confirm disabled client services hide the field without removing its data.

## LinkedIn impression split

In-network and out-of-network values are percentages of total impressions. They must not be added together to produce impression count.

```text
In-network impressions = Total impressions × In-network percentage ÷ 100
Out-of-network impressions = Total impressions × Out-of-network percentage ÷ 100
Average impressions per post = Total impressions ÷ Posts published
```

---

# 10. Data entry and autosave

The autosave system must preserve the client and week that existed when the edit occurred. A delayed save must never use whichever client happens to be selected when the request finally runs.

## Required autosave tests

1. Edit Client A and immediately switch to Client B.
2. Wait for autosave, then reload both clients.
3. Confirm only Client A changed.
4. Repeat while switching reporting weeks.
5. Simulate a failed request and ensure user input stays visible.
6. Retry and confirm the correct unique row is updated.

TanStack Query keys must contain every scoping value, especially client and week. Never reuse one client's cache entry for another client.

---

# 11. Waalaxy CSV imports

Campaign weekly entry supports both manual editing and CSV prefill.

The importer:

- Processes the CSV locally in the browser
- Validates that it is a Waalaxy campaign export
- Counts request, acceptance, and detected-reply dates inside the selected week
- Fills Requests Sent, Accepted, and Answered
- Leaves every other field untouched and editable
- Does not save automatically

## User workflow

1. Export the intended campaign from Waalaxy's Statistics area.
2. Confirm the selected dashboard week.
3. Choose **Import from Waalaxy CSV**.
4. Review the inline summary.
5. Manually complete positive and negative replies, hot leads, meetings, and notes.
6. Click Save.

Answered is channel-agnostic because Waalaxy's last detected reply may come from LinkedIn or email.

---

# 12. Database model

## Identity and access

- `profiles`: application profile, department, and disabled status
- `user_roles`: admin/member authorization
- `invites`: account invitation workflow
- `client_assignments`: internal team-to-client assignments
- `tj_channel_assignments`: TJ channel ownership

Supabase Auth owns credentials in `auth.users`. Application migrations must not redefine or try to take ownership of this system table.

## Client operations

- `clients`
- `client_settings`
- `weekly_data`
- `campaigns`
- `campaign_weekly_data`
- `targets`
- `high_scores`
- `aha_moments`
- `client_alerts`
- `client_notifications`
- `client_health_scores`
- `client_context_notes`

## Internal operations

- `actionables`
- `myntmore_processes`
- `process_weekly_updates`
- `mm_weekly_data`
- `tj_weekly_data`
- `sales_weekly_data`
- `finance_data`
- `expenses`
- `growth_initiatives`
- `growth_initiative_comments`
- `initiatives`
- `hot_leads`

## Ownership hierarchy

```text
clients
  ├── client_settings
  ├── client_assignments
  ├── weekly_data
  ├── targets
  └── campaigns
       └── campaign_weekly_data
```

Campaign weekly data upserts using `(campaign_id, week_start)` while its `client_id` is validated against the parent campaign.

---

# 13. Security and client isolation

## Non-negotiable rules

1. Never run `DROP`, `TRUNCATE`, an unscoped `DELETE`, or a destructive reset in production.
2. Never expose the service-role key to the browser.
3. Never rely on UI hiding for authorization.
4. Every client-owned query must be scoped by `client_id`.
5. Campaign weekly rows must match the parent campaign's client.
6. Every new browser-accessed table must have RLS enabled and reviewed policies.
7. Test as admin, member, client, disabled, and anonymous identities.

## Campaign protection

Campaign isolation is intentionally redundant:

- Frontend queries filter by client.
- Pending autosaves retain their original client and week.
- `supabase/campaign_client_integrity.sql` validates the weekly row against its parent campaign.
- RLS limits the database rows visible to each identity.

Do not weaken any one of these layers.

## RLS references

- `supabase/secure_dashboard_rls.sql`: current comprehensive RLS hardening reference
- `supabase/campaign_client_integrity.sql`: campaign/client ownership enforcement

Do not blindly execute every historical SQL file against production. Review its purpose and chronology first.

---

# 14. Testing checklist

Run:

```bash
npm run check
git diff --check
```

Then verify:

- Login and logout work without reloading.
- Admin, member, and client navigation is correct.
- Disabled users are rejected.
- Client and week switching does not leak cached data.
- Manual entry, autosave, imports, and explicit Save work.
- Failure messages preserve user-entered values.
- Empty and historical data render safely.
- Changed pages work on narrow screens.
- Browser console and network requests show no unexpected errors.
- Anonymous requests cannot read dashboard tables.
- Members cannot access finance or admin account management.
- Client A cannot read or change Client B.

---

# 15. Deployment

1. Inspect `git status` and `git diff`.
2. Run `npm run check` and `git diff --check`.
3. Commit only intended files.
4. Push to the repository connected to Vercel.
5. Wait for the deployment to become Ready.
6. Test production login, dashboard loading, client switching, a read-only data view, and logout.
7. For data-entry changes, verify a controlled save reaches the exact intended client/week row.

Application code can be rolled back by redeploying the last known-good Vercel deployment or reverting the faulty commit. A code rollback does not automatically reverse a database migration.

---

# 16. Database migrations and backups

## Before migration

1. Name every affected table.
2. Export those tables.
3. Record row, null, duplicate, and ownership-mismatch counts.
4. Test against a non-production copy where possible.
5. Confirm SQL explicitly targets `myntmore`.

## Migration conventions

- Add a new SQL file under `supabase/`; do not rewrite production history.
- Use `BEGIN` and `COMMIT` for atomic changes.
- Prefer `ADD COLUMN IF NOT EXISTS` and guarded changes.
- Add RLS before exposing a new table.
- Keep schema changes and backfills independently reviewable where possible.
- Update TypeScript database types when shapes change.

```sql
begin;

alter table myntmore.example
  add column if not exists new_field text;

-- Add or adjust RLS deliberately.

commit;
```

## After migration

1. Repeat every pre-migration count.
2. Confirm RLS is enabled.
3. Test allowed and forbidden access for every identity type.
4. Run the related UI flow.
5. Keep the backup until the change is proven stable.

Do not delete the original source immediately after a migration. Reconcile counts and representative records, verify authentication separately, and retain the source for an agreed period.

---

# 17. User and password management

Use the dashboard's approved account-management flow backed by the `create-portal-user` Supabase Edge Function. It performs privileged operations without exposing the service-role credential.

Never:

- Put the service-role key in browser code, Git, chat, or documentation
- Edit password hashes using SQL
- Delete and recreate a user only to reset a password
- Log or commit temporary passwords

After an account change, confirm:

- The account can log in
- Its role is correct
- Its client linkage or assignments are correct
- It cannot access forbidden data

Communicate credentials using a separate secure channel.

---

# 18. Incident runbooks

## Data appears under the wrong client

1. Stop writes to the affected flow.
2. Capture the user, client, campaign, week, timestamps, and affected row IDs.
3. Export affected tables before correcting anything.
4. Check parent campaign ownership and duplicate weekly keys.
5. Inspect query keys, filters, payloads, and delayed autosaves.
6. Correct only identified rows inside a transaction.
7. Re-run ownership checks and rapid client/week-switching tests.

Do not attempt an immediate bulk cleanup.

## Saving failed

1. Preserve the user's visible input.
2. Capture the exact toast and failed network response.
3. Determine whether it is Auth, RLS, validation, conflict, connectivity, or schema mismatch.
4. Check whether the row was already written before retrying.
5. Confirm the upsert conflict columns match the unique database constraint.
6. Fix the cause and retry the same client/week entry.

## Logout leaves dashboard visible

The expected behavior is immediate removal of authenticated UI and navigation to `/login`.

1. Treat visible cached information as a security issue.
2. Confirm Supabase sign-out completes.
3. Confirm local Auth state is cleared.
4. Confirm the root layout redirects when the user becomes null.
5. Test browser back and forward after logout.
6. Verify protected requests are rejected after logout.

## Bug reports should include

- Exact page URL
- Selected client and reporting week
- User role
- Exact error message
- Steps to reproduce
- Screenshot where useful

Never include passwords, tokens, API keys, or sensitive exports.

---

# 19. Definition of done

A dashboard change is complete only when:

- Typecheck and production build pass
- The complete UI-to-database flow works
- Admin, member, and client boundaries are verified
- Old and partial data still render correctly
- Cross-client and cross-week isolation is tested
- Backups exist for data migrations
- No secrets or unrelated files are committed
- Production deployment and logout are smoke-tested

> Data preservation and client isolation take priority over speed. If ownership is uncertain, stop writes, preserve the current state, and investigate before changing records.
