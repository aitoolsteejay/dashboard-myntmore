-- Every "computed rate/sum" display in the Sales & Outreach entry form (e.g.
-- Meeting Tracker's Total Booked, Completion Rate, Conversion Rate, Revenue
-- Closed, and the acceptance/response/reply rate fields in every other
-- section) was rendered live from sibling inputs but never actually written
-- to sales_weekly_data — so the dashboard, CSV export, and this page's own
-- MTD totals all read these keys back out as missing and showed "-".
--
-- The app code now persists them going forward (see SalesPage.tsx's
-- DERIVED_FIELDS). This backfills every existing row so historical weeks
-- don't need to be re-opened and re-saved to show correct values.

-- Mirrors the JS `parseFloat(x) || 0` used throughout SalesPage.tsx: treats
-- null/non-numeric/empty-string jsonb values as 0 instead of erroring.
create or replace function myntmore.safe_num(v jsonb)
returns numeric
language plpgsql
immutable
as $$
begin
  if v is null or v = 'null'::jsonb then return 0; end if;
  return case
    when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric
    when jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v #>> '{}')::numeric
    else 0
  end;
exception when others then
  return 0;
end;
$$;

create or replace function myntmore.safe_rate(num jsonb, den jsonb)
returns numeric
language sql
immutable
as $$
  select case when myntmore.safe_num(den) > 0
    then round((myntmore.safe_num(num) / myntmore.safe_num(den)) * 1000) / 10
    else 0
  end
$$;

update myntmore.sales_weekly_data
set tj_outreach = tj_outreach || jsonb_build_object(
  'SO04', myntmore.safe_rate(tj_outreach->'SO03', tj_outreach->'SO02'),
  'SO06', myntmore.safe_rate(tj_outreach->'SO05', tj_outreach->'SO03')
)
where tj_outreach is not null;

update myntmore.sales_weekly_data
set jahnvi_outreach = jahnvi_outreach || jsonb_build_object(
  'SO13', myntmore.safe_rate(jahnvi_outreach->'SO12', jahnvi_outreach->'SO11'),
  'SO15', myntmore.safe_rate(jahnvi_outreach->'SO14', jahnvi_outreach->'SO12')
)
where jahnvi_outreach is not null;

update myntmore.sales_weekly_data
set shirin_outreach = shirin_outreach || jsonb_build_object(
  'SO21', myntmore.safe_rate(shirin_outreach->'SO20', shirin_outreach->'SO19'),
  'SO24', myntmore.safe_rate(shirin_outreach->'SO23', shirin_outreach->'SO22'),
  'SO26', myntmore.safe_rate(shirin_outreach->'SO25', shirin_outreach->'SO23')
)
where shirin_outreach is not null;

update myntmore.sales_weekly_data
set cold_email = cold_email || jsonb_build_object(
  'SO31', myntmore.safe_rate(cold_email->'SO30', cold_email->'SO29'),
  'SO35', myntmore.safe_rate(cold_email->'SO32', cold_email->'SO29'),
  'SO52', myntmore.safe_rate(cold_email->'SO51', cold_email->'SO50'),
  'SO54', myntmore.safe_rate(cold_email->'SO53', cold_email->'SO51')
)
where cold_email is not null;

update myntmore.sales_weekly_data
set meeting_tracker = meeting_tracker || jsonb_build_object(
  'SO40', myntmore.safe_num(meeting_tracker->'SO36') + myntmore.safe_num(meeting_tracker->'SO37')
        + myntmore.safe_num(meeting_tracker->'SO38') + myntmore.safe_num(meeting_tracker->'SO39'),
  'SO43', myntmore.safe_rate(
            meeting_tracker->'SO41',
            to_jsonb(myntmore.safe_num(meeting_tracker->'SO36') + myntmore.safe_num(meeting_tracker->'SO37')
                    + myntmore.safe_num(meeting_tracker->'SO38') + myntmore.safe_num(meeting_tracker->'SO39'))
          ),
  'SO47', myntmore.safe_rate(
            meeting_tracker->'SO46',
            to_jsonb(myntmore.safe_num(meeting_tracker->'SO36') + myntmore.safe_num(meeting_tracker->'SO37')
                    + myntmore.safe_num(meeting_tracker->'SO38') + myntmore.safe_num(meeting_tracker->'SO39'))
          ),
  'SO49', myntmore.safe_num(meeting_tracker->'SO46') * myntmore.safe_num(meeting_tracker->'SO48')
)
where meeting_tracker is not null;
