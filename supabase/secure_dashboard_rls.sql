-- Security hardening for the isolated Myntmore schema.
-- This migration changes functions, grants, and RLS policies only; it does not
-- delete or rewrite business data.

BEGIN;

CREATE OR REPLACE FUNCTION myntmore.has_role(_user_id uuid, _role myntmore.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = myntmore, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM myntmore.user_roles ur
    JOIN myntmore.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND COALESCE(p.disabled, false) = false
  )
$$;

CREATE OR REPLACE FUNCTION myntmore.is_internal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = myntmore, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM myntmore.user_roles ur
    JOIN myntmore.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::myntmore.app_role, 'member'::myntmore.app_role)
      AND COALESCE(p.disabled, false) = false
      AND COALESCE(p.department, '') <> 'client'
  )
$$;

CREATE OR REPLACE FUNCTION myntmore.is_own_client(target_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = myntmore, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM myntmore.clients c
    JOIN myntmore.profiles p ON p.id = auth.uid()
    WHERE c.id = target_client_id
      AND c.user_id = auth.uid()
      AND p.department = 'client'
      AND COALESCE(p.disabled, false) = false
  )
$$;

CREATE OR REPLACE FUNCTION myntmore.is_assigned(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = myntmore, pg_temp
AS $$
  SELECT myntmore.is_internal_user()
    AND EXISTS (
      SELECT 1
      FROM myntmore.client_assignments ca
      WHERE ca.user_id = _user_id AND ca.client_id = _client_id
    )
$$;

-- Remove every inherited policy, including permissive policies such as
-- `*_open` and `*_all_auth` that allowed client accounts to see shared data.
DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'myntmore'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

-- Anonymous users use narrowly scoped SECURITY DEFINER RPCs for invite lookup;
-- they never need direct table access.
REVOKE ALL ON ALL TABLES IN SCHEMA myntmore FROM anon;
GRANT USAGE ON SCHEMA myntmore TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA myntmore TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA myntmore TO service_role;
GRANT EXECUTE ON FUNCTION myntmore.get_invite_by_token(text) TO anon, authenticated, service_role;

-- Internal operational tables. Active internal members retain full access.
CREATE POLICY actionables_internal_all ON myntmore.actionables FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY aha_moments_internal_all ON myntmore.aha_moments FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY campaign_weekly_data_internal_all ON myntmore.campaign_weekly_data FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY campaigns_internal_all ON myntmore.campaigns FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY client_alerts_internal_all ON myntmore.client_alerts FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY client_context_notes_internal_all ON myntmore.client_context_notes FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY client_health_scores_internal_all ON myntmore.client_health_scores FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY client_notifications_internal_all ON myntmore.client_notifications FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY clients_internal_all ON myntmore.clients FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY growth_comments_internal_all ON myntmore.growth_initiative_comments FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY growth_initiatives_internal_all ON myntmore.growth_initiatives FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY high_scores_internal_all ON myntmore.high_scores FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY hot_leads_internal_all ON myntmore.hot_leads FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY initiatives_internal_all ON myntmore.initiatives FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY mm_weekly_data_internal_all ON myntmore.mm_weekly_data FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY processes_internal_all ON myntmore.myntmore_processes FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY process_updates_internal_all ON myntmore.process_weekly_updates FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY sales_weekly_data_internal_all ON myntmore.sales_weekly_data FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY targets_internal_all ON myntmore.targets FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY tj_assignments_internal_all ON myntmore.tj_channel_assignments FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY tj_weekly_data_internal_all ON myntmore.tj_weekly_data FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());
CREATE POLICY weekly_data_internal_all ON myntmore.weekly_data FOR ALL TO authenticated
  USING (myntmore.is_internal_user()) WITH CHECK (myntmore.is_internal_user());

-- Settings and assignment metadata are readable by internal members but writable
-- only by admins.
CREATE POLICY assignments_internal_read ON myntmore.client_assignments FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());
CREATE POLICY assignments_admin_all ON myntmore.client_assignments FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));
CREATE POLICY client_settings_internal_read ON myntmore.client_settings FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());
CREATE POLICY client_settings_admin_all ON myntmore.client_settings FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));
CREATE POLICY invites_admin_all ON myntmore.invites FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));
CREATE POLICY expenses_admin_all ON myntmore.expenses FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));
CREATE POLICY finance_admin_all ON myntmore.finance_data FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));

-- Profiles and roles: admins manage them; active internal members may see the team;
-- every authenticated user may see only their own identity/role for routing.
CREATE POLICY profiles_admin_all ON myntmore.profiles FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));
CREATE POLICY profiles_internal_read ON myntmore.profiles FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());
CREATE POLICY profiles_self_read ON myntmore.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY user_roles_admin_all ON myntmore.user_roles FOR ALL TO authenticated
  USING (myntmore.has_role(auth.uid(), 'admin')) WITH CHECK (myntmore.has_role(auth.uid(), 'admin'));
CREATE POLICY user_roles_self_read ON myntmore.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Client portal accounts are strictly read-only and limited to their linked client.
CREATE POLICY clients_portal_own_read ON myntmore.clients FOR SELECT TO authenticated
  USING (myntmore.is_own_client(id));
CREATE POLICY weekly_data_portal_own_read ON myntmore.weekly_data FOR SELECT TO authenticated
  USING (myntmore.is_own_client(client_id));
CREATE POLICY targets_portal_own_read ON myntmore.targets FOR SELECT TO authenticated
  USING (myntmore.is_own_client(client_id));
CREATE POLICY campaigns_portal_own_read ON myntmore.campaigns FOR SELECT TO authenticated
  USING (myntmore.is_own_client(client_id));
CREATE POLICY campaign_weekly_portal_own_read ON myntmore.campaign_weekly_data FOR SELECT TO authenticated
  USING (myntmore.is_own_client(client_id));
CREATE POLICY aha_moments_portal_own_read ON myntmore.aha_moments FOR SELECT TO authenticated
  USING (myntmore.is_own_client(client_id));
CREATE POLICY high_scores_portal_own_read ON myntmore.high_scores FOR SELECT TO authenticated
  USING (myntmore.is_own_client(client_id));

NOTIFY pgrst, 'reload schema';
COMMIT;
