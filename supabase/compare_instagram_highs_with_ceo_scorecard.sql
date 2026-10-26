-- Compares the app's Instagram best week / best month (TJ and Myntmore accounts) with the
-- historical CEO scorecard. Read-only: it only SELECTs. Sheet values are inlined below.
with sheet(src, metric, kind, sheet_best_week, sheet_week, sheet_best_month, sheet_month, sheet_stated_week_high) as (values
  ('mm','MMI04','sum',5259,'2026-03-09',5259,'2026-03',5259),
  ('mm','MMI07','sum',9,'2025-07-14',10,'2026-01',2),
  ('mm','MMI08','latest',52,'2026-03-16',52,'2026-03',null::numeric),
  ('tj','TJI01','sum',8,'2025-11-17',19,'2026-03',5),
  ('tj','TJI02','sum',1,'2025-09-15',2,'2025-11',1),
  ('tj','TJI03','sum',3,'2025-10-06',8,'2025-10',3),
  ('tj','TJI05','sum',7086,'2026-03-09',15280,'2026-03',7086),
  ('tj','TJI06','sum',167,'2026-03-02',428,'2026-03',167),
  ('tj','TJI07','sum',80,'2026-03-09',149,'2026-03',80),
  ('tj','TJI08','sum',220,'2025-11-10',393,'2025-11',220),
  ('tj','TJI09','sum',15,'2025-11-10',20,'2025-11',15),
  ('tj','TJI10','sum',20,'2026-01-26',54,'2026-01',13),
  ('tj','TJI11','latest',3888,'2026-03-16',3888,'2026-03',null::numeric)
),
raw as (
  select 'tj'::text as src, e.key as metric, w.week_start,
         case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end as r
  from myntmore.tj_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.instagram) = 'object' then w.instagram else '{}'::jsonb end) e
  union all
  select 'mm', e.key, w.week_start,
         case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end
  from myntmore.mm_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.instagram) = 'object' then w.instagram else '{}'::jsonb end) e
),
vals as (
  select src, metric, week_start, case when r ~ '^-?[0-9]+(\.[0-9]+)?$' then r::numeric end as v from raw
),
wk as (
  select distinct on (src, metric) src, metric, v as app_best_week, week_start::text as app_week
  from vals where v > 0 order by src, metric, v desc
),
mo as (
  select v.src, v.metric, left(v.week_start::text, 7) as m,
         case when s.kind = 'latest' then max(v.v) else sum(v.v) end as val
  from vals v join sheet s using (src, metric)
  where v.v is not null group by v.src, v.metric, left(v.week_start::text, 7), s.kind
),
mob as (
  select distinct on (src, metric) src, metric, val as app_best_month, m as app_month
  from mo order by src, metric, val desc
)
select s.src, s.metric,
       s.sheet_best_week, s.sheet_stated_week_high, wk.app_best_week, s.sheet_week, wk.app_week,
       case when wk.app_best_week is null then 'APP HAS NO DATA'
            when wk.app_best_week < s.sheet_best_week then 'APP LOWER'
            when wk.app_best_week > s.sheet_best_week then 'APP HIGHER'
            else 'match' end as week_verdict,
       s.sheet_best_month, mob.app_best_month, s.sheet_month, mob.app_month,
       case when mob.app_best_month is null then 'APP HAS NO DATA'
            when mob.app_best_month < s.sheet_best_month then 'APP LOWER'
            when mob.app_best_month > s.sheet_best_month then 'APP HIGHER'
            else 'match' end as month_verdict
from sheet s
left join wk using (src, metric)
left join mob using (src, metric)
order by s.src, s.metric;
