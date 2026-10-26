-- MM Company Content gets a Video Pipeline tab (Videos Shot / Edited / Scheduled), like TJ Personal Brand.
-- It needs its own column on the weekly table, same shape as linkedin / instagram / website. Run this
-- BEFORE using the new tab (saving a video number fails until the column exists). Safe to re-run.
ALTER TABLE myntmore.mm_weekly_data
  ADD COLUMN IF NOT EXISTS video_pipeline jsonb NOT NULL DEFAULT '{}'::jsonb;
