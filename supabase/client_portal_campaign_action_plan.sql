-- Client portal campaign details and action plan.
-- Backward-compatible: existing campaigns/actionables remain internal until
-- explicitly enriched or marked client-visible.

BEGIN;

ALTER TABLE myntmore.campaigns
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS account_manager_interpretation text;

ALTER TABLE myntmore.actionables
  ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS responsibility text NOT NULL DEFAULT 'myntmore',
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES myntmore.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_comment text,
  ADD COLUMN IF NOT EXISTS client_updated_at timestamptz;

ALTER TABLE myntmore.actionables
  DROP CONSTRAINT IF EXISTS actionables_responsibility_check;
ALTER TABLE myntmore.actionables
  ADD CONSTRAINT actionables_responsibility_check
  CHECK (responsibility IN ('myntmore', 'client'));

DROP POLICY IF EXISTS actionables_portal_visible_read ON myntmore.actionables;
CREATE POLICY actionables_portal_visible_read
ON myntmore.actionables
FOR SELECT TO authenticated
USING (
  client_visible = true
  AND myntmore.is_own_client(client_id)
);

CREATE OR REPLACE FUNCTION myntmore.client_update_actionable(
  target_actionable_id uuid,
  next_status text,
  next_comment text DEFAULT NULL
)
RETURNS myntmore.actionables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = myntmore, pg_temp
AS $$
DECLARE
  updated_actionable myntmore.actionables;
BEGIN
  IF next_status NOT IN ('open', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid actionable status';
  END IF;

  UPDATE myntmore.actionables
  SET status = next_status,
      client_comment = NULLIF(BTRIM(next_comment), ''),
      client_updated_at = now()
  WHERE id = target_actionable_id
    AND client_visible = true
    AND responsibility = 'client'
    AND myntmore.is_own_client(client_id)
  RETURNING * INTO updated_actionable;

  IF updated_actionable.id IS NULL THEN
    RAISE EXCEPTION 'Actionable is not available for client updates';
  END IF;

  RETURN updated_actionable;
END;
$$;

REVOKE ALL ON FUNCTION myntmore.client_update_actionable(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION myntmore.client_update_actionable(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
