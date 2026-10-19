-- Raise client high scores using the 'Lifetime Weekly High Score' / 'Monthly High Score'
-- columns of "Myntmore Company CEO Dashboard" (Company Scorecard - April26 sheet).
--
-- Only values that are HIGHER than what the app already stores are applied
-- (GREATEST), so this can never lower a record. The sheet has no date for these
-- records, so achieved_week / achieved_month are cleared when a record is raised.
-- Left out on purpose: Nizar Lallani Impressions + New Followers (identical to
-- Amey Saxena's stored values), Vinu Nair Engagement (monthly value impossible),
-- and every monthly RATE (sheet averages weeks; the app volume-weights).
--
-- Run in the Supabase SQL editor. Safe to re-run.
BEGIN;

INSERT INTO myntmore.high_scores AS hs
  (client_id, metric_id, metric_name, lifetime_high, lifetime_high_month, updated_at)
SELECT v.client_id, v.metric_id, v.metric_name, v.week_high, v.month_high, now()
FROM (VALUES
  ('c33edc1d-4b8f-41f3-a705-6b549f7e0765'::uuid, 'C01', 'LinkedIn Post Ideation', 10::numeric, 10::numeric),  -- skc - divya
  ('c33edc1d-4b8f-41f3-a705-6b549f7e0765'::uuid, 'C04', 'Posts Approved by Client', 2::numeric, null::numeric),  -- skc - divya
  ('c33edc1d-4b8f-41f3-a705-6b549f7e0765'::uuid, 'L12', null::text, 39.1::numeric, null::numeric),  -- skc - divya
  ('a396561e-c0e2-4c33-a798-3ce49ee2c8b3'::uuid, 'C01', 'LinkedIn Post Ideation', 11::numeric, 11::numeric),  -- aditya gupta
  ('a396561e-c0e2-4c33-a798-3ce49ee2c8b3'::uuid, 'C13', null::text, null::numeric, 64::numeric),  -- aditya gupta
  ('dfb844f0-510d-4378-a59d-47d9f9d2708c'::uuid, 'L13', null::text, 55::numeric, null::numeric),  -- nilesh
  ('fe8f1bec-da93-4dbd-b2e3-7aff83228e97'::uuid, 'C10', null::text, null::numeric, 61438::numeric),  -- vinu nair
  ('fe8f1bec-da93-4dbd-b2e3-7aff83228e97'::uuid, 'C14', null::text, null::numeric, 559::numeric),  -- vinu nair
  ('fe8f1bec-da93-4dbd-b2e3-7aff83228e97'::uuid, 'L22', 'Existing Connections Hot Leads', 7::numeric, null::numeric),  -- vinu nair
  ('fe8f1bec-da93-4dbd-b2e3-7aff83228e97'::uuid, 'L24', 'Meetings Booked', 1::numeric, null::numeric),  -- vinu nair
  ('f24a5287-8c33-4c8b-82b1-198a88af6b74'::uuid, 'L22', 'Existing Connections Hot Leads', 19::numeric, 36::numeric),  -- nizar lallani
  ('f24a5287-8c33-4c8b-82b1-198a88af6b74'::uuid, 'L24', 'Meetings Booked', 5::numeric, null::numeric),  -- nizar lallani
  ('b1bd1619-3e3a-4aeb-ad83-8d1306bc809f'::uuid, 'C15', null::text, 184::numeric, null::numeric)  -- tejas jhaveri
) AS v(client_id, metric_id, metric_name, week_high, month_high)
ON CONFLICT (client_id, metric_id) DO UPDATE SET
  previous_high       = CASE WHEN EXCLUDED.lifetime_high > COALESCE(hs.lifetime_high, 0)
                             THEN hs.lifetime_high ELSE hs.previous_high END,
  achieved_week       = CASE WHEN EXCLUDED.lifetime_high > COALESCE(hs.lifetime_high, 0)
                             THEN NULL ELSE hs.achieved_week END,
  lifetime_high       = GREATEST(hs.lifetime_high, EXCLUDED.lifetime_high),
  achieved_month      = CASE WHEN EXCLUDED.lifetime_high_month > COALESCE(hs.lifetime_high_month, 0)
                             THEN NULL ELSE hs.achieved_month END,
  lifetime_high_month = GREATEST(hs.lifetime_high_month, EXCLUDED.lifetime_high_month),
  updated_at          = now();

COMMIT;
