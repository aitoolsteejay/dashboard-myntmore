# Operations runbook

## Production inventory

- Application: [dashboard-myntmore-five.vercel.app](https://dashboard-myntmore-five.vercel.app)
- GitHub: [aitoolsteejay/dashboard-myntmore](https://github.com/aitoolsteejay/dashboard-myntmore)
- Supabase project: `gapaawxbkfmpthfesuyw`
- Application database schema: `myntmore`
- Hosting: Vercel

The Supabase project also contains another internal tool. All dashboard SQL must explicitly target `myntmore`; never run broad schema/database cleanup commands.

## Deploy code

1. Confirm only intended files are changed with `git status` and `git diff`.
2. Run `npm run check` and `git diff --check`.
3. Commit and push to the repository/branch connected to Vercel.
4. Wait for the Vercel deployment to become Ready.
5. Smoke-test production login, dashboard, client switch, one read-only data view, and logout.
6. For a data-entry change, save a controlled test value and verify the exact database row/client/week, then restore it if it was synthetic.

Rollback application code by redeploying the last known-good Vercel deployment or reverting the faulty commit. A code rollback does not automatically reverse a database migration.

## Database change procedure

### Before

1. Name the affected tables and expected transformation.
2. Export/backup those tables.
3. Record row counts, null counts, duplicate counts, and ownership mismatches.
4. Test the SQL against a non-production copy where possible.
5. Confirm it never touches unrelated schemas.

Example observations:

```sql
select count(*) from myntmore.campaign_weekly_data;

select count(*)
from myntmore.campaign_weekly_data cwd
join myntmore.campaigns c on c.id = cwd.campaign_id
where cwd.client_id is distinct from c.client_id;
```

### Apply

- Use an explicit transaction for atomic changes.
- Run schema changes before data backfills only when the new schema is backward compatible.
- Avoid locking rewrites during active data-entry hours.
- Do not use the SQL editor for a huge dump; use a direct PostgreSQL connection for large imports.

### After

1. Re-run all pre-change counts.
2. Check RLS is enabled on every new/modified table.
3. Test permitted and forbidden access for admin, member, client, and anonymous contexts.
4. Run the related UI flow and inspect browser/network errors.
5. Retain the backup until the change has been stable.

## Creating users and resetting passwords

Use the dashboard's admin account-management flow backed by the `create-portal-user` Edge Function. This ensures application profile/role records remain aligned with Supabase Auth.

Do not:

- Put a service-role key in browser code, chat, documentation, or Git.
- Edit password hashes in SQL.
- Delete and recreate a user merely to change a password; it can orphan profile/assignment relationships.
- Log or commit temporary passwords.

After a change, verify the account can log in, receives the intended role, has the expected assignments/client mapping, and cannot reach forbidden data. Communicate credentials through a separate secure channel and require rotation where practical.

## Security verification

At minimum, verify:

- Anonymous Data API requests cannot read dashboard tables.
- A client can read only its linked client row, weekly data, and campaigns.
- A member cannot access finance, expenses, or admin user management.
- A disabled profile cannot continue using the dashboard.
- Client-owned TanStack Query keys contain client identity.
- Campaign weekly rows match the parent campaign's client.
- The service-role credential exists only in the Edge Function environment.
- No `.env*`, database dumps, CSV exports, or passwords are staged in Git.

Run `supabase/secure_dashboard_rls.sql` only as a reviewed migration/reference for the intended database state. Re-running old access scripts afterward may weaken newer policies.

## Incident: data appears under the wrong client

1. Stop writes to the affected feature; do not delete or bulk-correct immediately.
2. Capture user, selected client, campaign, week, timestamps, and affected row IDs.
3. Export affected tables before changing anything.
4. Compare campaign/client ownership and look for duplicate weekly keys.
5. Inspect frontend query keys, filters, mutation payloads, and delayed autosaves.
6. Repair only identified rows in a transaction with a documented mapping.
7. Re-run ownership queries and test rapid client/week switching.

## Incident: save failed

1. Preserve the user's current values and capture the exact toast/network error.
2. Determine whether the failure is authentication, RLS, validation, conflict, connectivity, or schema mismatch.
3. Check whether a row was written before retrying to avoid duplicate records.
4. Verify the upsert conflict columns match the database unique constraint.
5. Fix the cause and retry the same scoped client/week entry.

## Incident: logout leaves protected UI visible

Expected behavior is immediate removal of authenticated UI and navigation to `/login`. If not:

1. Treat visible cached data as a security issue even if subsequent API calls fail.
2. Confirm Supabase `signOut` completes and local auth state is cleared.
3. Confirm the root layout redirects when `user` becomes null.
4. Test browser back/forward navigation after logout.
5. Verify protected requests return unauthorized and no sensitive response is served from an application cache.

## Backup and migration rule

Data preservation takes priority over speed. Never delete source data immediately after a migration. Keep a verified export, reconcile counts and representative records, test authentication separately from profile data, and only retire the old source after an agreed retention period.
