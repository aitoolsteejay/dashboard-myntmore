# Dashboard user guide

## How reporting works

The dashboard is primarily week-based. Choose the reporting week in the shared week selector, then enter or review data for that same period. The selected week follows the user across pages and persists in the browser.

The dashboard summarizes stored source data into totals, averages, achievement percentages, alerts, and missing-submission indicators. Derived values should not require separate entry.

## Roles

### Admin

Admins can manage the full operational dashboard, settings, clients, team accounts, assignments, targets, and finance. They can create/reset accounts through the approved settings flow.

### Member

Members work in operational sections without gaining administrator controls. Their experience should remain stable even when they have fewer assignments; an empty state is expected, not an error.

### Client account

Client users enter through the portal and see only their linked client workspace and permitted data. Internally their Auth role may use the member-compatible value, while their client profile/linkage routes them to portal-only access. They do not use internal administration pages.

## Main sections

| Section | Purpose |
| --- | --- |
| Dashboard | Weekly command centre, missing data, target status, client performance, TJ brand, and sales summaries |
| Clients | Client list and detailed client workspace |
| Data Entry | Manual weekly entry plus campaign CSV import/prefill |
| Actionables | Personal and team task boards, assignees, statuses, due work, and carried-forward items |
| Monthly Targets | Monthly targets and progress review |
| Reports | Aggregated reporting and analysis |
| Processes | Myntmore process cards and weekly process updates |
| Sales & Outreach | Internal weekly outreach performance |
| Myntmore Content | Myntmore's own social/content channels |
| TJ Personal Brand | Instagram, YouTube, email newsletter, and video-pipeline reporting |
| Settings | Admin-only team, clients/portal access, targets, metric fields, TJ channels, and export tools |
| Finance | Admin-only financial data |

## Normal weekly workflow

1. Select the correct week and confirm the displayed date range.
2. Open Data Entry and select the client.
3. Enter content and lead-generation source figures appropriate to that client's enabled services.
4. For each lead-generation campaign, either enter values manually or import its Waalaxy CSV. Review imported values and complete positive/negative replies, hot leads, meetings, and notes manually.
5. Save and confirm success. If a save fails, keep the page open, check connectivity, and retry; do not overwrite the row with guessed values.
6. Enter Myntmore, TJ, process, and sales figures in their respective sections.
7. Review Dashboard missing-data and below-target indicators.
8. Create/update actionables and assign owners and due dates.
9. Spot-check the client portal where relevant.

## Client configuration

Admins configure each client's enabled services in Settings. Lead generation and content can be enabled independently. This controls which metrics appear in data entry and dashboard views; it must not delete historical data when a service is disabled.

Client portal access is managed separately from internal team membership. Portal accounts can be created and passwords reset from the Clients settings area.

## Waalaxy CSV import

Use the per-campaign export from Waalaxy's Statistics area for the selected campaign. In campaign weekly entry:

1. Confirm the dashboard week matches the intended reporting range.
2. Choose **Import from Waalaxy CSV** and select the file.
3. Review the inline summary for Requests Sent, Accepted, and Answered.
4. Complete the remaining fields manually.
5. Click Save. Importing does not save by itself and does not make the entry read-only; every value remains editable.

The answer count is channel-agnostic because Waalaxy's last detected reply may be LinkedIn or email.

## When something looks wrong

- Confirm the selected client and week first.
- Reload only after checking whether unsaved manual values are present.
- If one client's campaign appears under another, stop entry and report both client names, campaign name, week, and screenshot; do not attempt a bulk cleanup.
- If logout leaves the old dashboard visible, treat it as an authentication incident and report it. The expected result is an immediate login screen.
- Include the exact error toast, page URL, selected week, user role, and steps to reproduce in a bug report. Never include passwords or keys.
