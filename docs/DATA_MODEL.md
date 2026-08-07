# Data model

The production application uses the `myntmore` PostgreSQL schema in Supabase project `gapaawxbkfmpthfesuyw`. This is a shared Supabase project, so always schema-qualify SQL and never alter unrelated schemas or tools.

## Identity and access

| Table | Purpose |
| --- | --- |
| `profiles` | Application profile, status, department, and client linkage for Auth users |
| `user_roles` | Admin/member authorization role mapping; client portal accounts currently use a member-compatible role and are distinguished by profile/client linkage |
| `invites` | Pending/accepted account invitation workflow |
| `client_assignments` | Internal team-to-client assignments |
| `tj_channel_assignments` | Ownership of TJ channels |

Supabase Auth owns credentials in `auth.users`; application SQL should not attempt to take ownership of or directly redefine that system table.

## Client operations

| Table | Purpose |
| --- | --- |
| `clients` | Client master records |
| `client_settings` | Enabled services and client-specific configuration |
| `weekly_data` | Weekly client content/lead-generation JSON metrics |
| `campaigns` | Client-owned outreach campaigns |
| `campaign_weekly_data` | Campaign-level weekly counts and notes |
| `targets` | Metric targets by client/time period |
| `high_scores` | Historical high-score records |
| `aha_moments` | Client wins/highlights |
| `client_alerts` | Client alerts |
| `client_notifications` | Client notifications |
| `client_health_scores` | Health history |
| `client_context_notes` | Contextual client notes |

Ownership hierarchy:

```text
clients
  ├─ client_settings
  ├─ client_assignments
  ├─ weekly_data
  ├─ targets
  └─ campaigns
       └─ campaign_weekly_data
```

## Internal operations

| Table | Purpose |
| --- | --- |
| `actionables` | Personal/team task records |
| `myntmore_processes` | Process definitions/cards |
| `process_weekly_updates` | Weekly process reporting |
| `mm_weekly_data` | Myntmore content metrics |
| `tj_weekly_data` | TJ personal-brand metrics |
| `sales_weekly_data` | Internal sales/outreach metrics |
| `finance_data` | Admin-only finance records |
| `expenses` | Admin-only expense records |
| `growth_initiatives` | Growth initiative records |
| `growth_initiative_comments` | Initiative discussion |
| `initiatives` | Initiative records |
| `hot_leads` | Lead records where enabled |

## Keys and upserts

Weekly tables generally identify a row using an owner plus `week_start` (and sometimes `week_end`). Campaign weekly data upserts on `(campaign_id, week_start)` while validating the associated client. Before changing a unique constraint, audit existing duplicates and every `.upsert(..., { onConflict: ... })` call.

## RLS and integrity files

- `supabase/secure_dashboard_rls.sql` is the current comprehensive RLS hardening reference.
- `supabase/campaign_client_integrity.sql` enforces campaign/client ownership consistency.
- Other SQL files are feature migrations or historical access changes. Review chronology before applying them; do not blindly execute every file against an established database.
