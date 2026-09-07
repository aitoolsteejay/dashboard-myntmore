-- Custom metrics for TJ Personal Brand — a parallel, independent feature to
-- supabase/add_custom_metrics.sql (per-client custom metrics). TJ Personal
-- Brand is a single, company-wide entity (tj_weekly_data has no client_id,
-- one row per week) organized into 4 fixed channels instead of a
-- client + category, so this table is simpler: no client_id, no per-client
-- visibility allowlist, no client-facing read tier.

create table if not exists myntmore.tj_custom_metrics (
  id uuid primary key default gen_random_uuid(),
  -- Reserved 'Y##' prefix — deliberately different from the per-client
  -- custom_metrics table's 'X##' prefix so the two namespaces can never
  -- collide even if ever queried together. Generated globally (no client_id
  -- to partition by — there's only one TJ entity).
  metric_key text not null unique,
  channel text not null check (channel in ('instagram', 'youtube', 'email_newsletter', 'video_pipeline')),
  name text not null,
  -- No 'auto': matches the per-client table's scope. TJI04 (Total Posts) is
  -- the one existing auto-calc field and stays hardcoded by id in
  -- TJBrandPage.tsx — generalizing that is a separate, out-of-scope cleanup.
  type text not null check (type in ('number', 'percentage', 'textarea')),
  unit text,
  has_target boolean not null default false,
  sort_order integer not null default 0,
  -- Soft delete: keeps historical tj_weekly_data/targets rows that reference
  -- this metric_key labeled, instead of orphaning them.
  archived boolean not null default false,
  created_by uuid references myntmore.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function myntmore.generate_tj_custom_metric_key()
returns trigger
language plpgsql
as $$
declare
  next_seq integer;
begin
  if new.metric_key is not null and new.metric_key !~ '^Y[0-9]+$' then
    raise exception 'tj_custom_metrics.metric_key must match Y## (got %)', new.metric_key;
  end if;

  if new.metric_key is null then
    select coalesce(max(substring(metric_key from 2)::int), 0) + 1
      into next_seq
      from myntmore.tj_custom_metrics
      where metric_key ~ '^Y[0-9]+$';
    new.metric_key := 'Y' || lpad(next_seq::text, 2, '0');
  end if;

  return new;
end;
$$;

create or replace function myntmore.touch_tj_custom_metrics_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tj_custom_metrics_set_key on myntmore.tj_custom_metrics;
create trigger tj_custom_metrics_set_key
  before insert on myntmore.tj_custom_metrics
  for each row execute function myntmore.generate_tj_custom_metric_key();

drop trigger if exists tj_custom_metrics_set_updated_at on myntmore.tj_custom_metrics;
create trigger tj_custom_metrics_set_updated_at
  before update on myntmore.tj_custom_metrics
  for each row execute function myntmore.touch_tj_custom_metrics_updated_at();

-- RLS: single all-access policy for internal users, mirroring
-- tj_weekly_data_internal_all (secure_dashboard_rls.sql) — nothing
-- client-facing ever reads TJ data, so there's no read-only tier here.
alter table myntmore.tj_custom_metrics enable row level security;

drop policy if exists "tj_custom_metrics_internal_all" on myntmore.tj_custom_metrics;
create policy "tj_custom_metrics_internal_all" on myntmore.tj_custom_metrics
  for all
  to authenticated
  using (myntmore.is_internal_user())
  with check (myntmore.is_internal_user());
