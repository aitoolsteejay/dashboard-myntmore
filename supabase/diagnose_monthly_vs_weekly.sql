-- Diagnostic only — does NOT change any data.
-- Flags client/metric/month groups where 2+ weeks share the exact same
-- value for a metric that should normally vary week to week. That pattern
-- usually means a monthly total got copy-pasted into every week of the
-- month during the historical import, instead of being split per week.

with metric_ids as (
  select unnest(array[
    'C03','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C17','C27',
    'L10','L11','L13','L15','L16','L19','L20','L24'
  ]) as metric_id
),
expanded as (
  select
    wd.client_id,
    c.name as client_name,
    mi.metric_id,
    wd.week_start,
    left(wd.week_start::text, 7) as month,
    coalesce(
      (wd.content_metrics -> mi.metric_id ->> 'value')::numeric,
      (wd.content_metrics ->> mi.metric_id)::numeric,
      (wd.leadgen_metrics -> mi.metric_id ->> 'value')::numeric,
      (wd.leadgen_metrics ->> mi.metric_id)::numeric
    ) as value
  from myntmore.weekly_data wd
  join myntmore.clients c on c.id = wd.client_id
  cross join metric_ids mi
)
select
  client_name,
  metric_id,
  month,
  value,
  count(*) as weeks_with_this_exact_value
from expanded
where value is not null and value > 0
group by client_name, metric_id, month, value
having count(*) >= 2
order by client_name, metric_id, month;
