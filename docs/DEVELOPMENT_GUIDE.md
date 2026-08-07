# Development guide

## Before changing code

1. Pull the latest `main` branch and inspect `git status`.
2. Preserve unrelated local changes.
3. Identify the complete flow: route, component, query/hook, table, RLS policy, and every role that uses it.
4. For data changes, take a backup and record relevant row counts first.
5. Create a focused branch/commit; do not mix a database migration with unrelated visual cleanup.

## Project conventions

- TypeScript and React functional components.
- `@/` resolves to `src/`.
- Feature components live under `src/components/<feature>/`.
- Reuse components from `src/components/ui/` and the established spacing/color tokens.
- Use TanStack Query for remote data and invalidate the precise keys after mutation.
- Display actionable error toasts; log enough context for diagnosis without logging credentials or sensitive row contents.
- Keep changes backward compatible with existing rows. Treat missing new JSON keys/columns as a valid legacy state.

## Add or change a page

1. Add/update the feature component in `src/components/`.
2. Add/update the file route in `src/routes/`.
3. Add the correct `beforeLoad` guard:
   - `requireInternalUser` for admin/member operational pages.
   - `requireAdmin` for settings, finance, user administration, or security-sensitive pages.
   - Portal pages must validate the user's client identity.
4. Update sidebar/topbar navigation if necessary.
5. Let the router plugin regenerate `src/routeTree.gen.ts`; never edit it manually.
6. Test direct URL navigation as well as clicking through the UI.

## Add or change a metric

1. Search the repository for the metric label and code.
2. Confirm whether it belongs to content, lead generation, campaign, MM, TJ, or sales data.
3. Update the definition used by the relevant page—normally `src/data/metrics.ts` for client weekly fields.
4. If it is derived, update `resolveAutoCalc` and store only its source values where possible.
5. Update data-entry and dashboard presentation together.
6. Confirm historical rows without the new key still render as zero/empty rather than failing.
7. Check client service flags/settings so disabled services do not show irrelevant fields.
8. Test totals, averages, percentages, and zero denominators.

For LinkedIn impressions, in-network and out-of-network values are percentage splits of total impressions. Do not add the percentages to produce total impressions. Derived reach/splits must use total impressions multiplied by each percentage.

## Change a Supabase table

1. Add a new, idempotent SQL file under `supabase/`; do not rewrite production history.
2. Use `BEGIN`/`COMMIT` for a migration that must apply atomically.
3. Prefer `ADD COLUMN IF NOT EXISTS`, guarded policy/function changes, and explicit schemas.
4. Update generated/local TypeScript database types when the shape changes.
5. Enable RLS and define policies before exposing the table to the frontend.
6. Backfill in a separate, reviewable statement when possible.
7. Verify pre/post row counts and null/ownership checks.

Safe skeleton:

```sql
begin;

alter table myntmore.example
  add column if not exists new_field text;

-- Add/adjust RLS deliberately here.

commit;
```

Do not copy policies from the `public` schema without changing them to `myntmore` and validating their helper functions.

## Add client-owned data

Every client-owned row should have an explicit `client_id` foreign key. Then:

- Include `client_id` in every query and mutation.
- Include client ID in TanStack Query cache keys.
- Validate ownership server-side with a foreign key/trigger where a second owner exists (for example campaign plus client).
- Add portal RLS using the authenticated user's profile/client mapping.
- Test that Client A cannot read or write Client B by calling the Data API directly, not only through the UI.

## Modify autosave/data entry

The autosave hook associates pending work with its client and week. Preserve that context through debounce, retries, and component unmounts. A save should use the identifiers captured when the user edited—not whatever client happens to be selected when the request finally runs.

For any save flow test:

1. Edit Client A, immediately switch to Client B, and wait for autosave.
2. Reload both clients and confirm only A changed.
3. Switch week during a pending save and repeat.
4. Simulate a failed request and confirm the UI reports failure without discarding the user's visible input.
5. Retry and confirm the upsert targets the intended unique key.

## Local verification checklist

Run:

```bash
npm run check
git diff --check
```

Then test in the browser:

- Login and logout without a reload.
- Admin, member, and client navigation.
- Client/week switching and cache isolation.
- Manual data entry, autosave, explicit Save flows, and failure messages.
- Empty, partial, and historical data.
- Mobile/narrow layout for the changed page.
- Browser console and network panel for errors.

## Definition of done

A change is done only when code checks pass, the complete UI-to-database flow works, role boundaries are verified, old data remains readable, no unrelated files are committed, and production deployment health is confirmed.
