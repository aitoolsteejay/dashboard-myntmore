-- custom_metrics only has two policies (admin_full_access, client_read_own), so a
-- non-admin team member (internal user) reads ZERO rows: the EOM report, data entry and
-- the dashboard silently omit every client's custom metrics for them. Give every
-- internal user read access; writes stay admin-only. Safe to re-run.
BEGIN;

DROP POLICY IF EXISTS custom_metrics_internal_read ON myntmore.custom_metrics;
CREATE POLICY custom_metrics_internal_read ON myntmore.custom_metrics FOR SELECT TO authenticated
  USING (myntmore.is_internal_user());

COMMIT;
