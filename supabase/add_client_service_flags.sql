alter table public.client_settings
  add column if not exists content_enabled boolean not null default true,
  add column if not exists leadgen_enabled boolean not null default true;

-- Preserve the meaning used by the dashboard before these explicit flags existed.
update public.client_settings
set
  content_enabled = coalesce(array_length(active_content_metrics, 1), 0) > 0
where active_content_metrics is not null;

update public.client_settings
set
  leadgen_enabled = coalesce(array_length(active_leadgen_metrics, 1), 0) > 0
where active_leadgen_metrics is not null;
