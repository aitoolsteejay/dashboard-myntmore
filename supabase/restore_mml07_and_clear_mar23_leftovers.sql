-- Follow-up to redate_company_weeks_to_ceo_scorecard.sql, for databases where the FIRST version of that script
-- ran: it overwrote Myntmore LinkedIn Page Views (MML07) for Feb-Mar 2026 and lowered the app's best month (1,421).
-- 1) puts MML07 for 2 Feb - 16 Mar 2026 back from the backup taken before the re-date;
-- 2) clears the one-week-late copies left on 23 Mar 2026 (only where they still equal the sheet's 16 Mar values).
BEGIN;

UPDATE myntmore.mm_weekly_data n
SET linkedin = CASE WHEN b.linkedin ? 'MML07'
                    THEN n.linkedin || jsonb_build_object('MML07', b.linkedin -> 'MML07')
                    ELSE n.linkedin - 'MML07' END
FROM myntmore.backup_mm_weekly_before_redate b
WHERE b.week_start = n.week_start
  AND n.week_start BETWEEN '2026-02-02' AND '2026-03-16';

WITH expected(col, metric, val) AS (VALUES
  ('linkedin', 'MML02', '470'), ('linkedin', 'MML05', '2'), ('linkedin', 'MML06', '1152'),
  ('website',  'MMW01', '84'),  ('website',  'MMW02', '79'), ('website',  'MMW04', '54.8')
)
UPDATE myntmore.mm_weekly_data n
SET linkedin = myntmore.apply_patch(n.linkedin, COALESCE((
        SELECT jsonb_object_agg(e.metric, jsonb_build_object('value', NULL))
        FROM expected e WHERE e.col = 'linkedin' AND (n.linkedin -> e.metric ->> 'value') = e.val), '{}'::jsonb)),
    website  = myntmore.apply_patch(n.website, COALESCE((
        SELECT jsonb_object_agg(e.metric, jsonb_build_object('value', NULL))
        FROM expected e WHERE e.col = 'website' AND (n.website -> e.metric ->> 'value') = e.val), '{}'::jsonb))
WHERE n.week_start = '2026-03-23';

COMMIT;
