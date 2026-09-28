-- Enables the Newsletter content fields for the client "Amey Saxena", who
-- currently doesn't have them visible in data entry / the dashboard:
--   Newsletters Drafted, Newsletter Subscribers, Newsletter Sent,
--   Newsletter Open Rate, Newsletter Click Rate, Newsletter Delivery Rate,
--   Newsletter CTOR (Click-to-Open Rate), Newsletter Unsubscribe Rate
-- (the last 3 are new catalog entries, C38/C39/C40, mirroring TJ Personal
-- Brand's existing newsletter metrics — "email newsletter" and "LinkedIn
-- newsletter" are different things, and these are all email-newsletter
-- fields, same as TJ's).
--
-- This is a per-client data fix, not a schema change: client_settings.
-- active_content_metrics is either NULL (meaning "every standard metric is
-- active") or an explicit array snapshot taken at some point in the past.
-- If a client's array predates a metric being added to the shared catalog
-- (or an admin explicitly unchecked it), that metric silently never shows
-- for them — the same bug class this codebase already has a fix-comment
-- about for C27/C28/L30 (see MetricFieldsTab.tsx).
--
-- This only APPENDS the newsletter ids that are missing; it leaves every
-- other already-selected metric untouched, and is a no-op if Amey's row is
-- already NULL (all metrics already active) or already has all 8 ids.
BEGIN;

UPDATE myntmore.client_settings cs
SET active_content_metrics = (
  SELECT array_agg(DISTINCT id)
  FROM unnest(cs.active_content_metrics || ARRAY['C28','C32','C33','C34','C35','C38','C39','C40']) AS id
)
FROM myntmore.clients c
WHERE cs.client_id = c.id
  AND c.name = 'Amey Saxena'
  AND cs.active_content_metrics IS NOT NULL;

COMMIT;
