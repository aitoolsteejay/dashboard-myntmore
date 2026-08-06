-- Keep campaign weekly data attached to the campaign's canonical client.
-- Existing metric values are preserved; only an incorrect denormalized client_id
-- is repaired. Future writes derive client_id from campaigns automatically.

BEGIN;

CREATE OR REPLACE FUNCTION myntmore.enforce_campaign_weekly_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = myntmore, pg_temp
AS $$
DECLARE
  canonical_client_id uuid;
BEGIN
  SELECT client_id
  INTO canonical_client_id
  FROM myntmore.campaigns
  WHERE id = NEW.campaign_id;

  IF canonical_client_id IS NULL THEN
    RAISE EXCEPTION 'Campaign % does not exist or has no client', NEW.campaign_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.client_id := canonical_client_id;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS campaign_weekly_client_guard
  ON myntmore.campaign_weekly_data;
CREATE TRIGGER campaign_weekly_client_guard
BEFORE INSERT OR UPDATE OF campaign_id, client_id
ON myntmore.campaign_weekly_data
FOR EACH ROW
EXECUTE FUNCTION myntmore.enforce_campaign_weekly_client();

-- Repair mismatches without changing campaign metrics, notes, dates, or IDs.
UPDATE myntmore.campaign_weekly_data AS weekly
SET client_id = campaign.client_id
FROM myntmore.campaigns AS campaign
WHERE weekly.campaign_id = campaign.id
  AND weekly.client_id IS DISTINCT FROM campaign.client_id;

CREATE OR REPLACE FUNCTION myntmore.is_own_campaign(target_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = myntmore, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM myntmore.campaigns campaign
    JOIN myntmore.clients client ON client.id = campaign.client_id
    JOIN myntmore.profiles profile ON profile.id = auth.uid()
    WHERE campaign.id = target_campaign_id
      AND client.user_id = auth.uid()
      AND profile.department = 'client'
      AND COALESCE(profile.disabled, false) = false
  )
$$;

DROP POLICY IF EXISTS campaign_weekly_portal_own_read
  ON myntmore.campaign_weekly_data;
CREATE POLICY campaign_weekly_portal_own_read
ON myntmore.campaign_weekly_data
FOR SELECT TO authenticated
USING (myntmore.is_own_campaign(campaign_id));

NOTIFY pgrst, 'reload schema';
COMMIT;
