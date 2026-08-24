-- Run this once in the Supabase SQL editor.
-- Adds monthly "best ever" tracking alongside the existing weekly tracking
-- on the high_scores table.

alter table myntmore.high_scores
  add column if not exists lifetime_high_month numeric,
  add column if not exists achieved_month text;
