-- Enwil and Tejas meeting trackers now have the same fields as the company tracker, with their own sources:
--   Enwil : LinkedIn, Cold Email, Referral, Website | AI, WA        (SE04 "Other" retired)
--   Tejas : LinkedIn, Cold Email, Referral, Website | AI, WA, TJ    (ST04 "Other" retired)
-- No schema change is needed — the new fields live in the existing enwil_meetings / tejas_meetings
-- jsonb columns. What is left is the numbers already typed in under "Booked via Other".
-- The app no longer shows or counts "Other", but it keeps the old number in the stored row.
--
-- STEP 1 — look first (read-only). Which weeks have a number under "Other", and what total is stored?
SELECT week_start, 'Enwil' AS tracker, enwil_meetings->>'SE04' AS other_value, enwil_meetings->>'SE06' AS stored_total
FROM myntmore.sales_weekly_data
WHERE COALESCE(NULLIF(enwil_meetings->>'SE04', ''), '0')::numeric <> 0
UNION ALL
SELECT week_start, 'Tejas', tejas_meetings->>'ST04', tejas_meetings->>'ST06'
FROM myntmore.sales_weekly_data
WHERE COALESCE(NULLIF(tejas_meetings->>'ST04', ''), '0')::numeric <> 0
ORDER BY week_start, tracker;

-- STEP 2 — recalculate the stored totals and rates under the new rules (total = the new sources only).
-- Choose what happens to the old "Other" numbers by changing ONE word on the line marked  <== CHOOSE:
--   true  (OPTION A): the "Other" numbers were really WhatsApp bookings -> add them to "Booked via WA".
--   false (OPTION B): just leave "Other" out of the totals (the old number stays in the row, unused).
-- Backs the rows up first (backup table has RLS on and no policies, like the earlier backup tables).
-- Safe to re-run: after OPTION A the "Other" fields are gone, so a second run moves nothing.

BEGIN;
CREATE TABLE IF NOT EXISTS myntmore.backup_sales_meetings_before_new_fields AS
  SELECT id, week_start, enwil_meetings, tejas_meetings FROM myntmore.sales_weekly_data;
ALTER TABLE myntmore.backup_sales_meetings_before_new_fields ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION pg_temp.n(j jsonb, k text) RETURNS numeric LANGUAGE sql IMMUTABLE AS
  $$ SELECT COALESCE(NULLIF(j->>k, '')::numeric, 0) $$;
CREATE FUNCTION pg_temp.r(a numeric, b numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS
  $$ SELECT CASE WHEN b > 0 THEN round(a / b * 100, 1) ELSE 0 END $$;

DO $$
DECLARE
  move_other_to_wa boolean := true;   -- <== CHOOSE: true = OPTION A, false = OPTION B
BEGIN
  IF move_other_to_wa THEN
    UPDATE myntmore.sales_weekly_data
    SET enwil_meetings = (enwil_meetings - 'SE04')
      || jsonb_build_object('SE07', pg_temp.n(enwil_meetings, 'SE07') + pg_temp.n(enwil_meetings, 'SE04'))
    WHERE enwil_meetings ? 'SE04';
    UPDATE myntmore.sales_weekly_data
    SET tejas_meetings = (tejas_meetings - 'ST04')
      || jsonb_build_object('ST07', pg_temp.n(tejas_meetings, 'ST07') + pg_temp.n(tejas_meetings, 'ST04'))
    WHERE tejas_meetings ? 'ST04';
  END IF;

  UPDATE myntmore.sales_weekly_data s
  SET enwil_meetings = s.enwil_meetings || jsonb_build_object(
    'SE06', t.total,
    'SE10', pg_temp.r(pg_temp.n(s.enwil_meetings, 'SE08'), t.total),
    'SE14', pg_temp.r(pg_temp.n(s.enwil_meetings, 'SE13'), t.total),
    'SE16', pg_temp.n(s.enwil_meetings, 'SE13') * pg_temp.n(s.enwil_meetings, 'SE15'))
  FROM (SELECT id, pg_temp.n(enwil_meetings, 'SE01') + pg_temp.n(enwil_meetings, 'SE02') + pg_temp.n(enwil_meetings, 'SE03')
                   + pg_temp.n(enwil_meetings, 'SE05') + pg_temp.n(enwil_meetings, 'SE07') AS total
        FROM myntmore.sales_weekly_data) t
  WHERE s.id = t.id AND s.enwil_meetings <> '{}'::jsonb;

  UPDATE myntmore.sales_weekly_data s
  SET tejas_meetings = s.tejas_meetings || jsonb_build_object(
    'ST06', t.total,
    'ST11', pg_temp.r(pg_temp.n(s.tejas_meetings, 'ST09'), t.total),
    'ST15', pg_temp.r(pg_temp.n(s.tejas_meetings, 'ST14'), t.total),
    'ST17', pg_temp.n(s.tejas_meetings, 'ST14') * pg_temp.n(s.tejas_meetings, 'ST16'))
  FROM (SELECT id, pg_temp.n(tejas_meetings, 'ST01') + pg_temp.n(tejas_meetings, 'ST02') + pg_temp.n(tejas_meetings, 'ST03')
                   + pg_temp.n(tejas_meetings, 'ST05') + pg_temp.n(tejas_meetings, 'ST07') + pg_temp.n(tejas_meetings, 'ST08') AS total
        FROM myntmore.sales_weekly_data) t
  WHERE s.id = t.id AND s.tejas_meetings <> '{}'::jsonb;
END $$;
COMMIT;
