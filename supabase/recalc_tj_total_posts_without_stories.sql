-- Tejas's Instagram "Total Posts" (TJI04) used to be stories + carousels + reels. Stories are not posts, so it is
-- now carousels (TJI02) + reels (TJI03). The old total is stored on every week, so recompute it. Safe to re-run.
UPDATE myntmore.tj_weekly_data w
SET instagram = w.instagram || jsonb_build_object('TJI04',
      (CASE WHEN jsonb_typeof(w.instagram -> 'TJI04') = 'object' THEN w.instagram -> 'TJI04' ELSE '{}'::jsonb END)
      || jsonb_build_object('value', t.total))
FROM (
  SELECT x.id,
         COALESCE(CASE WHEN x.v2 ~ '^[0-9]+(\.[0-9]+)?$' THEN x.v2::numeric END, 0)
       + COALESCE(CASE WHEN x.v3 ~ '^[0-9]+(\.[0-9]+)?$' THEN x.v3::numeric END, 0) AS total
  FROM (
    SELECT id,
           CASE WHEN jsonb_typeof(instagram -> 'TJI02') = 'object' THEN instagram -> 'TJI02' ->> 'value' ELSE instagram ->> 'TJI02' END AS v2,
           CASE WHEN jsonb_typeof(instagram -> 'TJI03') = 'object' THEN instagram -> 'TJI03' ->> 'value' ELSE instagram ->> 'TJI03' END AS v3
    FROM myntmore.tj_weekly_data
    WHERE jsonb_typeof(instagram) = 'object'
  ) x
) t
WHERE t.id = w.id
  AND jsonb_typeof(w.instagram) = 'object'
  AND (w.instagram ? 'TJI04' OR w.instagram ? 'TJI02' OR w.instagram ? 'TJI03');
