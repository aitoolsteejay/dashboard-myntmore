-- Re-dates Myntmore LinkedIn / Website and Tejas's newsletter weeks to match the CEO scorecard (the source of
-- truth through Mar 2026). Overwrites the sheet's weeks inside the misdated periods and clears the leftover
-- shifted copies. Run once.
BEGIN;

-- Safety net: a full copy of both tables before anything changes (locked down with RLS, no policies).
CREATE TABLE IF NOT EXISTS myntmore.backup_mm_weekly_before_redate AS SELECT * FROM myntmore.mm_weekly_data;
CREATE TABLE IF NOT EXISTS myntmore.backup_tj_weekly_before_redate AS SELECT * FROM myntmore.tj_weekly_data;
ALTER TABLE myntmore.backup_mm_weekly_before_redate ENABLE ROW LEVEL SECURITY;
ALTER TABLE myntmore.backup_tj_weekly_before_redate ENABLE ROW LEVEL SECURITY;

-- Merges a patch ({metric: {value: ...}}) into a metrics column, keeping each metric's note / target.
CREATE OR REPLACE FUNCTION myntmore.apply_patch(base jsonb, patch jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $f$
  SELECT COALESCE(CASE WHEN jsonb_typeof(base) = 'object' THEN base END, '{}'::jsonb)
         || COALESCE((
              SELECT jsonb_object_agg(t.k,
                       CASE WHEN jsonb_typeof(base -> t.k) = 'object' THEN base -> t.k ELSE '{}'::jsonb END || t.v)
              FROM jsonb_each(patch) AS t(k, v)), '{}'::jsonb)
$f$;

-- The scorecard's non-zero weekly values for the weeks whose dates were off by a week in the app.
-- (Zeros are not written: a 0 in the sheet may just be a row nobody updates any more.)
CREATE TEMP TABLE sheet_series ON COMMIT DROP AS
SELECT s.src, s.col, s.metric, ('20' || split_part(p, ':', 1))::date AS week_start, split_part(p, ':', 2) AS val
FROM (VALUES
    ('mm','linkedin','MML01','24-11-25:4 25-01-13:3 25-02-17:3 25-03-03:2 25-03-10:2 25-03-31:2 25-04-07:2 25-04-14:2 25-04-21:2 25-04-28:2 25-05-05:2 25-05-12:2 25-05-26:2 25-06-02:2 25-06-09:2 25-06-30:2 25-07-07:1 25-07-14:1 25-07-21:1 25-07-28:1'),
    ('mm','linkedin','MML02','25-05-26:247 25-06-02:83 25-06-09:117 25-10-27:86 26-02-02:105 26-02-16:571 26-02-23:54 26-03-02:409 26-03-09:465 26-03-16:470'),
    ('mm','linkedin','MML03','25-05-26:8 25-06-02:5 25-06-09:3 25-10-27:1 26-02-16:1 26-03-02:1'),
    ('mm','linkedin','MML04','25-05-26:2 25-06-02:2 25-06-09:1'),
    ('mm','linkedin','MML05','25-04-28:17 25-05-05:17 25-05-12:6 25-05-26:9 25-06-02:5 25-06-09:3 25-06-30:15 25-07-07:6 25-07-14:48 25-07-21:4 25-07-28:7 25-10-27:1 26-02-02:7 26-02-16:20 26-02-23:4 26-03-02:3 26-03-09:3 26-03-16:2'),
    ('mm','linkedin','MML06','24-11-25:339 24-12-30:401 25-01-06:403 25-01-13:403 25-01-27:428 25-02-03:429 25-02-17:403 25-02-24:436 25-03-03:483 25-03-10:546 25-03-17:546 25-03-31:553 25-04-07:575 25-04-14:604 25-04-21:604 25-04-28:645 25-05-05:662 25-05-12:668 25-05-26:690 25-06-02:695 25-06-09:696 25-06-30:720 25-07-07:726 25-07-14:774 25-07-21:778 25-07-28:785 25-10-27:997 26-02-02:1115 26-02-16:1139 26-02-23:1144 26-03-02:1147 26-03-09:1150 26-03-16:1152'),
    ('mm','linkedin','MML07','25-05-26:84 25-06-02:61 25-06-09:75 25-10-27:66'),
    ('mm','website','MMW01','25-01-27:55 25-02-03:24 25-02-17:37.25 25-02-24:35 25-03-03:70 25-03-10:227 25-03-31:98 25-04-07:85 25-04-14:158 25-05-26:40 25-06-02:24 25-06-09:34 25-06-30:6 25-07-07:31 25-07-14:39 25-07-21:28 25-07-28:47 25-10-27:38 26-02-02:93 26-02-09:73 26-02-16:52 26-02-23:47 26-03-02:66 26-03-09:56 26-03-16:84'),
    ('mm','website','MMW02','24-11-25:22 25-01-27:46 25-02-03:23 25-02-17:30.75 25-02-24:31 25-03-03:57 25-03-10:220 25-03-31:97 25-04-07:79 25-04-14:143 25-05-26:38 25-06-02:22 25-06-09:34 25-06-30:5 25-07-07:30 25-07-14:38 25-07-21:25 25-07-28:35 25-10-27:34 26-02-02:88 26-02-09:63 26-02-16:50 26-02-23:45 26-03-02:68 26-03-09:56 26-03-16:79'),
    ('mm','website','MMW04','24-11-25:40.7 25-01-27:64.5 25-02-03:56.7 25-02-17:47.38 25-02-24:51.1 25-03-03:38.7 25-03-10:79.8 25-03-31:69.6 25-04-07:61.1 25-04-14:67.7 25-05-26:67.4 25-06-02:39.3 25-06-09:43.6 25-06-30:67 25-07-07:61.2 25-07-14:39.2 25-07-21:53.3 25-07-28:63.2 25-10-27:60.5 26-02-02:66.1 26-02-09:58.3 26-02-16:53.8 26-02-23:64.2 26-03-02:54.7 26-03-09:50.7 26-03-16:54.8'),
    ('tj','email_newsletter','TJP08','25-01-27:2670 25-02-03:2662 25-02-24:2646 25-03-03:2643 25-03-10:2646 25-03-31:2649 25-04-07:2642 25-04-14:2630 25-04-28:2642 25-05-05:2645 25-05-12:2631 25-06-30:2604 25-07-07:2593 25-07-14:2592 25-07-21:2576 25-07-28:2574 25-10-27:2588 26-03-09:2693 26-03-16:2691'),
    ('tj','email_newsletter','TJP09','25-01-27:97.8 25-02-03:98.5 25-02-24:98.5 25-03-03:98.6 25-03-10:97.2 25-03-31:98.5 25-04-07:98.3 25-04-14:98.8 25-04-28:99.1 25-05-05:96.8 25-05-12:97.1 25-06-30:99.2 25-07-07:99 25-07-14:99.5 25-07-21:99.3 25-07-28:98.7 25-10-27:98.6 26-03-09:99.2 26-03-16:99.2'),
    ('tj','email_newsletter','TJP10','25-01-27:12 25-02-03:13 25-02-17:11.86 25-02-24:11.6 25-03-03:7.64 25-03-10:7.75 25-03-31:8 25-04-07:14 25-04-14:15 25-04-28:14 25-05-05:13 25-05-12:14 25-06-30:19 25-07-07:19 25-07-14:28 25-07-21:26 25-07-28:23 25-10-27:24 26-03-09:24 26-03-16:23'),
    ('tj','email_newsletter','TJP11','25-01-27:0.4 25-02-03:0.3 25-02-24:0.3 25-03-03:0.2 25-03-10:0.2 25-03-31:0.1 25-04-14:0.1 25-04-28:0.1 25-05-05:0.4 25-06-30:0.5 25-07-07:0.6 25-07-14:0.2 25-07-21:0.1 25-07-28:0.3 25-10-27:0.6 26-03-09:0.9 26-03-16:0.6'),
    ('tj','email_newsletter','TJP12','25-01-27:3.1 25-02-03:2.2 25-02-24:2.6 25-03-03:2.5 25-03-10:2.4 25-03-31:0.9 25-04-07:0.3 25-04-14:0.7 25-04-28:0.8 25-05-05:2.6 25-05-12:0.2 25-06-30:2.4 25-07-07:2.9 25-07-14:0.7 25-07-21:0.5 25-07-28:1.2 25-10-27:2.6 26-03-09:3.6 26-03-16:2.5'),
    ('tj','email_newsletter','TJP13','25-01-27:5 25-02-03:8 25-02-17:16 25-02-24:5 25-03-03:3 25-03-10:6 25-03-31:6 25-04-07:5 25-04-14:3 25-04-28:1 25-05-05:1 25-05-12:1 25-06-30:12 25-07-07:5 25-07-14:13 25-07-21:6 25-07-28:6 25-10-27:5 26-03-09:5 26-03-16:2')
) AS s(src, col, metric, pts)
CROSS JOIN LATERAL regexp_split_to_table(s.pts, ' ') AS p;

-- MML07 (Page Views) is only re-dated through Oct 2025: the app's best month for it (1,421) sits in Feb 2026
-- and overwriting those weeks would lower a record.
-- Periods that were misdated: Nov 2024 - Jul 2025, 27 Oct 2025, Feb - Mar 2026.
CREATE TEMP TABLE win(lo date, hi date) ON COMMIT DROP;
INSERT INTO win VALUES ('2024-11-25', '2025-07-28'), ('2025-10-27', '2025-10-27'), ('2026-02-02', '2026-03-16');

DO $do$
DECLARE
  t record;
  extra_cols text;
  extra_vals text;
BEGIN
  FOR t IN SELECT * FROM (VALUES
      ('mm', 'mm_weekly_data', 'linkedin'),
      ('mm', 'mm_weekly_data', 'website'),
      ('tj', 'tj_weekly_data', 'email_newsletter')
    ) AS x(src, tbl, col)
  LOOP
    -- 1) Clear a value left behind by the old shift: it sits on a week the sheet leaves blank and
    --    equals the sheet's value from the week before.
    EXECUTE format($q$
      WITH leftovers AS (
        SELECT w.week_start, e.key AS metric
        FROM myntmore.%1$I w
        CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(w.%2$I) = 'object' THEN w.%2$I ELSE '{}'::jsonb END) e
        JOIN sheet_series prev ON prev.src = %3$L AND prev.col = %2$L AND prev.metric = e.key
                              AND prev.week_start = w.week_start - 7
        WHERE EXISTS (SELECT 1 FROM win WHERE w.week_start BETWEEN lo AND hi)
          AND NOT EXISTS (SELECT 1 FROM sheet_series cur
                          WHERE cur.src = %3$L AND cur.col = %2$L AND cur.metric = e.key AND cur.week_start = w.week_start)
          AND CASE WHEN (CASE WHEN jsonb_typeof(e.value) = 'object' THEN e.value->>'value' ELSE e.value #>> '{}' END) ~ '^-?[0-9]+(\.[0-9]+)?$'
                   THEN (CASE WHEN jsonb_typeof(e.value) = 'object' THEN e.value->>'value' ELSE e.value #>> '{}' END)::numeric
              END = prev.val::numeric
      ), patch AS (
        SELECT week_start, jsonb_object_agg(metric, jsonb_build_object('value', NULL)) AS p
        FROM leftovers GROUP BY week_start
      )
      UPDATE myntmore.%1$I w SET %2$I = myntmore.apply_patch(w.%2$I, patch.p)
      FROM patch WHERE patch.week_start = w.week_start
    $q$, t.tbl, t.col, t.src);

    -- 2) Put the sheet's value on the sheet's week (creating the week if the app has none).
    extra_cols := CASE WHEN t.src = 'tj' THEN ', instagram, youtube' ELSE '' END;
    extra_vals := CASE WHEN t.src = 'tj' THEN ', ''{}''::jsonb, ''{}''::jsonb' ELSE '' END;
    EXECUTE format($q$
      INSERT INTO myntmore.%1$I AS w (week_start, week_end, week_label, %2$I%4$s)
      SELECT p.week_start, p.week_start + 6,
             ltrim(to_char(p.week_start, 'DD'), '0') || ' ' || to_char(p.week_start, 'Mon') || ' – ' ||
             ltrim(to_char(p.week_start + 6, 'DD'), '0') || ' ' || to_char(p.week_start + 6, 'Mon YYYY'),
             p.patch%5$s
      FROM (
        SELECT s.week_start, jsonb_object_agg(s.metric, jsonb_build_object('value', s.val)) AS patch
        FROM sheet_series s
        WHERE s.src = %3$L AND s.col = %2$L
          AND EXISTS (SELECT 1 FROM win WHERE s.week_start BETWEEN lo AND hi)
        GROUP BY s.week_start
      ) p
      ON CONFLICT (week_start) DO UPDATE SET %2$I = myntmore.apply_patch(w.%2$I, EXCLUDED.%2$I)
    $q$, t.tbl, t.col, t.src, extra_cols, extra_vals);
  END LOOP;
END
$do$;

COMMIT;
