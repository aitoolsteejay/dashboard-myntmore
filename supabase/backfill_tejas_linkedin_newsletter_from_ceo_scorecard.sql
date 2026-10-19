-- Tejas Jhaveri: move his newsletter data into the LinkedIn Newsletter fields, then backfill
-- his LinkedIn newsletter history from the CEO scorecard ("LINKEDIN NEWSLETTER" section,
-- Feb 2025 - Mar 2026).
--
-- Tejas's existing "Newsletter" entries (C32-C35, entered before Email and LinkedIn newsletters were
-- split into two sections) are LinkedIn newsletter numbers, so:
--   C32 Newsletter Subscribers -> C41 LinkedIn Newsletter Subscribers
--   C33 Newsletter Sent        -> C42 LinkedIn Newsletter Issues Published
--   C34 Newsletter Open Rate   -> C44 LinkedIn Newsletter Open Rate (new field)
--   C35 Newsletter Click Rate  -> dropped (it was blank; LinkedIn newsletters have no click-rate field)
-- Backfill from the sheet: Subscriber count -> C41, Email open rate -> C44 (fraction x 100),
-- Article Views -> C43. Not imported (no matching field): New subscribers, Members reached, Email
-- sends, Impressions.
--
-- Weeks: sheet Week 1..4 -> Mondays starting from the week containing the 1st of the sheet's month
-- (validated against weeks the app already holds). Only non-zero values; anything already stored
-- wins (myntmore.merge_import fills only blank null/empty/0 cells), so re-running is safe. Run in the Supabase SQL editor.
BEGIN;

-- Fills only BLANK existing cells (value null / "" / 0, keeping their note + target); any real value already stored wins.
CREATE OR REPLACE FUNCTION myntmore.merge_import(new_vals jsonb, old_vals jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $f$
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM (
    SELECT COALESCE(o.key, n.key) AS k,
      CASE
        WHEN o.key IS NULL THEN n.value
        WHEN n.key IS NULL THEN o.value
        WHEN jsonb_typeof(o.value) <> 'object' THEN n.value
        WHEN o.value->>'value' IS NULL OR o.value->>'value' IN ('', '0') THEN o.value || n.value
        ELSE o.value
      END AS v
    FROM jsonb_each(COALESCE(old_vals, '{}'::jsonb)) o
    FULL JOIN jsonb_each(COALESCE(new_vals, '{}'::jsonb)) n ON o.key = n.key
  ) s
$f$;


-- 1) Active fields: hide the Email newsletter fields, show the LinkedIn ones.
UPDATE myntmore.client_settings
SET active_content_metrics = (
  SELECT array_agg(DISTINCT id)
  FROM unnest(active_content_metrics || ARRAY['C41','C42','C43','C44']) AS id
  WHERE id NOT IN ('C32','C33','C34','C35')
)
WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND active_content_metrics IS NOT NULL;

-- 2) Move the values he already entered (the moved objects keep their note/target).
UPDATE myntmore.weekly_data
SET content_metrics =
  jsonb_strip_nulls(jsonb_build_object(
    'C41', content_metrics->'C32',
    'C42', content_metrics->'C33',
    'C44', content_metrics->'C34'
  )) || (content_metrics - 'C32' - 'C33' - 'C34' - 'C35')
WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f'
  AND (content_metrics ? 'C32' OR content_metrics ? 'C33' OR content_metrics ? 'C34' OR content_metrics ? 'C35');

