-- Per-client custom metrics: fields that only exist for one specific client,
-- not part of the shared src/data/metrics.ts catalog. Values still live in the
-- existing schemaless weekly_data.content_metrics/leadgen_metrics jsonb columns
-- and the free-text-keyed targets/high_scores tables — this table only stores
-- the metric's *definition* (name, type, group, target/note support).

create table if not exists myntmore.custom_metrics (
  id uuid primary key default gen_random_uuid(),
  -- Short, readable, reserved-prefix key actually stored in weekly_data/targets/
  -- high_scores (e.g. 'X01') — server-generated below, never client-supplied,
  -- so an admin can never accidentally shadow a real metric like 'C08'.
  metric_key text not null,
  client_id uuid not null references myntmore.clients(id) on delete cascade,
  name text not null,
  type text not null check (type in ('number', 'percentage', 'textarea')),
  category text not null check (category in ('content', 'leadgen')),
  "group" text not null default 'Custom',
  unit text,
  has_target boolean not null default false,
  has_note boolean not null default false,
  sort_order integer not null default 0,
  -- Soft delete: keeps historical weekly_data/targets/high_scores rows that
  -- reference this metric_key labeled, instead of orphaning them.
  archived boolean not null default false,
  created_by uuid references myntmore.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, metric_key)
);

-- Server-generates metric_key as 'X' + a 2-digit, per-client sequence (X01, X02, ...).
-- Never trust a client-supplied metric_key, and reject anything that doesn't
-- match the reserved X-prefix convention so it can never collide with the
-- standard C##/L## catalog.
create or replace function myntmore.generate_custom_metric_key()
returns trigger
language plpgsql
as $$
declare
  next_seq integer;
begin
  if new.metric_key is not null and new.metric_key !~ '^X[0-9]+$' then
    raise exception 'custom_metrics.metric_key must match X## (got %)', new.metric_key;
  end if;

  if new.metric_key is null then
    select coalesce(max(substring(metric_key from 2)::int), 0) + 1
      into next_seq
      from myntmore.custom_metrics
      where client_id = new.client_id
        and metric_key ~ '^X[0-9]+$';
    new.metric_key := 'X' || lpad(next_seq::text, 2, '0');
  end if;

  return new;
end;
$$;

create or replace function myntmore.touch_custom_metrics_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists custom_metrics_set_key on myntmore.custom_metrics;
create trigger custom_metrics_set_key
  before insert on myntmore.custom_metrics
  for each row execute function myntmore.generate_custom_metric_key();

drop trigger if exists custom_metrics_set_updated_at on myntmore.custom_metrics;
create trigger custom_metrics_set_updated_at
  before update on myntmore.custom_metrics
  for each row execute function myntmore.touch_custom_metrics_updated_at();

-- RLS: same two-tier pattern as client_portal_rls.sql. Custom metrics live in
-- the CLIENT-READABLE tier (like weekly_data/high_scores/targets), not the
-- admin-only tier client_settings sits in — the client portal needs to read a
-- custom metric's definition (name/type) to label the value it can already see.
alter table myntmore.custom_metrics enable row level security;

drop policy if exists "admin_full_access" on myntmore.custom_metrics;
create policy "admin_full_access" on myntmore.custom_metrics
  for all
  using (myntmore.has_role(auth.uid(), 'admin'))
  with check (myntmore.has_role(auth.uid(), 'admin'));

drop policy if exists "client_read_own" on myntmore.custom_metrics;
create policy "client_read_own" on myntmore.custom_metrics
  for select
  using (myntmore.is_own_client(client_id));
