-- Fills company-section history the app never had (Sales meeting tracker + cold emailing, MM Invite to Follow)
-- from the CEO scorecard, and normalises Myntmore's Bounce Rate to percent. Safe to re-run.
BEGIN;

-- 1) Sales: meeting tracker (SO40, SO41, SO44, SO46) and cold emailing (SO50, SO51, SO53)
--    history that the app never had. Fills only keys that do not exist yet, nothing already entered changes.
WITH series(col, metric, pts) AS (VALUES
  ('meeting_tracker','SO40','24-08-26:3 24-09-02:8 24-10-14:10 24-11-25:4 24-12-09:14 25-01-13:5 25-02-24:4 25-03-03:5 25-03-10:6 25-03-31:7 25-04-07:6 25-04-14:9 25-04-28:14 25-05-05:4 25-05-12:4 25-05-26:6 25-06-02:5 25-06-09:10 25-06-30:11 25-07-07:10 25-07-14:2 25-07-21:14 25-07-28:14 25-08-04:6 25-08-11:5 25-08-18:15 25-09-01:11 25-09-08:11 25-09-15:20 25-09-22:5 25-09-29:12 25-10-06:3 25-10-13:7 25-10-20:2 25-10-27:4 25-11-03:14 25-11-10:12 25-11-17:16 25-12-01:11 25-12-08:17 25-12-22:14 25-12-29:7 26-01-05:13 26-01-12:8 26-01-19:10 26-02-02:19 26-02-09:16 26-02-16:13 26-02-23:10 26-03-02:13 26-03-09:15 26-03-16:9 26-03-30:15'),
  ('meeting_tracker','SO41','24-08-26:3 24-09-02:7 24-10-14:10 24-11-11:2 24-11-25:3 24-12-09:13 25-01-13:5 25-02-24:2 25-03-03:3 25-03-10:6 25-04-07:7 25-04-14:9 25-04-28:13 25-05-05:3 25-05-12:4 25-05-26:5 25-06-02:5 25-06-09:10 25-06-30:10 25-07-07:10 25-07-14:2 25-07-21:13 25-07-28:14 25-08-04:6 25-08-11:5 25-08-18:13 25-09-01:10 25-09-08:10 25-09-15:20 25-09-22:5 25-09-29:12 25-10-06:2 25-10-13:7 25-10-20:2 25-10-27:3 25-11-03:12 25-11-10:11 25-11-17:11 25-12-01:8 25-12-08:12 25-12-22:10 25-12-29:5 26-01-05:11 26-01-12:6 26-01-19:8 26-02-02:19 26-02-09:15 26-02-16:12 26-02-23:9 26-03-02:11 26-03-09:12 26-03-16:8 26-03-30:12'),
  ('meeting_tracker','SO44','24-09-02:5 24-09-30:1 24-10-14:8 24-10-28:5 24-11-11:13 24-11-25:5 24-12-09:21 25-01-13:9 25-02-24:7 25-03-03:4 25-03-10:8 25-03-31:12 25-04-07:6 25-04-14:7 25-04-28:9 25-05-05:4 25-05-12:2 25-05-26:3 25-06-02:2 25-06-09:6 25-06-30:4 25-07-07:12 25-07-14:3 25-07-21:4 25-07-28:2 25-08-04:10 25-08-11:6 25-08-18:6 25-09-01:5 25-09-08:8 25-09-15:7 25-09-22:3 25-09-29:7 25-10-06:4 25-10-13:2 25-10-20:1 25-10-27:3 25-11-03:8 25-11-10:8 25-11-17:7 25-12-01:7 25-12-08:8 25-12-22:6 25-12-29:4 26-01-05:6 26-01-12:3 26-01-19:6 26-02-02:13 26-02-09:10 26-02-16:5 26-02-23:13 26-03-02:8 26-03-09:8 26-03-16:10 26-03-30:4'),
  ('meeting_tracker','SO46','24-11-25:1 24-12-09:1 25-01-13:1 25-03-10:1 25-05-05:1 25-06-09:1 25-09-01:1 25-09-15:1 25-11-03:1 26-01-05:1 26-02-02:1'),
  ('cold_email','SO50','25-09-22:59 25-10-13:238 25-10-20:244 25-10-27:98 25-11-03:173 25-11-10:166 25-11-17:93 25-12-01:144 25-12-08:289 25-12-15:250 25-12-22:262 25-12-29:232 26-01-05:311 26-01-12:324 26-01-19:259 26-01-26:292 26-02-02:255 26-02-09:327 26-02-16:260 26-02-23:332 26-03-02:380 26-03-09:400 26-03-16:352 26-03-30:296'),
  ('cold_email','SO51','25-10-20:2 25-10-27:3 25-11-03:2 25-11-10:3 25-11-17:3 25-12-01:4 25-12-08:1 25-12-15:4 25-12-22:3 25-12-29:1 26-01-05:2 26-01-12:3 26-01-19:3 26-01-26:3 26-02-02:2 26-02-09:5 26-02-23:1 26-03-02:1 26-03-16:1 26-03-30:2'),
  ('cold_email','SO53','25-10-20:1 25-10-27:1 25-11-10:1 25-11-17:2 25-12-01:1 25-12-15:2 25-12-22:1 26-01-05:2 26-01-12:3 26-01-19:2 26-02-02:1 26-02-09:4 26-02-23:1 26-03-02:1')
),
vals AS (
  SELECT s.col, s.metric, ('20' || split_part(p, ':', 1))::date AS week_start, split_part(p, ':', 2) AS v
  FROM series s CROSS JOIN LATERAL regexp_split_to_table(s.pts, ' ') AS p
),
per_week AS (
  SELECT week_start,
         COALESCE(jsonb_object_agg(metric, v) FILTER (WHERE col = 'meeting_tracker'), '{}'::jsonb) AS mt,
         COALESCE(jsonb_object_agg(metric, v) FILTER (WHERE col = 'cold_email'), '{}'::jsonb) AS ce
  FROM vals GROUP BY week_start
)
INSERT INTO myntmore.sales_weekly_data AS s (week_start, week_end, week_label, meeting_tracker, cold_email)
SELECT week_start, week_start + 6, ltrim(to_char(week_start,'DD'),'0') || ' ' || to_char(week_start,'Mon') || ' – ' || ltrim(to_char(week_start + 6,'DD'),'0') || ' ' || to_char(week_start + 6,'Mon YYYY'), mt, ce
FROM per_week
ON CONFLICT (week_start) DO UPDATE SET
  meeting_tracker = EXCLUDED.meeting_tracker || COALESCE(s.meeting_tracker, '{}'::jsonb),
  cold_email      = EXCLUDED.cold_email      || COALESCE(s.cold_email, '{}'::jsonb);

