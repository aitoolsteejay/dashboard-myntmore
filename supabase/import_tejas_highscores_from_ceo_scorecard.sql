-- Raises Tejas Jhaveri's client high scores from the CEO scorecard (current through Mar 2026).
-- Raise-only (GREATEST); skips the placeholder weeks 2024-09-09, 2024-10-21, 2024-11-18 (4000/500 target values)
-- and 2025-02-17 (a copy of 2025-01-13). Safe to re-run.
BEGIN;

INSERT INTO myntmore.high_scores AS hs
  (client_id, metric_id, metric_name, lifetime_high, lifetime_high_month, updated_at)
SELECT c.id, v.metric_id, v.metric_name, v.week_high, v.month_high, now()
FROM (VALUES
  ('C01', 'LinkedIn Post Ideation', 44::numeric, 44::numeric),
  ('C03', 'LinkedIn Post Drafting', 24::numeric, 29::numeric),
  ('C06', 'Text + Image Posts Posted', 18::numeric, 24::numeric),
  ('C10', 'Total Impressions', 91250::numeric, 109977::numeric),
  ('C13', 'Engagement Total', 915::numeric, 1097::numeric),
  ('C14', 'Profile Viewers', 344::numeric, 1052::numeric),
  ('C17', 'Engagement on Other Profiles', 459::numeric, 617::numeric),
  ('L11', 'Accepted Invitations', 128::numeric, 239::numeric),
  ('L12', 'Acceptance Rate', 65.67::numeric, null::numeric),
  ('L16', 'Negative Replies', 20::numeric, 35::numeric),
  ('L20', 'Existing Connections Answered', 34::numeric, 46::numeric)
) AS v(metric_id, metric_name, week_high, month_high)
JOIN myntmore.clients c ON lower(c.name) LIKE '%tejas%'
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