-- 3) Drop his now-orphaned records for the old fields (the dashboard rebuilds C41/C42/C44 from the weeks).
DELETE FROM myntmore.high_scores
WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND metric_id IN ('C32','C33','C34','C35');

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1172},"C43":{"value":238}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-01-27';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1206},"C43":{"value":230}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-02-03';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1217},"C44":{"value":20},"C43":{"value":227}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-02-10';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1228},"C44":{"value":22},"C43":{"value":196}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-02-17';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1241},"C44":{"value":24},"C43":{"value":245}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-02-24';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1251},"C44":{"value":23},"C43":{"value":262}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-03-03';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1286},"C44":{"value":25},"C43":{"value":249}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-03-10';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1296},"C44":{"value":23},"C43":{"value":234}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-03-17';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1333},"C44":{"value":26},"C43":{"value":306}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-04-07';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1345},"C44":{"value":27},"C43":{"value":316}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-04-14';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1361},"C44":{"value":24},"C43":{"value":373}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-04-21';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1383},"C44":{"value":30},"C43":{"value":364}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-04-28';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1389},"C44":{"value":29},"C43":{"value":330}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-05-05';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1397},"C44":{"value":21},"C43":{"value":238}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-05-12';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1403},"C44":{"value":28},"C43":{"value":325}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-05-19';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1409},"C44":{"value":21},"C43":{"value":214}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-05-26';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1424},"C44":{"value":20},"C43":{"value":285}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-06-02';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1427},"C44":{"value":21},"C43":{"value":220}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-06-09';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1428},"C44":{"value":21},"C43":{"value":203}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-06-16';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1438},"C44":{"value":19},"C43":{"value":210}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-07-07';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1445},"C44":{"value":18},"C43":{"value":199}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-07-14';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1449},"C44":{"value":20},"C43":{"value":200}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-07-21';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1459},"C44":{"value":19},"C43":{"value":208}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-07-28';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1456},"C44":{"value":18},"C43":{"value":229}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-08-11';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1460},"C44":{"value":19},"C43":{"value":242}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-08-18';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1467},"C44":{"value":19},"C43":{"value":257}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-01';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1472},"C44":{"value":17},"C43":{"value":221}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-08';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1473},"C44":{"value":16},"C43":{"value":195}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-15';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1478},"C44":{"value":17},"C43":{"value":274}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-22';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1481},"C44":{"value":18},"C43":{"value":225}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-29';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1487},"C44":{"value":18},"C43":{"value":223}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-10-06';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1494},"C44":{"value":17},"C43":{"value":216}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-10-13';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1498},"C44":{"value":15},"C43":{"value":200}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-10-20';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1506},"C44":{"value":19},"C43":{"value":272}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-10-27';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1508},"C44":{"value":16},"C43":{"value":223}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-11-03';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1513},"C44":{"value":18},"C43":{"value":242}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-11-10';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1521},"C44":{"value":17},"C43":{"value":237}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-11-17';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1525},"C44":{"value":18},"C43":{"value":252}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-12-01';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1537},"C44":{"value":18},"C43":{"value":172}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-12-08';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1541},"C44":{"value":17},"C43":{"value":225}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-12-15';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1547},"C44":{"value":19},"C43":{"value":250}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-12-22';

UPDATE myntmore.weekly_data SET content_metrics = myntmore.merge_import('{"C41":{"value":1639},"C44":{"value":16},"C43":{"value":249}}'::jsonb, content_metrics)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2026-03-16';

-- Weeks that had no row yet:

INSERT INTO myntmore.weekly_data AS w (client_id, week_start, week_end, week_label, content_metrics, leadgen_metrics)
  VALUES ('b1bd1619-3e3a-4aeb-ad83-8d1306bc809f', '2025-03-31', '2025-04-06', '31 Mar – 6 Apr 2025', '{"C41":{"value":1313},"C44":{"value":24},"C43":{"value":415}}'::jsonb, '{}'::jsonb)
  ON CONFLICT (client_id, week_start) DO UPDATE SET content_metrics = myntmore.merge_import(EXCLUDED.content_metrics, w.content_metrics);

INSERT INTO myntmore.weekly_data AS w (client_id, week_start, week_end, week_label, content_metrics, leadgen_metrics)
  VALUES ('b1bd1619-3e3a-4aeb-ad83-8d1306bc809f', '2025-06-30', '2025-07-06', '30 Jun – 6 Jul 2025', '{"C41":{"value":1435},"C44":{"value":21},"C43":{"value":218}}'::jsonb, '{}'::jsonb)
  ON CONFLICT (client_id, week_start) DO UPDATE SET content_metrics = myntmore.merge_import(EXCLUDED.content_metrics, w.content_metrics);

COMMIT;