-- 2) Myntmore LinkedIn: Invite to Follow (MML13), 23 weeks the app has no value for
INSERT INTO myntmore.mm_weekly_data AS m (week_start, week_end, week_label, linkedin)
SELECT d.week_start, d.week_start + 6, ltrim(to_char(d.week_start,'DD'),'0') || ' ' || to_char(d.week_start,'Mon') || ' – ' || ltrim(to_char(d.week_start + 6,'DD'),'0') || ' ' || to_char(d.week_start + 6,'Mon YYYY'),
       jsonb_build_object('MML13', jsonb_build_object('value', d.v))
FROM (
  SELECT ('20' || split_part(p, ':', 1))::date AS week_start, split_part(p, ':', 2) AS v
  FROM regexp_split_to_table('25-02-17:250 25-02-24:250 25-03-31:250 25-06-30:100 25-07-07:50 25-07-14:50 25-07-28:50 25-08-04:50 25-08-11:100 25-08-18:50 25-09-15:54 25-10-20:250 25-11-10:61 25-11-17:189 25-12-01:52 25-12-08:55 25-12-15:51 26-01-05:50 26-01-19:50 26-01-26:60 26-02-02:11 26-02-16:89 26-02-23:100', ' ') AS p
) d
ON CONFLICT (week_start) DO UPDATE SET
  linkedin = EXCLUDED.linkedin || COALESCE(m.linkedin, '{}'::jsonb);

-- 3) Myntmore Website: Bounce Rate (MMW04) was typed as a fraction (0.493) from Sep 2025 on, but as a
--    percent (49.3) before. Convert the fractions to percents so the history is consistent.
UPDATE myntmore.mm_weekly_data
SET website = jsonb_set(website, '{MMW04,value}',
      to_jsonb(round((website->'MMW04'->>'value')::numeric * 100, 1)::text))
WHERE jsonb_typeof(website->'MMW04') = 'object'
  AND (website->'MMW04'->>'value') ~ '^[0-9]*\.?[0-9]+$'
  AND (website->'MMW04'->>'value')::numeric > 0
  AND (website->'MMW04'->>'value')::numeric <= 1;

COMMIT;
