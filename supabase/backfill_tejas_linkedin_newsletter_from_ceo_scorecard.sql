-- Backfill Tejas Jhaveri's LinkedIn newsletter history from the CEO scorecard sheets
-- ("LINKEDIN NEWSLETTER" section, Feb 2025 - Mar 2026).
--
-- Fields (per-client content metrics on the client "Tejas Jhaveri"):
--   Subscriber count -> C32 Newsletter Subscribers (continues the series already entered for
--                       Jul 2026) AND C41 LinkedIn Newsletter Subscribers
--   Email open rate  -> C34 Newsletter Open Rate (sheet fraction x 100, 1 decimal)
--   Article Views    -> C43 LinkedIn Newsletter Views
-- Not imported (no matching field): New subscribers, Members reached, Email sends, Impressions.
--
-- Weeks: sheet Week 1..4 -> Mondays starting from the week containing the 1st of the sheet's
-- month (validated against weeks the app already holds). Only non-zero values; existing
-- stored values always win (`new || existing`); safe to re-run. Also switches C41-C43 on for
-- this client (they were added to the catalog after his active-metrics list was saved).
-- Run in the Supabase SQL editor.
BEGIN;

UPDATE myntmore.client_settings
SET active_content_metrics = (
  SELECT array_agg(DISTINCT id) FROM unnest(active_content_metrics || ARRAY['C41','C42','C43']) AS id
)
WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND active_content_metrics IS NOT NULL;

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1172},"C41":{"value":1172},"C43":{"value":238}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-01-27';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1206},"C41":{"value":1206},"C43":{"value":230}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-02-03';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1217},"C41":{"value":1217},"C34":{"value":20},"C43":{"value":227}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-02-10';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1228},"C41":{"value":1228},"C34":{"value":22},"C43":{"value":196}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-02-17';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1241},"C41":{"value":1241},"C34":{"value":24},"C43":{"value":245}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-02-24';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1251},"C41":{"value":1251},"C34":{"value":23},"C43":{"value":262}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-03-03';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1286},"C41":{"value":1286},"C34":{"value":25},"C43":{"value":249}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-03-10';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1296},"C41":{"value":1296},"C34":{"value":23},"C43":{"value":234}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-03-17';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1333},"C41":{"value":1333},"C34":{"value":26},"C43":{"value":306}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-04-07';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1345},"C41":{"value":1345},"C34":{"value":27},"C43":{"value":316}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-04-14';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1361},"C41":{"value":1361},"C34":{"value":24},"C43":{"value":373}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-04-21';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1383},"C41":{"value":1383},"C34":{"value":30},"C43":{"value":364}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-04-28';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1389},"C41":{"value":1389},"C34":{"value":29},"C43":{"value":330}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-05-05';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1397},"C41":{"value":1397},"C34":{"value":21},"C43":{"value":238}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-05-12';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1403},"C41":{"value":1403},"C34":{"value":28},"C43":{"value":325}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-05-19';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1409},"C41":{"value":1409},"C34":{"value":21},"C43":{"value":214}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-05-26';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1424},"C41":{"value":1424},"C34":{"value":20},"C43":{"value":285}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-06-02';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1427},"C41":{"value":1427},"C34":{"value":21},"C43":{"value":220}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-06-09';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1428},"C41":{"value":1428},"C34":{"value":21},"C43":{"value":203}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-06-16';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1438},"C41":{"value":1438},"C34":{"value":19},"C43":{"value":210}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-07-07';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1445},"C41":{"value":1445},"C34":{"value":18},"C43":{"value":199}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-07-14';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1449},"C41":{"value":1449},"C34":{"value":20},"C43":{"value":200}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-07-21';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1459},"C41":{"value":1459},"C34":{"value":19},"C43":{"value":208}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-07-28';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1456},"C41":{"value":1456},"C34":{"value":18},"C43":{"value":229}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-08-11';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1460},"C41":{"value":1460},"C34":{"value":19},"C43":{"value":242}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-08-18';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1467},"C41":{"value":1467},"C34":{"value":19},"C43":{"value":257}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-01';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1472},"C41":{"value":1472},"C34":{"value":17},"C43":{"value":221}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-08';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1473},"C41":{"value":1473},"C34":{"value":16},"C43":{"value":195}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-15';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1478},"C41":{"value":1478},"C34":{"value":17},"C43":{"value":274}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-22';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1481},"C41":{"value":1481},"C34":{"value":18},"C43":{"value":225}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-09-29';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1487},"C41":{"value":1487},"C34":{"value":18},"C43":{"value":223}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-10-06';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1494},"C41":{"value":1494},"C34":{"value":17},"C43":{"value":216}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-10-13';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1498},"C41":{"value":1498},"C34":{"value":15},"C43":{"value":200}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-10-20';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1506},"C41":{"value":1506},"C34":{"value":19},"C43":{"value":272}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-10-27';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1508},"C41":{"value":1508},"C34":{"value":16},"C43":{"value":223}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-11-03';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1513},"C41":{"value":1513},"C34":{"value":18},"C43":{"value":242}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-11-10';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1521},"C41":{"value":1521},"C34":{"value":17},"C43":{"value":237}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-11-17';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1525},"C41":{"value":1525},"C34":{"value":18},"C43":{"value":252}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-12-01';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1537},"C41":{"value":1537},"C34":{"value":18},"C43":{"value":172}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-12-08';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1541},"C41":{"value":1541},"C34":{"value":17},"C43":{"value":225}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-12-15';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1547},"C41":{"value":1547},"C34":{"value":19},"C43":{"value":250}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2025-12-22';

UPDATE myntmore.weekly_data SET content_metrics = '{"C32":{"value":1639},"C41":{"value":1639},"C34":{"value":16},"C43":{"value":249}}'::jsonb || COALESCE(content_metrics, '{}'::jsonb)
  WHERE client_id = 'b1bd1619-3e3a-4aeb-ad83-8d1306bc809f' AND week_start = '2026-03-16';

-- Weeks that had no row yet:

INSERT INTO myntmore.weekly_data AS w (client_id, week_start, week_end, week_label, content_metrics, leadgen_metrics)
  VALUES ('b1bd1619-3e3a-4aeb-ad83-8d1306bc809f', '2025-03-31', '2025-04-06', '31 Mar – 6 Apr 2025', '{"C32":{"value":1313},"C41":{"value":1313},"C34":{"value":24},"C43":{"value":415}}'::jsonb, '{}'::jsonb)
  ON CONFLICT (client_id, week_start) DO UPDATE SET content_metrics = EXCLUDED.content_metrics || COALESCE(w.content_metrics, '{}'::jsonb);

INSERT INTO myntmore.weekly_data AS w (client_id, week_start, week_end, week_label, content_metrics, leadgen_metrics)
  VALUES ('b1bd1619-3e3a-4aeb-ad83-8d1306bc809f', '2025-06-30', '2025-07-06', '30 Jun – 6 Jul 2025', '{"C32":{"value":1435},"C41":{"value":1435},"C34":{"value":21},"C43":{"value":218}}'::jsonb, '{}'::jsonb)
  ON CONFLICT (client_id, week_start) DO UPDATE SET content_metrics = EXCLUDED.content_metrics || COALESCE(w.content_metrics, '{}'::jsonb);

COMMIT;
