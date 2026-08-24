-- Run once in the Supabase SQL editor.
-- MM Content autosave includes the Ads section in every weekly-data upsert.
-- Without this column, PostgREST rejects the entire payload and no section saves.

alter table myntmore.mm_weekly_data
  add column if not exists ads jsonb not null default '{}'::jsonb;

comment on column myntmore.mm_weekly_data.ads is
  'Weekly Google and Meta advertising metrics keyed by metric ID.';

