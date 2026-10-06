-- clients, targets, tj_custom_metrics and tj_channel_assignments each had a single FOR ALL policy
-- granting every internal user full write access, while their UI write paths
-- are all admin-only:
--   - clients:            ClientsPage.tsx's Add/Edit/Archive are `{isAdmin && ...}`,
--                          and ClientSettingsPage.tsx's portal-account linking is
--                          gated by an `isAdmin` check.
--   - targets:             the only write path, SettingsTargetsPage.tsx, is reachable
--                          solely via the admin-only `/settings` route.
--   - tj_custom_metrics:   TJChannelAssignmentsTab.tsx has no isAdmin check of its
--                          own, but it too is only reachable via the admin-only
--                          `/settings` route.
-- A non-admin internal user could otherwise bypass all three UI gates with a
-- direct Supabase client call. This splits each into an internal-read policy
-- (unchanged access for every internal user) plus an admin-only all-actions
-- policy, matching the existing client_assignments/client_settings pattern.
BEGIN;

DROP POLICY IF EXISTS clients_internal_all ON myntmore.clients;
CREATE POLICY clients_internal_read ON myntmore.clients FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());
CREATE POLICY clients_admin_all ON myntmore.clients FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS targets_internal_all ON myntmore.targets;
CREATE POLICY targets_internal_read ON myntmore.targets FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());
CREATE POLICY targets_admin_all ON myntmore.targets FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "tj_custom_metrics_internal_all" ON myntmore.tj_custom_metrics;
CREATE POLICY tj_custom_metrics_internal_read ON myntmore.tj_custom_metrics FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());
CREATE POLICY tj_custom_metrics_admin_all ON myntmore.tj_custom_metrics FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));

-- tj_channel_assignments: same gap. Its only write path (TJChannelAssignmentsTab
-- under the admin-only /settings route) is admin-only, but secure_dashboard_rls.sql
-- gave every internal user FOR ALL.
DROP POLICY IF EXISTS tj_assignments_internal_all ON myntmore.tj_channel_assignments;
CREATE POLICY tj_assignments_internal_read ON myntmore.tj_channel_assignments FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());
CREATE POLICY tj_assignments_admin_all ON myntmore.tj_channel_assignments FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));

COMMIT;
