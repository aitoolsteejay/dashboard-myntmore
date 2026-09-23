-- ProcessesPage.tsx only shows "New Process" and "Delete" to isAdmin users
-- (any internal user can view processes and mark them active/completed via
-- "Reopen"/"Complete"), but the existing RLS policy (processes_internal_all,
-- secure_dashboard_rls.sql) granted ALL operations — including insert and
-- delete — to any internal user, not just admins. A non-admin team member
-- could create or permanently delete a process by calling the Supabase
-- client directly, bypassing the UI gate entirely.
--
-- Splits the single FOR ALL policy into: read + update open to every
-- internal user (matches the ungated "Reopen"/"Complete" status-change
-- button), insert + delete restricted to admins (matches the isAdmin-gated
-- "New Process"/"Delete" buttons). process_weekly_updates is untouched —
-- its own FOR ALL internal-user policy already matches the UI, where any
-- internal user may add or edit a weekly update and there is no delete
-- action for it at all.

BEGIN;

DROP POLICY IF EXISTS processes_internal_all ON myntmore.myntmore_processes;

CREATE POLICY processes_internal_read ON myntmore.myntmore_processes FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());
CREATE POLICY processes_internal_update ON myntmore.myntmore_processes FOR UPDATE TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY processes_admin_insert ON myntmore.myntmore_processes FOR INSERT TO authenticated
  WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));
CREATE POLICY processes_admin_delete ON myntmore.myntmore_processes FOR DELETE TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin'));

COMMIT;
