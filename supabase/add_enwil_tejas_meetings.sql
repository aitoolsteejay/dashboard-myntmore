-- Enwil and Tejas get their own Meeting Tracker (meetings booked per meeting type), shown on the
-- Dashboard above the company-wide Meeting Tracker. Each is one jsonb column on the weekly sales row,
-- like cold_email / meeting_tracker. Run this BEFORE entering numbers in the new Sales sections
-- (saving those sections fails until the columns exist). Safe to re-run.
ALTER TABLE myntmore.sales_weekly_data
  ADD COLUMN IF NOT EXISTS enwil_meetings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tejas_meetings jsonb NOT NULL DEFAULT '{}'::jsonb;
