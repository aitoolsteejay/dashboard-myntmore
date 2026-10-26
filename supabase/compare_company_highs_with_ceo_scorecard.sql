-- Best week / best month of every company metric in the CEO scorecard vs the app. Read-only.
-- Date shifts of a week barely matter here, so this is the cleaner high-score check.
with sheet(src, col, metric, kind, sheet_best_week, sheet_week, sheet_best_month, sheet_month) as (values
  ('client','content_metrics','C41','latest',1639,'2026-03-16',1639,'2026-03'),
  ('client','content_metrics','C43','sum',958,'2025-02-17',1416,'2025-02'),
  ('client','content_metrics','C44','avg',29,'2025-04-28',26.67,'2025-04'),
  ('mm','linkedin','MML01','sum',10,'2024-12-09',10,'2024-12'),
  ('mm','linkedin','MML02','sum',683,'2025-12-29',1344,'2026-03'),
  ('mm','linkedin','MML03','sum',14,'2025-12-29',31,'2025-12'),
  ('mm','linkedin','MML04','sum',2,'2025-05-26',3,'2025-06'),
  ('mm','linkedin','MML05','sum',48,'2025-07-14',88,'2025-09'),
  ('mm','linkedin','MML06','latest',1152,'2026-03-16',1152,'2026-03'),
  ('mm','linkedin','MML07','sum',553,'2026-02-16',1160,'2026-03'),
  ('mm','linkedin','MML13','sum',250,'2025-02-17',500,'2025-02'),
  ('mm','website','MMW01','sum',608,'2025-08-04',784,'2025-12'),
  ('mm','website','MMW02','sum',602,'2025-08-04',760,'2025-12'),
  ('mm','website','MMW04','avg',93.9,'2025-12-29',70.06,'2025-12'),
  ('sales','cold_email','SO50','sum',400,'2026-03-09',1428,'2026-03'),
  ('sales','cold_email','SO51','sum',5,'2026-02-09',13,'2025-12'),
  ('sales','cold_email','SO53','sum',4,'2026-02-09',7,'2026-01'),
  ('sales','meeting_tracker','SO40','sum',20,'2025-09-15',59,'2025-09'),
  ('sales','meeting_tracker','SO41','sum',20,'2025-09-15',57,'2025-09'),
  ('sales','meeting_tracker','SO44','sum',21,'2024-12-09',41,'2026-02'),
  ('sales','meeting_tracker','SO46','sum',1,'2024-11-25',2,'2025-09'),
  ('tj','email_newsletter','TJP08','sum',2693,'2026-03-09',12719,'2025-09'),
  ('tj','email_newsletter','TJP10','avg',35,'2025-08-11',32.5,'2025-08'),
  ('tj','email_newsletter','TJP13','sum',16,'2025-02-17',38,'2025-09'),
  ('tj','video_pipeline','TJV01','sum',9,'2025-05-05',24,'2025-06'),
  ('tj','video_pipeline','TJV02','sum',4,'2026-02-09',8,'2025-09'),
  ('tj','video_pipeline','TJV03','sum',5,'2025-04-28',8,'2025-09'),
  ('tj','youtube','TJY01','sum',6,'2025-12-08',22,'2025-12'),
  ('tj','youtube','TJY02','sum',4175,'2025-12-08',12520,'2025-12'),
  ('tj','youtube','TJY03','sum',1860,'2025-10-27',4059,'2025-12'),
  ('tj','youtube','TJY04','sum',30,'2026-02-09',77,'2026-02'),
  ('tj','youtube','TJY05','sum',3,'2026-02-16',5,'2026-02'),
  ('tj','youtube','TJY06','sum',3,'2026-03-09',3,'2026-02'),
  ('tj','youtube','TJY07','latest',58,'2026-03-09',58,'2026-03')
),
raw as (
  select 'mm'::text as src, 'linkedin'::text as col, e.key as metric, w.week_start,
         case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end as r
  from myntmore.mm_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.linkedin) = 'object' then w.linkedin else '{}'::jsonb end) e
  union all
  select 'mm', 'website', e.key, w.week_start, case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end
  from myntmore.mm_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.website) = 'object' then w.website else '{}'::jsonb end) e
  union all
  select 'tj', 'youtube', e.key, w.week_start, case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end
  from myntmore.tj_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.youtube) = 'object' then w.youtube else '{}'::jsonb end) e
  union all
  select 'tj', 'email_newsletter', e.key, w.week_start, case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end
  from myntmore.tj_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.email_newsletter) = 'object' then w.email_newsletter else '{}'::jsonb end) e
  union all
  select 'tj', 'video_pipeline', e.key, w.week_start, case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end
  from myntmore.tj_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.video_pipeline) = 'object' then w.video_pipeline else '{}'::jsonb end) e
  union all
  select 'sales', 'meeting_tracker', e.key, w.week_start, case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end
  from myntmore.sales_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.meeting_tracker) = 'object' then w.meeting_tracker else '{}'::jsonb end) e
  union all
  select 'sales', 'cold_email', e.key, w.week_start, case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end
  from myntmore.sales_weekly_data w cross join lateral jsonb_each(case when jsonb_typeof(w.cold_email) = 'object' then w.cold_email else '{}'::jsonb end) e
  union all
  select 'client', 'content_metrics', e.key, w.week_start, case when jsonb_typeof(e.value) = 'object' then e.value->>'value' else e.value #>> '{}' end
  from myntmore.weekly_data w
  join myntmore.clients c on c.id = w.client_id and lower(c.name) like '%tejas%'
  cross join lateral jsonb_each(case when jsonb_typeof(w.content_metrics) = 'object' then w.content_metrics else '{}'::jsonb end) e
  where e.key in ('C41', 'C43', 'C44')
),
vals as (
  select src, col, metric, week_start, case when r ~ '^-?[0-9]+(\.[0-9]+)?$' then r::numeric end as v from raw
),
wk as (
  select distinct on (src, col, metric) src, col, metric, v as app_best_week, week_start::text as app_week
  from vals where v > 0 order by src, col, metric, v desc
),
mo as (
  select v.src, v.col, v.metric, left(v.week_start::text, 7) as m,
         case s.kind when 'latest' then max(v.v) when 'avg' then avg(v.v) else sum(v.v) end as val
  from vals v join sheet s using (src, col, metric)
  where v.v > 0 group by v.src, v.col, v.metric, left(v.week_start::text, 7), s.kind
),
mob as (
  select distinct on (src, col, metric) src, col, metric, round(val, 1) as app_best_month, m as app_month
  from mo order by src, col, metric, val desc
)
select s.src, s.col, s.metric,
       s.sheet_best_week, wk.app_best_week, s.sheet_week, wk.app_week,
       case when wk.app_best_week is null then 'NO DATA IN APP'
            when wk.app_best_week < s.sheet_best_week - (case when s.kind = 'avg' then 1 else 0.5 end) then 'APP LOWER'
            else 'ok' end as week_verdict,
       round(s.sheet_best_month, 1) as sheet_best_month, mob.app_best_month, s.sheet_month, mob.app_month,
       case when mob.app_best_month is null then 'NO DATA IN APP'
            when mob.app_best_month < s.sheet_best_month - (case when s.kind = 'avg' then 1 else 0.5 end) then 'APP LOWER'
            else 'ok' end as month_verdict
from sheet s
left join wk using (src, col, metric)
left join mob using (src, col, metric)
order by s.src, s.col, s.metric;
