-- Defense-in-depth client isolation constraints.
-- No metric values are deleted. Existing campaign rows are repaired to their
-- campaign's canonical client before constraints are added.

BEGIN;

UPDATE myntmore.campaign_weekly_data AS weekly
SET client_id = campaign.client_id
FROM myntmore.campaigns AS campaign
WHERE weekly.campaign_id = campaign.id
  AND weekly.client_id IS DISTINCT FROM campaign.client_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_id_client_id_key'
      AND conrelid = 'myntmore.campaigns'::regclass
  ) THEN
    ALTER TABLE myntmore.campaigns
      ADD CONSTRAINT campaigns_id_client_id_key UNIQUE (id, client_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_weekly_campaign_client_fkey'
      AND conrelid = 'myntmore.campaign_weekly_data'::regclass
  ) THEN
    ALTER TABLE myntmore.campaign_weekly_data
      ADD CONSTRAINT campaign_weekly_campaign_client_fkey
      FOREIGN KEY (campaign_id, client_id)
      REFERENCES myntmore.campaigns(id, client_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION myntmore.enforce_actionable_campaign_client()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = myntmore, pg_temp
AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM myntmore.campaigns campaign
    WHERE campaign.id = NEW.campaign_id
      AND campaign.client_id = NEW.client_id
  ) THEN
    RAISE EXCEPTION 'Actionable campaign does not belong to the selected client'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS actionable_campaign_client_guard ON myntmore.actionables;
CREATE TRIGGER actionable_campaign_client_guard
BEFORE INSERT OR UPDATE OF campaign_id, client_id
ON myntmore.actionables
FOR EACH ROW
EXECUTE FUNCTION myntmore.enforce_actionable_campaign_client();

NOTIFY pgrst, 'reload schema';
COMMIT;
