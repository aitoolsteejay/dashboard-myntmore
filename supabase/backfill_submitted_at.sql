-- One-time fix: any weekly_data row that already has content/leadgen
-- metrics saved (as a draft, before the auto-submit fix) but is missing
-- the submitted_at flag is invisible on the dashboard. Stamp those rows
-- as submitted now so the data shows immediately.

update myntmore.weekly_data
set content_submitted_at = coalesce(content_submitted_at, now())
where content_metrics is not null
  and content_metrics != '{}'::jsonb
  and content_submitted_at is null;

update myntmore.weekly_data
set leadgen_submitted_at = coalesce(leadgen_submitted_at, now())
where leadgen_metrics is not null
  and leadgen_metrics != '{}'::jsonb
  and leadgen_submitted_at is null;
