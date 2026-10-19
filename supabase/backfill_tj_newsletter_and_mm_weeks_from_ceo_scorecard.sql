-- Backfill historical weeks from the CEO scorecard sheets ("Myntmore Company CEO Dashboard").
--
-- WHAT: (1) TJ email-newsletter metrics for 45 weeks (Jan 2025 - Mar 2026) — the app only
--       had 3 weeks of them, so Best Ever Week/Month for Newsletter was wildly low;
--       (2) 8 missing Myntmore (MM) cells in 3 weeks of 2026.
-- HOW:  Sheet "Week 1..4" columns are mapped to the Mondays starting from the week that
--       contains the 1st of the sheet's month (validated: 89% of sheet cells already equal the
--       app's stored value for that date). The sheet's "Remainder" column is NOT imported (it
--       did not line up with any week).
--       Open Rate, Emails Sent and Unsubscribed (count) come straight from the sheet.
--       Delivery Rate = Delivered / Sent, Click Rate = Clicked / Delivered and CTOR =
--       Clicked / Opens are DERIVED from the sheet's counts (rounded to 1 decimal).
-- SAFE: existing values always win — new keys are merged UNDER what is already stored
--       (`new || existing`), so nothing already entered is overwritten. Only non-zero sheet
--       values are imported. Re-runnable. Run in the Supabase SQL editor.
BEGIN;

