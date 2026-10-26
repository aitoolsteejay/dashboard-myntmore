-- Makes Tejas Jhaveri's LinkedIn client numbers (Sep 2024 - Jun 2025) match the CEO scorecard, which is the source
-- of truth through Mar 2026. Skips the placeholder weeks 2024-09-09, 2024-10-21, 2024-11-18 (4000/500 target values)
-- and 2025-02-17 (a copy of 2025-01-13). Overwrites the sheet's non-zero values; notes and targets are kept.
BEGIN;

-- Safety net: a copy of Tejas's weekly rows before anything changes (locked down with RLS, no policies).
CREATE TABLE IF NOT EXISTS myntmore.backup_weekly_data_tejas_before_sheet AS
  SELECT * FROM myntmore.weekly_data
  WHERE client_id IN (SELECT id FROM myntmore.clients WHERE lower(name) LIKE '%tejas%');
ALTER TABLE myntmore.backup_weekly_data_tejas_before_sheet ENABLE ROW LEVEL SECURITY;

-- Merges a patch ({metric: {value: ...}}) into a metrics column, keeping each metric's note / target.
CREATE OR REPLACE FUNCTION myntmore.apply_patch(base jsonb, patch jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $f$
  SELECT COALESCE(CASE WHEN jsonb_typeof(base) = 'object' THEN base END, '{}'::jsonb)
         || COALESCE((
              SELECT jsonb_object_agg(t.k,
                       CASE WHEN jsonb_typeof(base -> t.k) = 'object' THEN base -> t.k ELSE '{}'::jsonb END || t.v)
              FROM jsonb_each(patch) AS t(k, v)), '{}'::jsonb)
$f$;

-- Tejas's weekly numbers from the CEO scorecard (non-zero only), Sep 2024 - Jun 2025.
WITH series(metric, pts) AS (VALUES
    ('C01','24-10-07:2 24-10-14:20 24-11-11:44 24-12-09:20 24-12-30:5 25-01-06:6 25-01-13:36 25-04-14:6 25-06-30:2'),
    ('C03','24-10-07:6 24-10-14:12 24-10-28:1 24-11-11:17 24-11-25:8 24-12-09:24 24-12-30:5 25-01-06:3 25-01-13:10 25-02-03:1 25-03-03:1 25-03-10:4 25-04-14:3 25-06-09:1 25-06-30:2'),
    ('C06','24-11-25:5 24-12-02:2 24-12-09:14 24-12-30:4 25-01-06:1 25-01-13:18 25-01-27:5 25-02-03:6 25-02-24:4 25-03-03:3 25-03-10:7 25-03-31:3 25-04-07:4 25-04-14:1 25-04-28:3 25-05-05:3 25-05-12:1 25-05-26:5 25-06-02:2'),
    ('C10','24-08-26:658 24-09-16:3286 24-09-30:509 24-10-07:166 24-10-14:2738 24-10-28:6295 24-11-04:1088 24-11-11:16118 24-11-25:4095 24-12-02:91250 24-12-09:16423 24-12-30:2304 25-01-06:1472 25-01-13:4770 25-01-27:428 25-02-03:2773 25-02-24:865 25-03-03:717 25-03-10:997 25-03-31:409 25-04-07:654 25-04-14:675 25-04-28:176 25-05-05:525 25-05-12:381 25-05-26:467 25-06-02:308 25-06-09:278 25-06-30:2092'),
    ('C13','24-09-30:51 24-10-07:30 24-10-14:244 24-10-28:132 24-11-04:6 24-11-11:246 24-11-25:17 24-12-02:61 24-12-09:126 24-12-30:118 25-01-06:107 25-01-13:915 25-01-27:75 25-02-03:288'),
    ('C14','24-12-09:128 25-01-27:47 25-02-24:64 25-03-03:32 25-03-10:43 25-04-07:15 25-05-05:94 25-05-26:88 25-06-02:81 25-06-09:104 25-06-30:95'),
    ('C15','24-11-25:54 24-12-09:301 25-04-28:54 25-05-05:74 25-05-12:103 25-05-26:114 25-06-02:48 25-06-09:102 25-06-30:83'),
    ('C17','24-09-02:268 24-09-30:101 24-10-07:26 24-10-14:416 24-10-28:149 24-11-11:314 24-11-25:76 24-12-09:459 24-12-30:84 25-01-06:74 25-01-13:428 25-01-27:115 25-02-03:105 25-02-24:74 25-03-03:51 25-03-10:125 25-03-31:36 25-04-07:33 25-04-14:85 25-04-28:21 25-05-05:160 25-05-12:109 25-05-26:75 25-06-02:75 25-06-09:113 25-06-30:61'),
    ('L10','25-04-07:284'),
    ('L11','25-04-07:67 25-04-14:128 25-04-28:44 25-05-05:73 25-05-12:31 25-05-26:59 25-06-02:68 25-06-09:79'),
    ('L13','25-04-07:11 25-05-26:28 25-06-02:34 25-06-09:39'),
    ('L16','25-05-05:9 25-05-26:10 25-06-02:15 25-06-09:20'),
    ('L20','25-04-14:0.52 25-04-28:7 25-05-05:34 25-05-12:12')
),
vals AS (
  SELECT s.metric, ('20' || split_part(p, ':', 1))::date AS week_start, split_part(p, ':', 2)::numeric AS v
  FROM series s CROSS JOIN LATERAL regexp_split_to_table(s.pts, ' ') AS p
),
per_week AS (
  SELECT week_start,
         COALESCE(jsonb_object_agg(metric, jsonb_build_object('value', v)) FILTER (WHERE metric LIKE 'C%'), '{}'::jsonb) AS cm,
         COALESCE(jsonb_object_agg(metric, jsonb_build_object('value', v)) FILTER (WHERE metric LIKE 'L%'), '{}'::jsonb) AS lm
  FROM vals GROUP BY week_start
),
tj AS (SELECT id FROM myntmore.clients WHERE lower(name) LIKE '%tejas%' ORDER BY name LIMIT 1)
INSERT INTO myntmore.weekly_data AS w
  (client_id, week_start, week_end, week_label, content_metrics, leadgen_metrics, content_submitted_at, leadgen_submitted_at)
SELECT tj.id, p.week_start, p.week_start + 6,
       ltrim(to_char(p.week_start, 'DD'), '0') || ' ' || to_char(p.week_start, 'Mon') || ' – ' ||
       ltrim(to_char(p.week_start + 6, 'DD'), '0') || ' ' || to_char(p.week_start + 6, 'Mon YYYY'),
       p.cm, p.lm,
       CASE WHEN p.cm <> '{}'::jsonb THEN (p.week_start + 7)::timestamptz END,
       CASE WHEN p.lm <> '{}'::jsonb THEN (p.week_start + 7)::timestamptz END
FROM per_week p CROSS JOIN tj
ON CONFLICT (client_id, week_start) DO UPDATE SET
  content_metrics      = myntmore.apply_patch(w.content_metrics, EXCLUDED.content_metrics),
  leadgen_metrics      = myntmore.apply_patch(w.leadgen_metrics, EXCLUDED.leadgen_metrics),
  content_submitted_at = COALESCE(w.content_submitted_at, EXCLUDED.content_submitted_at),
  leadgen_submitted_at = COALESCE(w.leadgen_submitted_at, EXCLUDED.leadgen_submitted_at);

COMMIT;