-- ===== TJ Personal Brand: email newsletter =====

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-01-27', '2025-02-02', '27 Jan – 2 Feb 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2688"},"TJP10":{"value":"13"},"TJP13":{"value":"7"},"TJP09":{"value":"98.4"},"TJP11":{"value":"0.4"},"TJP12":{"value":"3.9"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-02-03', '2025-02-09', '3 Feb – 9 Feb 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2675"},"TJP10":{"value":"11.2"},"TJP13":{"value":"2"},"TJP09":{"value":"98.8"},"TJP11":{"value":"0.5"},"TJP12":{"value":"4.7"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-02-10', '2025-02-16', '10 Feb – 16 Feb 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2670"},"TJP10":{"value":"12"},"TJP13":{"value":"5"},"TJP09":{"value":"97.8"},"TJP11":{"value":"0.4"},"TJP12":{"value":"3.1"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-02-17', '2025-02-23', '17 Feb – 23 Feb 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2662"},"TJP10":{"value":"13"},"TJP13":{"value":"8"},"TJP09":{"value":"98.5"},"TJP11":{"value":"0.3"},"TJP12":{"value":"2.2"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-02-24', '2025-03-02', '24 Feb – 2 Mar 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2651"},"TJP10":{"value":"16"},"TJP13":{"value":"6"},"TJP09":{"value":"98.8"},"TJP11":{"value":"0.2"},"TJP12":{"value":"1"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-03-03', '2025-03-09', '3 Mar – 9 Mar 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2646"},"TJP10":{"value":"11.6"},"TJP13":{"value":"5"},"TJP09":{"value":"98.5"},"TJP11":{"value":"0.3"},"TJP12":{"value":"2.6"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-03-10', '2025-03-16', '10 Mar – 16 Mar 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2643"},"TJP10":{"value":"7.6"},"TJP13":{"value":"3"},"TJP09":{"value":"98.6"},"TJP11":{"value":"0.2"},"TJP12":{"value":"2.5"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-03-17', '2025-03-23', '17 Mar – 23 Mar 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2646"},"TJP10":{"value":"7.8"},"TJP13":{"value":"6"},"TJP09":{"value":"97.2"},"TJP11":{"value":"0.2"},"TJP12":{"value":"2.4"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-03-31', '2025-04-06', '31 Mar – 6 Apr 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2647"},"TJP10":{"value":"9.1"},"TJP13":{"value":"2"},"TJP09":{"value":"98.6"},"TJP11":{"value":"0.2"},"TJP12":{"value":"2.5"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-04-07', '2025-04-13', '7 Apr – 13 Apr 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2649"},"TJP10":{"value":"8"},"TJP13":{"value":"6"},"TJP09":{"value":"98.5"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.9"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-04-14', '2025-04-20', '14 Apr – 20 Apr 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2642"},"TJP10":{"value":"14"},"TJP13":{"value":"5"},"TJP09":{"value":"98.3"},"TJP11":{"value":"0"},"TJP12":{"value":"0.3"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-04-21', '2025-04-27', '21 Apr – 27 Apr 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2630"},"TJP10":{"value":"15"},"TJP13":{"value":"3"},"TJP09":{"value":"98.8"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.7"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-04-28', '2025-05-04', '28 Apr – 4 May 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2638"},"TJP10":{"value":"15"},"TJP13":{"value":"3"},"TJP09":{"value":"98.9"},"TJP11":{"value":"0.2"},"TJP12":{"value":"1.4"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-05-05', '2025-05-11', '5 May – 11 May 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2642"},"TJP10":{"value":"14"},"TJP13":{"value":"1"},"TJP09":{"value":"99.1"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.8"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-05-12', '2025-05-18', '12 May – 18 May 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2645"},"TJP10":{"value":"13"},"TJP13":{"value":"1"},"TJP09":{"value":"96.8"},"TJP11":{"value":"0.4"},"TJP12":{"value":"2.6"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-05-19', '2025-05-25', '19 May – 25 May 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2631"},"TJP10":{"value":"14"},"TJP13":{"value":"1"},"TJP09":{"value":"97.1"},"TJP11":{"value":"0"},"TJP12":{"value":"0.2"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-05-26', '2025-06-01', '26 May – 1 Jun 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2626"},"TJP10":{"value":"16"},"TJP13":{"value":"4"},"TJP09":{"value":"99"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-06-02', '2025-06-08', '2 Jun – 8 Jun 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2622"},"TJP10":{"value":"21"},"TJP13":{"value":"6"},"TJP09":{"value":"99.2"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.4"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-06-09', '2025-06-15', '9 Jun – 15 Jun 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2615"},"TJP10":{"value":"17"},"TJP13":{"value":"4"},"TJP09":{"value":"99.1"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.7"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-06-16', '2025-06-22', '16 Jun – 22 Jun 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2609"},"TJP10":{"value":"20"},"TJP13":{"value":"13"},"TJP09":{"value":"99.1"},"TJP11":{"value":"0"},"TJP12":{"value":"0"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-06-30', '2025-07-06', '30 Jun – 6 Jul 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2607"},"TJP10":{"value":"17"},"TJP13":{"value":"5"},"TJP09":{"value":"99.2"},"TJP11":{"value":"0.3"},"TJP12":{"value":"1.8"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-07-07', '2025-07-13', '7 Jul – 13 Jul 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2604"},"TJP10":{"value":"19"},"TJP13":{"value":"12"},"TJP09":{"value":"99.2"},"TJP11":{"value":"0.5"},"TJP12":{"value":"2.4"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-07-14', '2025-07-20', '14 Jul – 20 Jul 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2593"},"TJP10":{"value":"19"},"TJP13":{"value":"5"},"TJP09":{"value":"99"},"TJP11":{"value":"0.6"},"TJP12":{"value":"2.9"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-07-21', '2025-07-27', '21 Jul – 27 Jul 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2592"},"TJP10":{"value":"28"},"TJP13":{"value":"13"},"TJP09":{"value":"99.5"},"TJP11":{"value":"0.2"},"TJP12":{"value":"0.7"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-07-28', '2025-08-03', '28 Jul – 3 Aug 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2574"},"TJP10":{"value":"23"},"TJP13":{"value":"6"},"TJP09":{"value":"98.7"},"TJP11":{"value":"0.3"},"TJP12":{"value":"1.2"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-08-11', '2025-08-17', '11 Aug – 17 Aug 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2578"},"TJP10":{"value":"35"},"TJP13":{"value":"14"},"TJP09":{"value":"99.1"},"TJP11":{"value":"0.3"},"TJP12":{"value":"0.9"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-08-18', '2025-08-24', '18 Aug – 24 Aug 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2564"},"TJP10":{"value":"30"},"TJP13":{"value":"14"},"TJP09":{"value":"98.9"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.4"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-09-01', '2025-09-07', '1 Sep – 7 Sep 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2572"},"TJP10":{"value":"22"},"TJP13":{"value":"4"},"TJP09":{"value":"97.9"},"TJP11":{"value":"0.4"},"TJP12":{"value":"1.6"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-09-08', '2025-09-14', '8 Sep – 14 Sep 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2543"},"TJP10":{"value":"27"},"TJP13":{"value":"8"},"TJP09":{"value":"98.9"},"TJP11":{"value":"0.5"},"TJP12":{"value":"1.9"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-09-15', '2025-09-21', '15 Sep – 21 Sep 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2534"},"TJP10":{"value":"27"},"TJP13":{"value":"8"},"TJP09":{"value":"98.9"},"TJP11":{"value":"0.2"},"TJP12":{"value":"0.7"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-09-22', '2025-09-28', '22 Sep – 28 Sep 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2536"},"TJP10":{"value":"23"},"TJP13":{"value":"5"},"TJP09":{"value":"99.2"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.5"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-09-29', '2025-10-05', '29 Sep – 5 Oct 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2534"},"TJP10":{"value":"30"},"TJP13":{"value":"13"},"TJP09":{"value":"98.9"},"TJP11":{"value":"0.2"},"TJP12":{"value":"0.5"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-10-06', '2025-10-12', '6 Oct – 12 Oct 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2513"},"TJP10":{"value":"26"},"TJP13":{"value":"7"},"TJP09":{"value":"98.9"},"TJP11":{"value":"0.5"},"TJP12":{"value":"2"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-10-13', '2025-10-19', '13 Oct – 19 Oct 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2596"},"TJP10":{"value":"24"},"TJP13":{"value":"5"},"TJP09":{"value":"99.1"},"TJP11":{"value":"0.1"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-10-20', '2025-10-26', '20 Oct – 26 Oct 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2590"},"TJP10":{"value":"19"},"TJP13":{"value":"2"},"TJP09":{"value":"99.2"},"TJP11":{"value":"0.3"},"TJP12":{"value":"1.4"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-10-27', '2025-11-02', '27 Oct – 2 Nov 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2588"},"TJP10":{"value":"24"},"TJP13":{"value":"5"},"TJP09":{"value":"98.6"},"TJP11":{"value":"0.6"},"TJP12":{"value":"2.6"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-11-03', '2025-11-09', '3 Nov – 9 Nov 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2572"},"TJP10":{"value":"19.4"},"TJP13":{"value":"5"},"TJP09":{"value":"98.6"},"TJP11":{"value":"0"},"TJP12":{"value":"0.2"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-11-10', '2025-11-16', '10 Nov – 16 Nov 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2603"},"TJP10":{"value":"21"},"TJP09":{"value":"99"},"TJP11":{"value":"0"},"TJP12":{"value":"0.2"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-11-17', '2025-11-23', '17 Nov – 23 Nov 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2601"},"TJP10":{"value":"20"},"TJP13":{"value":"3"},"TJP09":{"value":"99"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.4"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-12-01', '2025-12-07', '1 Dec – 7 Dec 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2598"},"TJP10":{"value":"25"},"TJP13":{"value":"5"},"TJP09":{"value":"99.2"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.5"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-12-08', '2025-12-14', '8 Dec – 14 Dec 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2605"},"TJP10":{"value":"23"},"TJP13":{"value":"3"},"TJP09":{"value":"99.3"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.5"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-12-15', '2025-12-21', '15 Dec – 21 Dec 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2607"},"TJP10":{"value":"21"},"TJP13":{"value":"2"},"TJP09":{"value":"99.1"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.4"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2025-12-22', '2025-12-28', '22 Dec – 28 Dec 2025', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2610"},"TJP10":{"value":"24"},"TJP13":{"value":"4"},"TJP09":{"value":"99.3"},"TJP11":{"value":"0.1"},"TJP12":{"value":"0.3"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2026-03-09', '2026-03-15', '9 Mar – 15 Mar 2026', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2693"},"TJP10":{"value":"24"},"TJP13":{"value":"5"},"TJP09":{"value":"99.2"},"TJP11":{"value":"0.9"},"TJP12":{"value":"3.6"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

INSERT INTO myntmore.tj_weekly_data AS t (week_start, week_end, week_label, instagram, youtube, email_newsletter)
  VALUES ('2026-03-16', '2026-03-22', '16 Mar – 22 Mar 2026', '{}'::jsonb, '{}'::jsonb, '{"TJP08":{"value":"2691"},"TJP10":{"value":"23"},"TJP13":{"value":"2"},"TJP09":{"value":"99.2"},"TJP11":{"value":"0.6"},"TJP12":{"value":"2.5"}}'::jsonb)
  ON CONFLICT (week_start) DO UPDATE SET email_newsletter = EXCLUDED.email_newsletter || COALESCE(t.email_newsletter, '{}'::jsonb);

-- ===== Myntmore company content: missing cells (rows already exist) =====

UPDATE myntmore.mm_weekly_data SET instagram = '{"MMI04":{"value":"1588"}}'::jsonb || COALESCE(instagram, '{}'::jsonb) WHERE week_start = '2026-01-26';

UPDATE myntmore.mm_weekly_data SET instagram = '{"MMI04":{"value":"735"}}'::jsonb || COALESCE(instagram, '{}'::jsonb), linkedin = '{"MML02":{"value":"571"},"MML03":{"value":"1"},"MML05":{"value":"20"},"MML06":{"value":"1139"},"MML07":{"value":"553"}}'::jsonb || COALESCE(linkedin, '{}'::jsonb) WHERE week_start = '2026-02-16';

UPDATE myntmore.mm_weekly_data SET instagram = '{"MMI04":{"value":"5259"}}'::jsonb || COALESCE(instagram, '{}'::jsonb) WHERE week_start = '2026-03-09';

COMMIT;
