# The Dashboard Bible

**Myntmore Command Center — everything about the dashboard, in one place.**

Last updated: 11 November 2026. Written from the code in this repository (`dashboard-myntmore`). Where something could not be confirmed from the code alone (for example, the exact state of the live database), the text says so.

---

## How to use this document

- **New to the dashboard?** Read Parts 1 to 3. They explain what it is, who uses it and how a normal week works.
- **Looking for a page?** Part 4 walks through every screen, top to bottom.
- **Wondering what a number means?** Part 5 lists every metric, and Part 6 explains how each one is calculated.
- **Changing something or fixing something?** Parts 7 to 10 cover the database, security, the tech setup and step-by-step playbooks.
- **Something looks wrong?** Part 11 lists the known quirks and open problems. Check it before assuming a bug is new.
- **Unknown word?** Part 12 is a glossary.

Other documents in `docs/` still exist (`ARCHITECTURE.md`, `DATA_MODEL.md`, `DEVELOPMENT_GUIDE.md`, `OPERATIONS_RUNBOOK.md`, `DASHBOARD_USER_GUIDE.md`, `MYNTMORE_DASHBOARD_NOTION.md`). This Bible is the most detailed and the most recent. If two documents disagree, trust this one, then the code.

### Contents

1. [What the dashboard is](#part-1--what-the-dashboard-is)
2. [How a normal week works](#part-2--how-a-normal-week-works)
3. [Who can do what](#part-3--who-can-do-what)
4. [A tour of every page](#part-4--a-tour-of-every-page)
5. [Metric reference](#part-5--metric-reference)
6. [How the numbers are calculated](#part-6--how-the-numbers-are-calculated)
7. [The database](#part-7--the-database)
8. [Security](#part-8--security)
9. [Tech stack, project layout and deployment](#part-9--tech-stack-project-layout-and-deployment)
10. [Playbooks: how do I…?](#part-10--playbooks-how-do-i)
11. [Known quirks and open problems](#part-11--known-quirks-and-open-problems)
12. [Glossary](#part-12--glossary)
13. [Change log](#part-13--change-log)

---

# Part 1 — What the dashboard is

## The one-minute version

**Myntmore** is a LinkedIn growth and lead-generation agency. It runs LinkedIn content (posting, ideation, newsletters) and cold outreach (connection requests, InMails, messages) on behalf of its clients, and it also markets itself and its founder, Tejas Jhaveri.

The **Command Center** (this dashboard) is the agency's operating system. Every Monday-to-Sunday week, the team types in what happened for each client, and the dashboard turns that into:

- a **weekly and monthly scoreboard** for every client (posts, impressions, connection requests, acceptance rate, meetings booked…);
- **progress against targets**, colour-coded so problems are obvious;
- **records ("high scores")** for every metric, so wins are visible;
- a **health score** per client, and alerts when a client looks unhappy;
- **tracking for the company itself**: Tejas's personal brand, Myntmore's own content, sales and meetings, internal processes;
- a **task board** (actionables) for the team;
- **reports and exports** (Excel, PDF) for management and for clients;
- a **client portal**, a read-only view where each client logs in to see only their own results.

## Two audiences, one app

| Audience | What they see | Where |
|---|---|---|
| **The Myntmore team** (admins and members) | All clients, data entry, targets, reports, company tracking, settings (admins only) | The main app, starting at `/dashboard` |
| **Clients** | Only their own results, campaigns and action plan. Read-only. | The portal at `/portal` |

Role separation is enforced twice: in the app (what pages open) and in the database (what rows can be read). See Part 3 and Part 8.

## The main building blocks

| Block | What it is |
|---|---|
| **Clients** | The businesses Myntmore serves. "External" clients are paying customers. "Internal" clients are Myntmore's own (currently **Enwil** and **Tejas Jhaveri**). |
| **Weekly data** | One record per client per week, holding every content and lead-generation number. |
| **Campaigns** | A client's individual LinkedIn outreach campaigns. Their weekly numbers roll up into the client's lead-gen totals. |
| **Targets** | The goals set per metric, weekly or monthly. |
| **High scores** | The best-ever week and best-ever month for each metric. |
| **TJ** | Tejas Jhaveri's personal brand: Instagram, YouTube, newsletter, video pipeline. |
| **MM** | Myntmore's own company content: LinkedIn, Instagram, website, SEO, other channels, ads, video pipeline. |
| **Sales & Outreach** | Myntmore's own sales numbers, outreach by person, and the meeting trackers. |
| **Actionables** | Tasks for the team (and some visible to clients). |
| **Processes** | Internal processes with a weekly status update each. |

## What the dashboard is not

- It is **not** a place where LinkedIn data is pulled automatically. People enter numbers by hand, apart from the **Waalaxy CSV import** for campaigns (Part 4).
- It does **not** send emails. Invites produce a link that an admin shares.
- **Finance** is a placeholder ("coming soon"); nothing is built there yet.

---

# Part 2 — How a normal week works

## The weekly loop

```
Mon–Sun week happens
        │
        ▼
 Team enters data  ──►  Data Entry (per client), TJ, MM, Sales, Processes
        │                     (auto-saves as you type)
        ▼
 Dashboard recalculates  ──►  totals, rates, targets %, records ★, health score
        │
        ▼
 Review  ──►  Dashboard (missing data, below target), Reports, Monthly Targets
        │
        ▼
 Follow up  ──►  Actionables (tasks), client portal for clients to see results
```

## Step by step

1. **Pick the week.** The week selector in the top bar chooses the reporting week. It defaults to the **last completed** Monday–Sunday week. The current in-progress week is never offered. The choice follows you from page to page and is remembered until a new reporting week starts.
2. **Enter client data** (Data Entry). Choose the client, then fill in the Content tab and the Lead Gen tab. Only the services enabled for that client are shown.
3. **Handle campaigns.** For each active campaign either type the numbers or import the Waalaxy CSV. Then fill in the manual fields (positive replies, negative replies, hot leads, meetings, notes).
4. **Enter the company areas:** Myntmore (MM), TJ, Sales & Outreach (including the Enwil and Tejas meeting trackers), and Processes.
5. **Check the dashboard.** The "Submissions complete" card and the "Deliverables Check" card show who is missing data or below target.
6. **Create tasks** for anything that needs follow-up (Actionables).
7. **Month-end:** generate the EOM (end-of-month) PDF report for each client from Reports.

## Important rule: saving = submitting

The dashboard saves automatically about 1.5 seconds after you stop typing. **Every save, including auto-save and the "Save Draft" button, marks that part of the week as submitted.** There is no separate approval step. In practice a week counts as "submitted" from its first save.

The reverse is also true: a week with **no** submitted mark reads as **blank** everywhere (dashboard, reports, portal). This is deliberate, so half-finished data never shows up as zeros.

## Blank is not zero

- A **blank** field shows a dash (`-`).
- A real **0** shows `0`.
- Blank weeks are skipped in totals and averages. Zero weeks count.

---

# Part 3 — Who can do what

## The three kinds of user

| | Admin | Member | Client |
|---|---|---|---|
| Open the main app | Yes | Yes | No (sent to the portal) |
| Dashboard, Data Entry, Reports, Clients, Actionables, Monthly Targets, High Scores, Leaderboard | Yes | Yes | No |
| Sales, TJ, MM, Processes | Yes | Yes | No |
| **Settings** (team, portal access, targets, metric fields, TJ channels, export) | **Yes** | No | No |
| **Finance** | **Yes** | No | No |
| Add, edit, archive clients | Yes | No (can view) | No |
| Create or delete processes | Yes | No (can update) | No |
| Change targets | Yes | No | No |
| View the client portal | Yes (only via "View as client", if linked to a client) | No | Yes, own data only |
| Update a task marked for the client | n/a | n/a | Yes (status + comment only) |

Behind the scenes: roles are stored in a table (`user_roles`) as either `admin` or `member`. Client portal users are also given `member`, and are told apart because their profile department is `client` and a client record points at them.

## What happens when you open the app

- **Signed out** → sent to `/login`.
- **Client-only user** → always sent to `/portal`; internal pages bounce back.
- **Admin** → can open everything. An admin who is also linked to a client record sees a **"View as client"** link in the sidebar and a **"Back to Dashboard"** button in the portal.
- **Member** → can open all operational pages. Trying `/settings` or `/finance` sends them back to `/dashboard`.
- **Disabled account** → signed out immediately and sent to `/login`.

## Assignments

Each client can have two managers: a **Content Manager** and a **Lead Gen Manager**. They are set when a client is added or edited. Assignments are used for:

- the **Team Submission Status** section on the dashboard (who is responsible for which client's submissions);
- the "Clients assigned" count on the Team tab in Settings.

Assignments do **not** hide data. Every internal user can see every client.

## Internal vs external clients

- **External** (default): normal paying clients.
- **Internal:** Myntmore's own — **Enwil** and **Tejas Jhaveri**.

Internal clients are shown **below** external clients on the dashboard, Clients page and in the Data Entry picker, with small "External Clients" and "Internal Clients" headings. Admins change a client's type in the Edit Client form. This is separate from "internal users" (team members).

## Signing in and invites

- **Login:** email and password. There is **no "forgot password"** link. Only an admin can reset a password.
- **Inviting a team member:** an admin opens Settings → Team → *Invite Member*, enters name and email, and gets a link (`/accept-invite?token=…`) to send them. The app does not email it. The invitee opens it and picks a password (minimum 8 characters).
- **Portal accounts for clients:** an admin creates them in Settings → Clients (*Create Portal Account*). See Part 4.
- Passwords must never be set by editing the database directly. Use the admin screens, which call the `create-portal-user` edge function.

---

# Part 4 — A tour of every page

## 4.0 The frame around every page

**Sidebar** (collapsible; remembers its state; shortcut ⌘/Ctrl + B):

| Group | Items |
|---|---|
| Overview | Dashboard |
| Client work | Clients, Data Entry, Actionables, Monthly Targets |
| Insights | Reports, Client Leaderboard, High Scores |
| Administration | Settings (admins only) |

The footer shows your name and role, a **View as client** link (admins linked to a client) and **Sign out**.

Sales, TJ Personal Brand, MM Content and Processes are **not** in the sidebar. You reach them through the **tabs in Data Entry** and through links on the dashboard. Finance has no link anywhere.

**Top bar** (sticks to the top):

- **Page label.**
- **Search** (⌘/Ctrl + K): jumps to pages and two quick actions (*Enter weekly data*, *Create actionable*). It searches page names only, not data.
- **Week selector** ("Workspace week"): the last 16 completed weeks. The latest is tagged *Last week*. An amber **Past period** badge appears when you are not on last week.
- **Bell:** shows a red dot when something needs attention: unresolved client alerts, overdue actionables, or upcoming milestones. Counts load once when the page opens.
- **Quick add** (yellow button): Enter weekly data, Add an actionable, Open client workspace.

**Toasts** (little pop-up messages) appear top-right for successes and errors.

---

## 4.1 Dashboard — `/dashboard`

The command centre. It shows the selected week (or month) for every client and for the company areas.

### Header

- Title and the week label.
- **Milestones** button (only appears if there are any): upcoming client birthdays and Myntmore-start anniversaries in the next 21 days. A checkmark dismisses an item for everyone.
- **Weekly View / Monthly View** toggle.
- **Quick Data Entry** shortcut.

### At-a-glance cards

| Card | Meaning |
|---|---|
| **Submissions complete** | Clients with every *enabled* service submitted for the week, as `x/y` and a percent |
| **Below target / missing** | Number of clients in the Deliverables Check list |
| **Overdue actionables** | Tasks past their due date and not done |
| **Open actionables** | Tasks still open, and across how many clients |

### Active Alerts

Shown only when there are unresolved alerts. Collapsed by default. Each row has a **Resolve ✓** button. Today the only automatic alerts are the **happiness alerts** (Part 6).

### Deliverables Check (the missing-data card)

Lists clients that have weekly targets and are missing data or below target:

- **"No data submitted"** (red, pulsing) if the client has no record for the week.
- **"N metrics below target"** otherwise. Expand to see each metric as *actual / target* with a mini bar.
- Rows are coloured red below 50%, amber 50–79%, light amber from 80%.
- Sorted: not-submitted first, then worst percentage.
- Each row links to **Enter data →**.

### Client Performance

Clients are grouped **External first, then Internal**.

**Collapsed client card (weekly view)**

- Initials tile, the client's **full name on its own line**, company underneath.
- **▼ Weekly Breakdown** button: opens the card and a table with one column per week of the month plus a Monthly Total.
- **Freeze / Unfreeze** (pin icon): while the card is open, keeps this summary row pinned under the top bar as you scroll, so you always know whose numbers you are reading. Resets on reload.
- **Summary numbers**, each coloured by progress to target, with the target shown underneath and a ★ if it is the record:
  - Content (if enabled): LI Drafting (C03), Posts (C09), Impressions (C10), Avg/Post (C26).
  - Lead Gen (if enabled): Connection Requests (L10), Acceptance Rate (L12), Reply Rate (L14), Hot Leads (L22), Booked (L24).
- **Status dots:** one per enabled service, green if submitted that week.

**Expanded card, in order**

1. Weekly Breakdown table (if you opened it).
2. **Content Metrics** block: monthly goal cards (C01, C03, C09) showing month-to-date vs the monthly target, then the metric table.
3. **Lead Gen Metrics** block: a goal card for connection requests (L10), then the table.
4. **Campaigns** (lead-gen clients): tabs Active / Completed / Paused. Each campaign is a month table by week with a *Total Campaign Analytics* column, an **Edit Campaign** button and per-week edit buttons.
5. **Qualitative cards:** What's Working / What's Not Working (content and lead gen) and a **Happiness Index** circle (0–10).
6. **Aha Moments:** admin-posted wins that the client sees in their portal.
7. **Weekly summary footer:** total posts, total impressions, average per post, in/out-of-network share, total connection requests.

**The metric tables** have the same seven columns everywhere: *Metric Name, Current Week, Previous Week, Weekly Target Status, Monthly Target Status, Best Ever Week, Best Ever Month.*

### The colour key (ACH%)

Printed above every table:

| Progress to target | Colour | Label |
|---|---|---|
| 100% or more | Green | On target |
| 75–99% | Yellow | Close |
| 50–74% | Orange | Below |
| Under 50% | Red | Off track |

- **★ New high:** shown next to the current week's value when this week is the record week and the value equals the record. Never shown for "lower is better" metrics.
- **■ Best ever:** the gold/amber Best Ever columns.
- **Careful:** other pages use different colour bands (Reports and the portal use blue/green/amber/red at 100/75/50; Settings → Targets uses 100/70/40). A colour does not mean exactly the same thing everywhere.

### Freeze buttons and sticky headers

- Each **table** has its own **📌 Freeze** button: the table gets its own scroll area with a pinned header row.
- Each **client card** has a **Freeze** button (above): pins the client's summary row.
- Block headers (e.g. "Content Metrics") also stick under the top bar.
- Frozen states are not saved.

### Folding sections

Every section header and block header folds open and closed. Nothing is remembered after a reload (apart from Active Alerts starting collapsed).

### Monthly View

- **Client Performance** turns into a **month comparison**: month totals on the summary row, and an expanded *Previous Month / Current Month / Change* table for every metric. A ★ means "best month ever".
- **TJ, Sales and MM** become **"(Month to Date)"**: they add up only the weeks up to the selected week; the weekly-target and previous-week columns go blank and there is no ★.
- Note the difference: client monthly totals cover the **whole calendar month**, TJ/Sales/MM are **month-to-date**.

### TJ Personal Brand section

Blocks: Instagram, YouTube, Newsletter, Video Pipeline. Same seven-column table and goal cards. Targets come from the shared targets table with no client. Custom TJ metrics appear automatically. Empty weeks show "No data submitted" with a link to the TJ page.

### Sales & Outreach section

Blocks, in order:

1. TJ Outreach
2. Jahnvi Outreach
3. Shirin Outreach
4. Cold Email (Waalaxy)
5. Cold Emailing
6. **Enwil Meetings**
7. **Tejas Meetings**
8. **Meeting Tracker (Company Total)**

The three meeting blocks sit together. Enwil and Tejas each show meetings booked by type (LinkedIn, Cold Email, Referral, Other, Website | AI) plus a total. The **Company Total** block is the whole company's meetings by type, plus Completed, No-Show, Completion Rate, Proposals, Follow-ups, Conversions, Conversion Rate, Average Deal Size and Total Revenue (₹). The company total is **entered by hand**; it is not calculated from the Enwil and Tejas blocks.

Only the Cold Emailing counts (SO50, SO51, SO53, SO55) have targets.

### MM Company Content section

Blocks: **MM LinkedIn, MM Instagram,** Website Analytics, SEO, Other Channels (Quora, Reddit, Medium), Ads Performance, Video Pipeline. LinkedIn impressions and the average per post are worked out when displayed (older weeks stored a split).

### Myntmore Processes

Active processes sorted by priority, each with a status dot (green = updated for this week, amber = waiting), priority and category badges, owner, status text. Expand for the definition and this week's update. Link to the Processes workspace.

### Team Submission Status

One row per person who has assigned clients: *x/y submitted* with ✓ All, ⚠️ Partial or ✗ None. A person is responsible for a client's content if they are its Content Manager, and for lead gen if they are its Lead Gen Manager. People with no assigned clients do not appear.

### Open Actionables

Per client with open tasks: a count and "(N carried forward)". "All clear!" when empty.

### What the dashboard reads and writes

Reads: clients, alerts, weekly data (selected week, previous week, the month), TJ/MM/Sales weekly data, profiles, actionables, targets, high scores, processes and their updates, client settings, custom metrics, notifications, campaigns, aha moments.
Writes: resolving alerts, notifications (insert/dismiss), aha moments (insert/delete), and **high scores** (a backfill that rescans each client's history on every dashboard load).

---

## 4.2 Data Entry — `/data-entry`

A hub with five tabs. Switching tabs unmounts the previous one. All tabs use the shared week.

| Tab | What it is |
|---|---|
| **Client Data Entry** | Weekly numbers for one client |
| **MM Content** | Myntmore's own content channels |
| **TJ Personal Brand** | Tejas's channels |
| **Sales & Outreach** | Sales numbers, hot leads, meeting trackers |
| **Processes** | Weekly process updates |

### Client Data Entry

**Top of the page**

- Sticky save bar with a live status: *Auto-save on, Unsaved changes, Saving…, Saved at HH:MM:SS, Save failed (Retry)*.
- **Save Draft** and **Submit Week** buttons.
- **Select Week** (12 completed weeks) and **Select Client** (grouped External / Internal).
- **Context** button: opens a side panel with the client's pinned notes (read-only here).
- **Content** and **Lead Gen** tabs. A tab is disabled if that service is turned off for the client (Settings → Metric Fields).

**Switching client or week** first saves anything pending. If that fails, you stay where you are and get an error. When a teammate edits the same week, a "Data updated" toast appears (live subscription).

**Content tab**

Accordion groups, each with an "x/y filled" badge: Production Pipeline, Post Output, Performance, Engagement Activity, Delivery & Reporting (only shown in the **last week of the month**), Email Newsletter, LinkedIn Newsletter, plus any custom groups. Then the Qualitative block (What's Working, What's Not Working, Happiness Index).

Each metric appears as a **card** showing the input, target, weekly and monthly targets, achievement %, last week's value with the change, and the record trophy. Percentages are limited to 0–100. Total Posts (C09) and Avg Impressions per Post (C26) are read-only and calculated. Only metrics enabled for the client appear; if Total Impressions (C10) is on, its companions (C26, C36, C37) come with it.

**Lead Gen tab**

In order (this matches the order of the dashboard's Lead Gen table, so the two always read the same way):

1. **InMail Outreach:** the ICP text (L01), sent (L02), accepted (L03), declined (L04), an automatic acceptance rate (L05), hot leads (L06).
2. **Active Campaigns** and **Weekly Totals** (the connection-request funnel and meetings, L10–L18 and L24).
3. **Existing Connections:** messages sent (L19), replies (L20), an automatic response rate (L21), hot leads (L22), notes.
4. **Custom metrics** for this client.
5. **Qualitative:** what's working, what's blocking, Happiness Index.

Meetings Attended (L25) and Leads Generated (L27) appear on the dashboard but have no input here.

**Campaigns**

- One accordion item per active campaign. Header buttons: Edit, an Active/Inactive toggle, Delete (with confirmation).
- Inside: **Import from Waalaxy CSV**, then Outreach (sent, accepted), Engagement (answered, positive, negative), Results (meetings, hot leads), Existing Connections (sent, replied), Notes, and the message narrative.
- **+ Add New Campaign:** name (required), start date, ICP description, messaging strategy.
- **Completed / Inactive campaigns** sit behind a "Show…" button. Each has week pills and a **+ New Entry** button for any past week.
- **Weekly Totals** show sums across campaigns for the selected week.

**Where the client-level lead-gen numbers come from.** After any campaign save, the dashboard adds up all the client's campaigns for the week and writes **six** fields into the client's weekly lead-gen data: L10 (requests sent), L11 (accepted), L13 (answered), L15 (positive replies), L16 (negative replies), L24 (meetings booked). Other fields are never touched. Hot leads per campaign are **not** rolled up; the dashboard's Hot Leads column reads the *Existing Connections hot leads* (L22).

**Legacy mode.** If a week has old, pre-campaign totals and no campaigns, the page shows them read-only as "Legacy Lead Gen Data". The **Calibrate Old Data** button copies chosen legacy weeks into a campaign.

**Waalaxy CSV import**

- Required columns: `connectionRequestDate`, `connectedAt`, `lastReplyDetectedDate`, `linkedinUrl`.
- It counts, for the selected Monday–Sunday week: requests sent (request date in the week), accepted (connected date in the week), answered (reply date in the week).
- Blank rows and duplicate LinkedIn URLs are ignored and reported.
- It fills **only** sent, accepted and answered. Positive, negative, hot leads, meetings and notes stay manual.
- In the main page it saves automatically after about 0.8 seconds. In the "edit week" window you must press Save.

**Save Draft and Submit Week** both: save everything pending, write the week, recalculate campaign totals, check for new high scores, and recalculate the client's health score. Submit additionally shows the "Health Score: N (±change)" and "Week submitted successfully!" messages. A gold **New high score!** pop-up (8 seconds, once per metric per client per week) appears when a record is broken.

**Auto-save details**

- About 1.5 seconds after you stop typing (campaigns 2 seconds; the grouped Existing/InMail fields 0.6 seconds).
- Saves only the fields you changed, merged into the stored week, so two people editing different fields don't overwrite each other.
- If a save fails you see "Save failed" with a Retry button; your typed values stay on screen.
- Closing the tab flushes what it can.

### TJ Personal Brand entry — `/tj-personal-brand` (and embedded)

Tabs: **Instagram, YouTube, Newsletter, Video Pipeline.** A "Managed by" strip shows the channel owner (set in Settings → TJ Channels). Each number has a card with a gold trophy showing the record and when it was set. **Total Posts (TJI04) is automatic: carousels + reels. Stories are not counted.** Auto-saves every 1.5 seconds, only the channel you edited. Custom metrics added in Settings appear on the matching tab.

### MM Company Content entry — `/mm-content` (and embedded)

Tabs: **LinkedIn, Instagram, Website** (with an SEO sub-section), **Other Channels** (Quora, Reddit, Medium), **Ads** (Google and Meta), **Video Pipeline.** Cards show number, percentage or Pass/Fail inputs, an optional target, a note and the record trophy. Average Impressions per Post (MML12) is automatic. The Ads tab shows a subset of the ads metrics. A "Managed by" strip shows the channel owner.

### Sales & Outreach entry — `/sales` (and embedded)

Four tabs:

1. **Weekly Data Entry:** accordion sections for TJ Outreach, Jahnvi (JJ) Outreach, Shirin Outreach, Cold Email (Waalaxy), Cold Emailing, **Enwil Meetings, Tejas Meetings, Meeting Tracker (Company Total)**. Each field shows its ID (for example "SO02 – Conn Requests Sent"). Rates and totals are read-only and calculated.
2. **Hot Leads:** a small CRM table (lead, company, source, status, probability, deal value, weighted value). Add, edit by clicking a row, delete with the bin icon. Sources: LinkedIn, Cold Email, Referral, Exhibition, Other. Statuses: New, Contacted, Meeting Booked, Proposal Sent, Negotiation, Won, Lost. The owner defaults to you.
3. **Dashboard:** month-to-date cards (meetings, hot leads, conversions, conversion rate, revenue) and two charts over the last 8 weeks. "Month to date" here means the real current month, and it ignores the Enwil and Tejas blocks.
4. **Meeting Tracker:** a read-only table of the last 8 weeks.

### Processes — `/processes` (and embedded)

Stat cards (Active, Updated this week, Awaiting update, Completed). Filters (Active/Completed, search, week, category, owner, priority). Each process card has a **Weekly update** text box with *Save update*, plus **Complete** (with confirmation) and **Delete** (admins only). Completed processes can be **Reopened**. Only admins can create processes (**New Process**). There is currently no *edit process* control.

---

## 4.3 Clients — `/clients` and `/clients/$id`

**Clients page:** tabs All / Active / Archived with counts and a search box. Clients are grouped External / Internal. Each card shows name, company, status and the latest **Health Score** (green 75+, amber 50–74, red under 50, with the change from last week).

Admins also get **Add Client**, **Edit** and **Archive / Restore**. The form: name (required), company, Content Manager, Lead Gen Manager, birthday, start date, starting followers, **Client Type**, active toggle. New clients get a default settings row with every metric on. Archiving only changes the status; the client disappears from active lists but history is kept.

**Client detail page** tabs: Overview, Context, Alerts History, History, Records, and Settings (admins only).

- **Context:** notes about the client; pin the important ones to the top. They also show in Data Entry.
- **Alerts History:** every alert with its status.
- **History:** every week with Content and Lead Gen Submitted or Pending.
- **Records:** that client's high scores.
- **Settings:** switches for which metrics are active (same as Settings → Metric Fields).

---

## 4.4 Actionables — `/actionables`

The task board.

- **My Tasks / Team Tasks** toggle (remembered), **Board / List** toggle (remembered).
- Summary cards: Open, In progress, Overdue, Completed.
- Filters: search, client, assignee (team view), status.
- **Board:** four drag-and-drop columns: Open, In Progress, Done, Carried Forward. Dropping into Open resets the task's week to the current week. An open task from an earlier week counts as carried forward.
- **Task fields:** title and internal coordinator (required), context, client (default *Internal*), related campaign, responsibility (Myntmore or Client), **Show in client portal**, due date, status.
- A task that is shown in the portal **and** assigned to the client can be updated by the client (status plus a comment).
- Deleting is permanent (after a confirmation).

## 4.5 Monthly Targets — `/monthly-targets`

Pick a month (last 12) and a client. For every metric that has a target you see a progress bar with a **pace marker**, "MTD / target", the percentage and a status badge:

| Badge | Meaning |
|---|---|
| **Hit** | Target reached |
| **On Track** | At least on pace for the point in the month |
| **Slightly Behind** | 75%+ of the pace |
| **Behind** | Under 75% of the pace |
| **No Data** | Nothing entered (a real 0 counts as data) |

Only standard metrics with targets are listed (not custom client metrics). Expand a row for week-by-week values. It does not check the "submitted" mark.

## 4.6 Reports — `/reports`

- **Download EOM Report:** choose a client and a month → a PDF (below).
- **Filter bar:** clients (multi-select), period (Last 4W, 8W default, 12W, This Month, Last Month, Custom), category (All/Content/Lead Gen), metric picker, view (**Table / Trends / Summary**).
- **Table:** one block per client; rows are metrics; one column per week, then Total, Avg/wk, Wk Target. Cell colour = progress to target (**blue** 100%+, green 75%+, amber 50%+, red below).
- **Trends:** line charts per metric (first 12) with a dashed target line.
- **Summary:** a card per metric with total/average, best week, peak date, target and a badge (Hit, On Track, Behind, Critical).
- Reports show **standard metrics only** (no text, yes/no or slider fields, and no custom client metrics).

## 4.7 Client Leaderboard — `/client-leaderboard`

Two ranked lists for a chosen timeframe (This week, Last week, This month default, Last 4 weeks, Last 12 weeks, Custom): **Impressions** and **Acceptance Rate** (accepted ÷ requests, capped at 100%). The top three get gold badges. Clients with no data are left out. Internal clients are included.

## 4.8 High Scores — `/high-scores`

A read-only table of every client's records: Client, Metric, Best Week, Achieved, Best Month, Achieved, Previous Best. Filter by client, category and search. Three cards at the top: number of records, clients, latest record week.

## 4.9 Settings — `/settings` (admins only)

Six tabs, plus a Back to Dashboard link.

**Team**
- Table of team members: name, email, role, clients assigned, status. Client logins are hidden.
- **Make Admin / Revoke Admin** (with confirmation; you cannot revoke yourself), **Edit** name, **Reset Password** (minimum 6 characters), **Disable / Enable** (not yourself).
- **Invite Member** and **Pending Invites** (copy link, revoke).

**Clients** ("Client Portal Access")
- **Create Portal Account** (client, email, password of 8+ characters) creates the login and links it to the client.
- **Link Team Member:** gives an existing team login access to a client's portal (the person keeps their internal role).
- **Reset Password** (8+ characters) for portal-only clients.
- **Remove:** unlinks the login from the client. It does not delete the login.

**Targets**
- Sections: Client Metrics, Sales & Outreach, TJ Personal Channels, MM (company).
- Weekly/Monthly toggle and a period picker.
- *Client Metrics:* pick a client; enter a target per metric; **Save All Targets**. A cleared field saves as 0.
- Sales (only the Cold Emailing counts), TJ and MM targets are company targets, each with its own Save button.
- You do **not** need to re-enter targets each period: the dashboard uses the most recent target at or before the period viewed.

**Metric Fields**
- Pick a client. **Content** and **Lead Gen** service switches (off hides that service from Data Entry, Dashboard and team submission counts). A switch per metric. Changes save immediately and recalculate the last 12 weeks of health scores.
- **Add Custom Metric** (name, type Number / Percentage / Text note, group, targets, inline note). It is added to that client's active list automatically. **Archive** hides it but keeps the history.

**TJ Channels**
- Assign an **owner** per channel: Instagram, YouTube, Email Newsletter, Video Pipeline (TJ) and LinkedIn, Instagram, Website, Other Channels, Ads, Video Pipeline (MM).
- Add or archive **custom TJ metrics** per channel.

**Export**
- **Lifetime Export** (Excel) and **Weekly Summary** (plain text). See 4.11.

## 4.10 Client portal — `/portal`

What a client sees when they log in. Read-only. Own data only.

- **Header:** logo, client name and company, a *Campaign Tracker* badge, and Sign out (admins also get *Back to Dashboard*).
- **Controls:** Weekly/Monthly toggle and a week/month picker (12 options). The portal has its own selected week.
- **Eight tabs:**
  1. **Overview:** 7 KPI cards (Total Posts, In-Network Share, Out-of-Network Share, Total Impressions, Avg Impressions/Post, Connection Requests, Meetings Booked) with change vs the previous period, plus Content and Lead Gen highlights.
  2. **Content:** KPI cards and grouped metric cards.
  3. **Lead Gen:** KPI cards and grouped cards (campaign outreach, InMail, existing network, leads and meetings).
  4. **Campaigns:** read-only campaign tables, collapsed by default, with a *View Details* dialog (totals, ICP, messaging, weekly chart).
  5. **Action Plan:** only tasks marked "Show in client portal". *Your Actions* can be updated by the client; *Myntmore Actions* are read-only.
  6. **Trends:** four area charts over 12 weeks.
  7. **✨ Highlights:** Aha Moments and this week's notes.
  8. **Reports:** same as the admin Reports for this client (including custom metrics, and a Lifetime period).
- **Hidden from clients:** health score, high scores, context notes, alerts, internal tasks, other clients, TJ/MM/Sales/Processes, and the Qualitative and Delivery & Reporting groups.
- A safety check confirms every row returned really belongs to the signed-in client, and refuses to display anything otherwise.
- Unsubmitted weeks read as blank. The page says "Data refreshes weekly".

## 4.11 Exports and the end-of-month report

**Lifetime Export** (Excel, `.xlsx`): choose From (optional), Up To (default today) and a client. Sheets:

| Sheet | Contents |
|---|---|
| Summary | When generated, range, filter, row counts |
| Client Weekly Data | One row per client per week: submitted flags, every content and lead-gen metric (columns prefixed `[C]` and `[L]`), calculated totals and rates, health score and change |
| Health Scores | Including on-track and posts-on-target streaks |
| TJ Brand | Instagram, YouTube, Newsletter, Video, plus TJ custom metrics |
| MM Content | LinkedIn, Instagram, Web, SEO, Quora, Reddit, Medium, Video |
| Sales & Outreach | All SO, SE and ST fields, labelled |
| Targets | Every target row |
| High Scores | Records with previous best and week |

Choosing a single client skips the TJ, MM and Sales sheets. Known gaps: client custom metrics are not in the client sheet, and MM Ads columns are not exported.

**Weekly Summary** (text): pick a week → a preview you can **Copy**. It lists, per client, health score and change, meetings, positive replies and posts; TJ followers/subscribers; sales headline numbers; active alerts; new records that week; open actionables. The "PDF" button simply uses the browser's print.

**End-of-Month (EOM) PDF** (from Reports → *Download EOM Report*): an A4 client-facing PDF, `<Client>-EOM-<YYYY-MM>.pdf`. It fails with a message if the client has no submitted data for the month. Pages:

1. **Executive summary:** four KPI cards (posts and impressions, new followers and audience, positive replies and rate, meetings and leads) and Content / Outreach / Highlights boxes.
2. **Content performance:** three-month bar charts (impressions, engagement, profile viewers, new followers) and publishing output.
3. **Lead generation:** funnel (requests → accepted → answered → positive → meetings) with rates.
4. **Custom metrics** (only if the client has any; up to 12).
5. **Campaign performance** for campaigns with activity.
6. **Strategy going ahead:** taken from the latest week's What's Working / Not Working notes.

---

# Part 5 — Metric reference

Every number the dashboard tracks has an **ID**. The ID prefix tells you where it belongs:

| Prefix | Belongs to | Stored in |
|---|---|---|
| `C##` | Client **content** metric | `weekly_data.content_metrics` |
| `L##` | Client **lead gen** metric | `weekly_data.leadgen_metrics` |
| `X##` | A client's **custom** metric | same columns as C/L, plus the `custom_metrics` table |
| `TJI`, `TJY`, `TJP`, `TJV` | **TJ** Instagram, YouTube, Newsletter (email), Video | `tj_weekly_data` |
| `Y##` | A **TJ custom** metric | `tj_weekly_data` + `tj_custom_metrics` |
| `MML`, `MMI`, `MMW`, `MMS`, `MMO`, `MMA`, `MMV` | **MM** LinkedIn, Instagram, Website, SEO, Other, Ads, Video | `mm_weekly_data` |
| `SO##` | **Sales** outreach, cold email, company meeting tracker | `sales_weekly_data` |
| `SE##` | **Enwil** meetings by type | `sales_weekly_data.enwil_meetings` |
| `ST##` | **Tejas** meetings by type | `sales_weekly_data.tejas_meetings` |

Some IDs are skipped on purpose and never reused: C02, C29, C30, L07, L09, L23.

Metric **types**: *number*, *percentage*, *auto* (calculated, never typed), *textarea* (free text), *boolean* (yes/no), *slider* (0–10).

## 5.1 Client content metrics (41)

| Group | ID | Name | Type | Has target? |
|---|---|---|---|---|
| **Production Pipeline** (the internal workflow: ideas → drafts → approval) | C01 | LinkedIn Post Ideation | number | yes |
| | C03 | LinkedIn Post Drafting | number | yes |
| | C04 | Posts Approved by Client | number | yes |
| | C05 | What Content Went Out | text | no |
| **Post Output** (what was actually published) | C06 | Text + Image Posts Posted | number | yes |
| | C07 | Carousels Posted | number | yes |
| | C08 | Videos Posted | number | yes |
| | C09 | Total Posts Posted | **auto** = C06 + C07 + C08 | yes |
| | C27 | Video Views | number | no |
| | C28 | Newsletters Drafted | number | yes |
| **Performance** (results for the LinkedIn profile) | C10 | Total Impressions | number | yes |
| | C36 | In-Network Share | % | no |
| | C37 | Out-of-Network Share | % | no |
| | C26 | Avg Impressions Per Post | **auto** = C10 ÷ C09 | no |
| | C11 | Likes | number | no |
| | C12 | Comments | number | no |
| | C13 | Engagement Total | number (typed) | yes |
| | C14 | Profile Viewers | number | no |
| | C15 | New Followers | number | yes |
| | C16 | Total Follower Count | number, **running total** | no |
| **Engagement Activity** (the team's own outbound engagement) | C17 | Engagement on Other Profiles | number | yes |
| | C18 | Comment Replies Done | yes/no (has a note) | no |
| **Delivery & Reporting** (monthly or quarterly service checks; only shown in the last week of the month) | C19 | Client Meeting Held | yes/no | no |
| | C20 | EOM Report Sent | yes/no | no |
| | C21 | Monthly Podcast Delivered | yes/no | no |
| | C22 | Quarterly Client Feedback | yes/no | no |
| | C23 | Aha Moments / Update Shared | yes/no | no |
| **Email Newsletter** (for clients who send an email newsletter) | C32 | Newsletter Subscribers | number, **running total** | yes |
| | C33 | Newsletter Sent | number | yes |
| | C34 | Newsletter Open Rate | % | yes |
| | C35 | Newsletter Click Rate | % | no |
| | C38 | Newsletter Delivery Rate | % | no |
| | C39 | Newsletter CTOR (click-to-open rate) | % | no |
| | C40 | Newsletter Unsubscribed | number (a **count**, lower is better) | no |
| **LinkedIn Newsletter** (LinkedIn's own native newsletter) | C41 | LinkedIn Newsletter Subscribers | number, **running total** | yes |
| | C42 | LinkedIn Newsletter Issues Published | number | yes |
| | C43 | LinkedIn Newsletter Views | number | no |
| | C44 | LinkedIn Newsletter Open Rate | % | no |
| **Qualitative** | C24 | What's Working (Content) | text | no |
| | C25 | What's Not Working (Content) | text | no |
| | C31 | Happiness Index | slider (0–10) | no |

## 5.2 Client lead-gen metrics (28)

| Group | ID | Name | Type / formula | Has target? |
|---|---|---|---|---|
| **InMail Outreach** (paid InMail messages to cold prospects) | L01 | InMail ICP Targeted | text | no |
| | L02 | InMails Sent | number | yes |
| | L03 | InMails Accepted | number | no |
| | L04 | InMails Declined | number (lower is better) | no |
| | L05 | InMail Acceptance Rate | **auto** = L03 ÷ L02 | no |
| | L06 | InMail Hot Leads | number | no |
| **Connection Request Outreach** (the main cold-outreach funnel) | L08 | Message Narrative / Strategy | text | no |
| | L10 | Connection Requests Sent | number | yes |
| | L11 | Accepted Invitations | number | no |
| | L12 | Acceptance Rate | **auto** = L11 ÷ L10 | yes |
| | L13 | Answered Messages | number | no |
| | L14 | Response Rate | **auto** = L13 ÷ **L11** | yes |
| | L15 | Positive Replies | number | no |
| | L16 | Negative Replies | number (lower is better) | no |
| | L17 | Positive Response Rate | **auto** = L15 ÷ L13 | no |
| | L18 | Negative Response Rate | **auto** = L16 ÷ L13 (lower is better) | no |
| **Existing Connections** (warm outreach to people the client already knows) | L19 | Existing Connections Msgs Sent | number | yes |
| | L20 | Existing Connections Answered | number | no |
| | L21 | Existing Connections Rate | **auto** = L20 ÷ L19 | yes |
| | L22 | Existing Connections Hot Leads | number | no |
| | (notes) | Existing Connections Notes | text | no |
| **Pipeline & Conversion** | L24 | Meetings Booked | number | yes |
| | L25 | Meetings Attended | number | no |
| | L26 | Meeting Show Up Rate | **auto** = L25 ÷ L24 | no |
| | L27 | Leads Generated | number | yes |
| **Qualitative** | L28 | What's Working (Lead Gen) | text | no |
| | L29 | What's Not Working / Blockers | text | no |
| | L30 | Happiness Index | slider (0–10) | no |

**How the funnel chains:** Acceptance Rate = Accepted ÷ Sent. Response Rate = Answered ÷ **Accepted** (not ÷ Sent). Positive and Negative Rate = Positive (or Negative) ÷ **Answered**.

## 5.3 TJ — Tejas Jhaveri's personal brand

Stored once per week (not per client) in `tj_weekly_data`, one column per channel.

**Instagram (13)** — column `instagram`

| ID | Name | | ID | Name |
|---|---|---|---|---|
| TJI01 | Stories Posted | | TJI08 | Shares |
| TJI02 | Carousels Posted | | TJI09 | Saves |
| TJI03 | Reels Posted | | TJI10 | Followers Gained |
| TJI04 | Total Posts (**auto** = TJI02 + TJI03; **stories not counted**) | | TJI11 | Total Follower Count (running total) |
| TJI05 | Impressions | | TJI12 | Trial Reel Count |
| TJI06 | Likes | | TJI13 | Trial Reel Views |
| TJI07 | Comments | | | |

**YouTube (8)** — column `youtube`: TJY01 Shorts Uploaded · TJY02 Views · TJY03 Impressions · TJY04 Likes · TJY05 Comments · TJY06 New Subscribers · TJY07 Total Subscribers (running total) · TJY08 Watch Time (hrs).

**Newsletter (6)** — column `email_newsletter` (the code calls this catalogue "TJ_PODCAST_METRICS"; the data is the email newsletter): TJP08 Emails Sent · TJP09 Delivery Rate % · TJP10 Open Rate % · TJP11 Click Rate % · TJP12 CTOR % · TJP13 **Unsubscribed** (a count, lower is better).

**Video Pipeline (3)** — column `video_pipeline`: TJV01 Videos Shot · TJV02 Videos Edited · TJV03 Videos Scheduled.

**Custom TJ metrics** use IDs `Y##` and live in the `tj_custom_metrics` table, attached to one of the four channels.

## 5.4 MM — Myntmore's own company content

Stored once per week in `mm_weekly_data`, one column per channel. MM weekly targets can be typed inline on the entry page, and company targets can also be set in Settings → Targets.

**LinkedIn (11)** — `linkedin`: MML01 Posts Published · MML02 Total Impressions · MML12 Avg Impressions Per Post (auto) · MML03 Reactions · MML04 Comments · MML05 New Followers · MML06 Total Followers (running total) · MML07 Page Views · MML08 LinkedIn Articles Published · MML09 LinkedIn Article Impressions · MML13 Invite to Follow.
(MML10 and MML11, the old in-network and out-of-network impression counts, are retired but kept for old data. If a week has either, its total impressions is their sum; otherwise MML02 is used.)

**Instagram (8)** — `instagram`: MMI02 Stories · MMI03 Reels · MMI04 Impressions · MMI05 Reach · MMI06 Engagement · MMI07 New Followers · MMI08 Total Followers (running total) · MMI09 ORM Replies.

**Website (6)** — `website`: MMW01 Active Users · MMW02 New Users · MMW03 Avg Session Duration (seconds, averaged) · MMW04 Bounce Rate % (lower is better) · MMW05 Blogs Published · MMW06 Blog Traffic.

**SEO (11)** — also stored in the `website` column but shown as its own section: MMS01 Organic Leads · MMS02 Non-Brand Clicks · MMS03 Non-Brand Impressions · MMS04 Queries Ranking in Top 10 (running total) · MMS05 City Pages on Page 1 (running total) · MMS06 Indexed Pages (running total) · MMS07 Submitted Pages (running total) · MMS08 Site Health Check (pass/fail, with a note) · MMS09 Schema Coverage % · MMS10 AI Referral Sessions · MMS11 AI Citation Rate (running total).

**Other channels (3)** — `quora`, `reddit`: MMO01 Quora Engagement · MMO05 Reddit Engagement · MMO06 Medium Blogs Published.

**Ads (8)** — `ads`: MMA01 Google Ads Clicks · MMA03 Google Ads CTR % · MMA04 Google Ads Cost ₹ (lower is better) · MMA09 Google Ads Cost per Lead ₹ (averaged, lower is better) · MMA11 Google Ads Website Visits · MMA06 Meta Ads Cost ₹ (lower is better) · MMA10 Meta Ads Cost per Lead ₹ (averaged, lower is better) · MMA12 Meta Ads Lead Form Filled.

**Video Pipeline (3)** — `video_pipeline`: MMV01 Videos Shot · MMV02 Videos Edited · MMV03 Videos Scheduled.

## 5.5 Sales & Outreach

Stored once per week in `sales_weekly_data`, one column per section. Values are saved as typed (flat), not wrapped in `{value}` objects.

| Section (column) | Metrics |
|---|---|
| **TJ Outreach** (`tj_outreach`) | SO01 ICP Targeted (text) · SO02 Conn Requests Sent · SO03 Accepted · SO04 Acceptance Rate % · SO05 Answered · SO06 Response Rate % · SO07 Hot Leads · SO08 Negative Replies · SO09 Meetings Booked |
| **Jahnvi Outreach** (`jahnvi_outreach`) | SO10 ICP (text) · SO11 Conn Requests Sent · SO12 Accepted · SO13 Acceptance Rate % · SO14 Answered · SO15 Response Rate % · SO16 Hot Leads · SO17 Negative Replies |
| **Shirin Outreach** (`shirin_outreach`) | SO18 InMail ICP (text) · SO19 InMails Sent · SO20 InMails Accepted · SO21 InMail Acceptance Rate % · SO22 LinkedIn Conn Requests Sent · SO23 LinkedIn Accepted · SO24 LinkedIn Acceptance Rate % · SO25 Answered · SO26 Response Rate % · SO27 Hot Leads · SO28 Negative Replies |
| **Cold Email — Waalaxy** (`cold_email`) | SO29 Emails Sent · SO30 Emails Opened · SO31 Open Rate % · SO32 Replies Received · SO33 Positive Replies (Hot Leads) · SO34 Negative Replies · SO35 Response Rate % |
| **Cold Emailing** (also `cold_email`) | SO50 Emails Sent (Week) · SO51 Replies · SO52 Reply Rate % · SO53 Positive Replies · SO54 Positive Reply Rate % · SO55 Replied with OOO — these four counts (SO50, 51, 53, 55) can have targets |
| **Enwil Meetings** (`enwil_meetings`) | SE01 Booked via LinkedIn · SE02 via Cold Email · SE03 via Referral · SE04 via Other · SE05 via Website \| AI · SE06 Total (auto) |
| **Tejas Meetings** (`tejas_meetings`) | ST01–ST05 (same five sources) · ST06 Total (auto) |
| **Meeting Tracker (Company Total)** (`meeting_tracker`) | SO36 via LinkedIn · SO37 via Cold Email · SO38 via Referral · SO39 via Other · SO56 via Website \| AI · SO40 Total Booked (auto) · SO41 Completed · SO42 No-Show / Rescheduled · SO43 Completion Rate % (auto) · SO44 Proposals Sent · SO45 Follow-ups Sent · SO46 Conversions (New Clients) · SO47 Conversion Rate % (auto) · SO48 Average Deal Size ₹ · SO49 Total Revenue Closed ₹ (auto = SO46 × SO48) |

The meeting "types" are the five sources: **LinkedIn, Cold Email, Referral, Other, Website | AI.**

## 5.6 Which metrics does a client get?

- Each client has a **service flag** for Content and for Lead Gen. Turning one off hides that whole side everywhere (Data Entry, Dashboard, submission counts, health score). It never deletes data.
- Each client also has an **active-metrics list** per side. *No list* means "every standard metric". A list means "only these". New metrics added to the catalogue later do not appear for a client with a list unless they are added to it (Settings → Metric Fields).
- If Total Impressions (C10) is active, C26, C36 and C37 are shown too.
- **Custom metrics** (`X##`) are per client: number, percentage or text. They are never "auto". Archiving hides one but keeps its history.

---

# Part 6 — How the numbers are calculated

## 6.1 Blank, zero and "submitted"

- Values are stored as `{ value, target, note }` (older rows may hold a bare number).
- **Blank** (`-`) ≠ **zero** (`0`). Blank weeks do not count in totals or averages. Zero weeks do.
- A week whose Content (or Lead Gen) section has **no submitted mark** reads as blank for **every** metric of that section, on the dashboard, reports and portal. Because every save stamps the mark, this only affects weeks that were never saved.

## 6.2 Rates

All client rates use one rule (`calcRateCapped`):

- If the numerator or denominator is missing, the denominator is 0, or either number is negative → **blank**.
- If the result is **over 100%** → **blank** (treated as bad data, for example 5 accepted out of 4 sent), **not** capped to 100.
- Otherwise it is rounded to **1 decimal**.

Rates (weekly): L05 = L03÷L02 · L12 = L11÷L10 · L14 = L13÷L11 · L17 = L15÷L13 · L18 = L16÷L13 · L21 = L20÷L19 · L26 = L25÷L24.
Other calculated values: **C09** = C06 + C07 + C08 · **C26** = C10 ÷ C09 (2 decimals; blank if no posts).

**Sales rates behave differently:** they are not capped, and a zero denominator shows **0** (not blank).

**LinkedIn impressions** (client): use C10 if present; otherwise, for old data that stored the in/out-of-network split as counts, add C36 + C37 (only if either is above 100). In-network and out-of-network are shares of total impressions: never add the percentages together to get total impressions.

## 6.3 Rolling weeks up into a month

| Kind of metric | Month value |
|---|---|
| Normal counts | **Sum** of the weeks |
| **Running totals** (followers, subscribers, indexed pages…) | The **latest** week's reading, never the sum |
| Percentage-type metrics (typed in) | **Average** of the weeks |
| Averaged numbers (MMA09, MMA10, MMW03) | **Average** |
| Client **rates** (L05, L12, L14, L17, L18, L21, L26) | **Recomputed** from the month's summed numerators and denominators (a volume-weighted rate), not an average of weekly rates |
| C09, C26 | Recomputed from the month's totals |
| Sales rates and totals | Recomputed from summed raw fields; Average Deal Size = revenue ÷ conversions |
| MM LinkedIn average per post (MML12) | Month impressions ÷ month posts |

**Running-total IDs:** C16, C32, C41 · TJI11, TJY07 · MML06, MMI08 · MMS04, MMS05, MMS06, MMS07, MMS11.
**Lower-is-better IDs:** L04, L16, L18, C40 · TJP13 · MMA04, MMA06, MMA09, MMA10, MMW04 · SO08, SO17, SO28, SO34, SO42.

Which weeks belong to a month: a week belongs to the month that contains its **Monday**. "Month to date" on the dashboard adds only the **submitted** weeks up to and including the selected week.

## 6.4 Targets and achievement %

- Targets live in the `targets` table: one row per client, metric and period. Weekly periods are the Monday date; monthly periods are `YYYY-MM`. Rows with no client are **company targets** for TJ, MM and Sales.
- **You don't have to re-enter targets.** The dashboard looks for an exact match, and otherwise uses the **most recently set target**. (Reading a missing target as 0 would break every percentage and the health score.)
- **Achievement %** = actual ÷ target × 100, rounded. Shown only when a target exists, is not zero, and there is an actual value.
- Colours: see the key in Part 4.1 (dashboard), and note the different bands on Reports/portal and Settings → Targets.
- In Monthly View the weekly-target column is blank for company areas, because the number shown is a month-to-date total.

## 6.5 High scores (records)

**Client records** are stored in the `high_scores` table: best week (`lifetime_high` + week), best month, and the previous best.

- Every number, percentage and slider metric is tracked (including the rates and C09/C26 and custom number/percentage metrics). Yes/no and text fields are not.
- **Zero is never a record.**
- A new record must be **strictly higher** than the stored one.
- Records are checked after every client save, and a **backfill** re-scans all history for every client each time the dashboard loads.
- **Records are never lowered.** Some were imported from the CEO scorecard spreadsheet (Part 7), so the stored record can be higher than anything in the weekly data. The trade-off: a record created by a week that was later edited down does not correct itself.
- **Best month:** running totals use the highest reading in the month; counts are summed; percentages and sliders are averaged; rates are recomputed from monthly sums. The **current in-progress month is skipped** for rates and averages, so one good early week cannot claim "best month".
- **Lower-is-better metrics** keep records but never show ★ and never trigger the pop-up.
- **★ on the dashboard:** the current week's value equals the record and the record's week is the displayed week (weekly view only).

**TJ, MM and Sales records** are **not stored**. They are worked out on the fly by scanning every saved week (best week = highest single week above 0; best month as above, excluding the current month).

## 6.6 Health score

A 0–100 score per client per week, stored in `client_health_scores`.

| Component | Metric | Weight | How it scores |
|---|---|---|---|
| Acceptance rate | L12 | 20 | The rate itself, capped at 100 |
| Positive replies | L15 | 25 | Actual ÷ weekly target, capped at 100 |
| Meetings booked | L24 | 20 | Actual ÷ weekly target, capped at 100 |
| Posts published | C09 | 15 | Actual ÷ weekly target, capped at 100 |
| Impressions | C10 | 10 | Actual ÷ weekly target, capped at 100 |
| Happiness | L30 | 10 | Score ÷ 10 |

- Score = weighted average over the components that are **enabled** for that client. If a service or metric is turned off, its weight is removed and the rest are re-scaled, not counted as zero.
- A metric with no target scores 0 for that component.
- **When it updates:** on every client save, and (for the latest 12 weeks) when an admin changes a client's active metrics or services. Not on dashboard load.
- **Streaks:** *On-track streak* = consecutive weeks (looking back up to 12) with score 70 or more. *Posts streak* = consecutive weeks where posts met the weekly target (which must be above 0).
- **Where it is shown:** the Clients page (green 75+, amber 50–74, red below), the Submit Week message, and exports. **The main dashboard does not show it.**

## 6.7 Happiness alerts

Created when a client's Happiness Index (L30) is saved (lead-gen enabled only), using the last three weeks that have a value (at least two needed):

- **High severity — "consecutive low happiness":** this week and last week are both **below 6**. Recommends a check-in call.
- **Medium severity — "happiness drop":** a drop of **3 or more points** in one week.

Alerts show on the dashboard's Active Alerts card, the bell, and the client's Alerts History. The dashboard's Happiness circle uses its own colours (7+ green, 4–6.9 amber, below 4 red), independent of the alert rules.

## 6.8 Weeks, months and time zones

- A **week** is **Monday to Sunday**, identified by its Monday (`week_start`), formatted `YYYY-MM-DD`.
- The reporting week defaults to the **last completed week**.
- "Today" for overdue and milestone logic is in **IST** (Asia/Kolkata).
- The **last week of the month** is the week whose next Monday falls in a different month (this is when the Delivery & Reporting group appears).
- A technical footnote: the week picker computes the Monday using the **browser's** time zone. For a team in India that equals IST; a viewer in another time zone could see a different week boundary.

---

# Part 7 — The database

The database is **Supabase (Postgres)**, schema **`myntmore`**. (The Supabase project also holds another internal tool, so every dashboard SQL statement must name `myntmore` explicitly.)

> The code has no access to the live database. The tables below are what the code and the SQL files describe. Compare with the live project before relying on a detail such as a specific security policy.

## 7.1 Tables

### People and access

| Table | What it holds |
|---|---|
| `profiles` | One row per login (team or client): name, email, `department` (`client` marks portal logins), `disabled` |
| `user_roles` | `admin` or `member` per login |
| `invites` | Pending and accepted team invites (email, token, status) |
| `client_assignments` | Which team member manages which client (`contentManager` or `leadGenManager`) |
| `tj_channel_assignments` | Who owns each TJ channel and each MM channel (`mm_linkedin`, `mm_instagram`, `mm_website`, `mm_other`, `mm_ads`, `mm_video`) |

### Clients

| Table | What it holds |
|---|---|
| `clients` | Name, company, status, managers, birthday, start date, starting followers, `client_type` (`internal` / `external`), `user_id` (the portal login) |
| `client_settings` | One row per client: service flags `content_enabled` / `leadgen_enabled`, and `active_content_metrics` / `active_leadgen_metrics` lists (null = all) |
| `client_context_notes` | Notes about a client, optionally pinned |
| `client_health_scores` | Health score per client per week with breakdown and streaks |
| `client_alerts` | Alerts (type, message, severity, resolved or not) |
| `client_notifications` | Birthday and anniversary notifications and whether they were dismissed |
| `aha_moments` | Wins posted for a client (title, description, emoji) |
| `actionables` | Tasks (assignee, client, due date, status, `client_visible`, `responsibility`, `campaign_id`, client comment) |
| `custom_metrics` | Per-client extra metric definitions (`X##`) |

### Weekly data

| Table | One row per | Key columns |
|---|---|---|
| `weekly_data` | client + week | `content_metrics`, `leadgen_metrics` (JSON maps `{ID: {value,target,note}}`), `content_submitted_at`, `leadgen_submitted_at` (+ who) |
| `campaigns` | client's campaign | name, ICP, message narrative, objective, status, start date |
| `campaign_weekly_data` | campaign + week | requests sent, accepted, answered, positive, negative, hot leads, meetings, existing-connection sent/replied, notes |
| `tj_weekly_data` | week | JSON per channel: `instagram`, `youtube`, `email_newsletter`, `video_pipeline` (and older `linkedin_newsletter`, `podcast`) |
| `mm_weekly_data` | week | JSON per channel: `linkedin`, `instagram`, `website`, `quora`, `reddit`, `ads`, `video_pipeline` |
| `sales_weekly_data` | week | JSON per section: `tj_outreach`, `jahnvi_outreach`, `shirin_outreach`, `cold_email`, `enwil_meetings`, `tejas_meetings`, `meeting_tracker` |

All weekly tables also hold `week_start` (Monday), `week_end`, `week_label`.

### Targets, records, company

| Table | What it holds |
|---|---|
| `targets` | `client_id` (empty = company), `metric_id`, `target_type` (weekly/monthly), `period`, `target_value`. Unique on those four. Company targets are saved by delete-then-insert because empty client IDs defeat the unique rule. |
| `high_scores` | Per client + metric: best week, week achieved, best month, month achieved, previous best |
| `hot_leads` | Sales pipeline entries |
| `myntmore_processes`, `process_weekly_updates` | Processes and their weekly updates |
| `tj_custom_metrics` | TJ custom metric definitions (`Y##`) |
| `initiatives`, `growth_initiatives`, `growth_initiative_comments`, `finance_data`, `expenses` | Exist in the database but **nothing in the app reads or writes them** (Finance is a placeholder) |

Backup tables from one-off fixes: `backup_mm_weekly_before_redate`, `backup_tj_weekly_before_redate`, `backup_weekly_data_tejas_before_sheet`. They can be dropped once everything is verified.

**Important unique keys:** `weekly_data` (client, week) · `client_health_scores` (client, week) · `client_alerts` (client, type, week) · `campaign_weekly_data` (campaign, week) · `tj_/mm_/sales_weekly_data` (week) · `high_scores` (client, metric) · `custom_metrics` (client, key).

## 7.2 How data gets in

- **Plain upsert pages (TJ, MM, Sales):** each edit saves only the section you changed, using the week as the key.
- **Client Data Entry:** a safer "patch" save: it reads the current week, merges only the fields you edited, and writes back only if nobody else changed it in the meantime (it retries up to 4 times, then says another teammate edited the same week).
- **Campaign roll-up:** see Part 4.2. Totals for six fields are written into the client's lead-gen data.
- **Known quirk:** if you delete the last campaign data for a week, the roll-up does not zero the old totals.

## 7.3 One thousand rows

The database returns at most **1,000 rows per request** and silently drops the rest. The app uses a paging helper (`pagedSelect`, and similar loops in the export and high-score code) for tables that can grow past that: targets, high scores and large exports. A paged query must have a stable sort order.

## 7.4 The SQL files in `supabase/`

Run SQL in the **Supabase SQL editor**. Almost all files are safe to re-run; the ones that overwrite data take a backup table first. Treat the folder as history: do not rewrite old files.

**Schema and feature migrations**

| File | What it does |
|---|---|
| `add_client_service_flags.sql` | Adds the Content/Lead Gen on-off flags to client settings |
| `add_client_type.sql` | Adds internal/external client type; marks Enwil and Tejas internal |
| `add_custom_metrics.sql` | Creates the per-client custom metrics table |
| `add_tj_custom_metrics.sql` | Creates the TJ custom metrics table |
| `add_enwil_tejas_meetings.sql` | Adds the Enwil and Tejas meeting columns to the sales table |
| `add_mm_ads_column.sql` | Adds the MM Ads column |
| `add_mm_video_pipeline.sql` | Adds the MM Video Pipeline column |
| `add_monthly_high_scores.sql` | Adds best-month columns to high scores |
| `aha_moments.sql` | Creates Aha Moments |
| `client_portal_campaign_action_plan.sql` | Adds portal-visible actionables and the client update function |
| `campaign_client_integrity.sql`, `client_data_isolation.sql` | Make sure a campaign's weekly rows always belong to the same client |

**Security**

| File | What it does |
|---|---|
| `client_portal_rls.sql`, `internal_member_access.sql` | The first security rounds (older) |
| `secure_dashboard_rls.sql` | The comprehensive security rebuild: drops all policies, rebuilds them (see Part 8) |
| `restrict_clients_targets_tj_metrics_write_to_admin.sql` | Clients, targets, TJ metrics and channel assignments: everyone reads, only admins write |
| `restrict_processes_write_to_admin.sql` | Only admins create or delete processes |
| `restrict_client_user_id_to_admin.sql` | Only admins can link a login to a client |
| `custom_metrics_internal_read.sql` | Lets non-admin team members read custom metrics |
| `separate_client_profiles.sql` | Marks portal logins as department `client` |

**Data fixes, backfills and imports** (one-time unless noted)

| File | What it does |
|---|---|
| `backfill_submitted_at.sql` | Stamps "submitted" on old weeks that had data but no stamp |
| `backfill_sales_derived_fields.sql` | Writes the calculated rates and totals into old sales rows |
| `recalc_tj_total_posts_without_stories.sql` | Recomputes TJ Total Posts as carousels + reels |
| `enable_newsletter_metrics_for_amey.sql` | Adds newsletter metrics to one client's list |
| `import_highscores_from_ceo_scorecard.sql`, `import_tejas_highscores_from_ceo_scorecard.sql` | Raise records to match the CEO scorecard (can never lower; re-runnable) |
| `backfill_company_sections_from_ceo_scorecard.sql`, `backfill_tj_newsletter_and_mm_weeks_from_ceo_scorecard.sql`, `backfill_tejas_linkedin_newsletter_from_ceo_scorecard.sql` | Fill missing history from the scorecard (fill-only; re-runnable) |
| `apply_tejas_weeks_from_ceo_scorecard.sql` | Overwrites Tejas's weekly values from the sheet (backs up first; run once) |
| `redate_company_weeks_to_ceo_scorecard.sql`, `restore_mml07_and_clear_mar23_leftovers.sql` | Move misdated MM/TJ weeks to the sheet's dates; the second repairs one metric after the first (backups taken) |

**Read-only comparison queries** (they change nothing): `compare_client_highs_…`, `compare_company_highs_…`, `compare_company_sections_…`, `compare_instagram_highs_…`, `compare_instagram_weeks_…`, `compare_tejas_weeks_…` (all "…with_ceo_scorecard.sql"), and `diagnose_monthly_vs_weekly.sql` (finds monthly totals pasted into several weeks).

**About the CEO scorecard.** The company's historical spreadsheet ("Myntmore Company CEO Dashboard") was compared against the app in 2026. The agreed rule: the sheet is the source of truth **through March 2026**; later or higher records in the app are kept. Placeholder or typo values in the sheet were left out.

**The edge function** `supabase/functions/create-portal-user` is described in Part 8.

---

# Part 8 — Security

## 8.1 Layers

1. **Route guards in the app** decide which pages open (Part 3).
2. **Row-Level Security (RLS) in the database** decides which rows each login can read or write. This is the real protection: even someone calling the database API directly is bound by it.
3. **A client-side double check in the portal** refuses to show any row that is not the client's own.

## 8.2 What each kind of login can do (per `secure_dashboard_rls.sql` and the later restriction files)

| Access | Tables |
|---|---|
| **Admin and members: read and write** | actionables, aha_moments, campaign data, campaigns, alerts, context notes, health scores, notifications, high scores, hot leads, MM / sales / TJ / weekly data, processes and their updates, initiatives |
| **Everyone internal reads; only admins write** | clients, targets, client_settings, client_assignments, tj_custom_metrics, tj_channel_assignments, custom_metrics |
| **Processes** | Everyone internal reads and updates; only admins create or delete |
| **Admins only** | invites, finance_data, expenses |
| **Profiles** | Admin full access; internal users read all; anyone reads their own |
| **User roles** | Admin full access; anyone reads their own |
| **Client portal logins: read-only, own client only** | clients, weekly_data, targets, campaigns, campaign_weekly_data, aha_moments, high_scores, and actionables marked client-visible |
| **Never visible to clients** | MM, sales, TJ, finance, processes, invites, other people's profiles, notes, alerts, health scores |

Anonymous (not signed in) access to the tables is revoked.

The only thing a client can **write** is through one function, `client_update_actionable`: it can set status (open / in progress / done) and a comment on a task that is marked client-visible, assigned to the client, and belongs to them.

Helper functions used by the policies: `has_role`, `is_internal_user`, `is_own_client`, `is_assigned`, `is_own_campaign`. Triggers also make sure only admins change `clients.user_id`, a campaign's weekly rows keep the campaign's client, and a task's campaign belongs to the task's client.

> **Check the live database.** `secure_dashboard_rls.sql` drops *every* policy in the schema before rebuilding. It does not recreate policies for `custom_metrics` or `tj_custom_metrics`, which were handled in their own files. If it was run after those, the policies may differ from what the files describe. Compare against the real policy list in Supabase. Also: re-running an older access script afterwards can weaken newer policies.

## 8.3 The edge function `create-portal-user`

Runs on Supabase with the service-role key (never exposed to the browser). It has three actions:

| Action | Who | What it does |
|---|---|---|
| `accept_invite` | Anyone with a valid invite token | Creates the login, profile and role from a pending invite, marks it accepted; undoes everything if a step fails |
| `reset_password` | Admins | Sets a new password (6+ characters) |
| *(default)* create portal user | Admins | Creates a client login (8+ characters), sets department `client`, adds the `member` role, links it to the client |

Admins are verified server-side from the caller's session.

## 8.4 Password and secrets rules

- Never edit password hashes in SQL. Never delete and recreate a user just to change a password.
- Never put the service-role key in browser code, chat, documents or Git.
- Do not commit `.env*` files, database dumps or CSVs. The folder `myntmore-database-export/` (a dump of production data, including a file of generated passwords) is git-ignored and must never be shared.
- Password minimums: 6 for team resets, 8 for client and invite passwords.

---

# Part 9 — Tech stack, project layout and deployment

## 9.1 The stack

| Layer | What it uses |
|---|---|
| UI | **React 19**, TypeScript, **Tailwind CSS v4**, Radix UI primitives (shadcn-style components in `src/components/ui`), Lucide icons |
| Routing | **TanStack Router** (file-based routes in `src/routes`, auto code-splitting) |
| Data | **Supabase** (Postgres + Auth + edge function) via `@supabase/supabase-js`; **TanStack Query** is installed and has a provider, but no page uses it: pages fetch directly with the Supabase client |
| Forms and validation | react-hook-form, zod |
| Charts | Recharts |
| Exports | `write-excel-file` (Excel), `jspdf` (PDF), `papaparse` (CSV import) |
| Misc | `cmdk` (search palette), `sonner` (toasts), `date-fns`, `@dnd-kit` (drag-and-drop task board) |
| Build | **Vite 7**; path alias `@/` = `src/` |
| Hosting | **Vercel** (single rewrite of every path to `index.html` so deep links work) |
| Source | GitHub repository `aitoolsteejay/dashboard-myntmore`, branch `main` |

Production app: `dashboard-myntmore-five.vercel.app`. Supabase project id `gapaawxbkfmpthfesuyw`, schema `myntmore`.

There is **no automated test suite**. `npm run check` runs the TypeScript check and a production build.

## 9.2 Folder map

```
dashboard-myntmore/
├─ src/
│  ├─ routes/            One file per URL (guards live here); routeTree.gen.ts is generated — never edit it
│  ├─ components/
│  │   ├─ dashboard/     DashboardPage — the big one
│  │   ├─ data-entry/    DataEntryHub, DataEntryPage (client entry, campaigns, Waalaxy import)
│  │   ├─ clients/       ClientsPage, ClientDetailPage
│  │   ├─ tj-brand/      TJ Personal Brand entry
│  │   ├─ mm/            MM Company Content entry
│  │   ├─ sales/         Sales & Outreach (entry, hot leads, trackers)
│  │   ├─ monthly/       Monthly Targets progress
│  │   ├─ monday/        Campaign month table and edit modals (no "Monday Mode" page exists)
│  │   ├─ actionables/   Task board
│  │   ├─ processes/     Processes
│  │   ├─ finance/       Placeholder
│  │   ├─ reports/       Reports page + EOM trigger
│  │   ├─ high-scores/   High Scores page
│  │   ├─ leaderboard/   Client Leaderboard
│  │   ├─ portal/        Client portal (+ action plan, campaign details)
│  │   ├─ settings/      Settings tabs (team, clients, targets, metric fields, TJ channels, export)
│  │   ├─ auth/          Login, accept invite
│  │   └─ ui/            Shared building blocks (buttons, tables, dialogs…)
│  ├─ data/              The metric catalogues: metrics.ts, company_metrics.ts, sales_metrics.ts, metricSemantics.ts
│  ├─ utils/             Calculations and helpers (rates, targets, high scores, weeks, campaign sync, Waalaxy import, EOM report…)
│  ├─ lib/               auth, workspace (selected week), health score, export, notifications
│  ├─ hooks/             useAutoSave, useEffectiveMetrics, useEffectiveTjMetrics
│  └─ integrations/supabase/   Supabase client + (partly stale) generated types
├─ supabase/             SQL files (run by hand in the SQL editor) + the create-portal-user edge function
├─ docs/                 Documentation (this file lives here)
├─ scripts/              One-off migration helpers
├─ myntmore-database-export/   Point-in-time production data dump (git-ignored, sensitive)
└─ vercel.json, vite.config.ts, package.json
```

Where to look for what:

| I want to change… | Look in |
|---|---|
| What metrics exist | `src/data/metrics.ts` (clients), `company_metrics.ts` (TJ/MM), `sales_metrics.ts` |
| Which metrics are summed, averaged or "latest" | `src/data/metricSemantics.ts` |
| A formula or rate | `src/utils/metricCalculations.ts`, `rateAggregation.ts`, `salesRates.ts` |
| Targets lookups | `src/utils/targets.ts` |
| Records | `src/utils/highScores.ts` (clients), `lifetimeHighs.ts` + `tjHighScores.ts` / `mmHighScores.ts` / `salesHighScores.ts` |
| Health score and alerts | `src/lib/health.ts` |
| Auto-save behaviour | `src/hooks/useAutoSave.ts` |
| Week and IST logic | `src/utils/weekUtils.ts`, `dateUtils.ts`, `src/lib/workspace.tsx` |
| Page access rules | `src/utils/routeGuards.ts`, `src/lib/auth.tsx`, `src/routes/__root.tsx` |
| The dashboard layout | `src/components/dashboard/DashboardPage.tsx` |
| Exports and the EOM PDF | `src/lib/export.ts`, `src/utils/eomReport.ts` |

## 9.3 Environment and secrets

The browser app reads exactly two variables:

- `VITE_MYNTMORE_SUPABASE_URL`
- `VITE_MYNTMORE_SUPABASE_PUBLISHABLE_KEY`

Both are **public by design** (they end up in the browser bundle). `.env.production` is committed to Git and holds only these two. **Never add a secret to it.** Local overrides go in `.env.local` (git-ignored). The edge function uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY`, supplied by Supabase itself.

## 9.4 Deploying

1. Check what changed: `git status`, `git diff`.
2. Run `npm run check` (type-check + build) and `git diff --check`.
3. Commit and push to `main`. Vercel deploys automatically.
4. Wait for the Vercel deployment to be **Ready**.
5. Smoke-test: log in, open the dashboard, switch a client, view one page of data, log out.
6. For a data-entry change, save a controlled test value, verify the exact row, client and week, and restore it if it was synthetic.

**Rollback:** redeploy the last good deployment in Vercel, or revert the commit. A code rollback does **not** undo database changes.

## 9.5 Starting the app locally

```bash
npm install
npm run dev        # starts Vite, usually on http://localhost:5173
```

You need a `.env.local` with the two variables above. You also need a login that exists in the Supabase project.

---

# Part 10 — Playbooks: how do I…?

## The weekly routine (checklist)

- [ ] Pick the last completed week in the top bar.
- [ ] For **each client**: Data Entry → Content tab, Lead Gen tab, campaigns (import the Waalaxy CSV, then add positive/negative replies, hot leads, meetings, notes), Happiness Index.
- [ ] **MM**, **TJ**, **Sales** (including Enwil and Tejas meetings by type, and the company meeting tracker), **Processes**.
- [ ] Dashboard: check *Submissions complete* and *Deliverables Check*; clear or resolve alerts.
- [ ] Create actionables for anything off-track; mark client-facing ones "Show in client portal".
- [ ] **Last week of the month:** fill the *Delivery & Reporting* checkboxes, then generate each client's EOM PDF (Reports).

## Add a new client
Clients → **Add Client** (admin). Fill name, company, managers, birthday, start date, starting followers, client type, and leave Active on. Then in **Settings → Metric Fields**, turn on only the services and metrics that apply, and set targets in **Settings → Targets**.

## Give a client portal access
Settings → Clients → **Create Portal Account** (client, login email, password of 8+ characters). Send the credentials to the client through a secure channel and give them the `/portal` URL. To let a **team member** also see a client's portal, use **Link Team Member** instead.

## Reset a password
Team member: Settings → Team → **Reset Password** (6+ characters). Client: Settings → Clients → **Reset Password** (8+ characters). Never reset a password with SQL.

## Invite a team member or make them an admin
Settings → Team → **Invite Member** → send them the link. Once they have joined, use **Make Admin** if needed. To remove access, **Disable** them (do not delete).

## Switch a service or a metric off for a client
Settings → Metric Fields → pick the client → use the Content / Lead Gen switches or an individual metric switch. History is kept; the last 12 weeks' health scores are recalculated.

## Add a custom metric for one client
Settings → Metric Fields → client → **Add Custom Metric**. Choose Number, Percentage or Text note. It appears in Data Entry, the dashboard and the portal. It does **not** appear in Reports, Monthly Targets or the Excel export (Part 11).

## Add a custom TJ metric
Settings → TJ Channels → Custom Metrics → add it to a channel. It appears on the TJ page and the dashboard TJ section.

## Set targets
Settings → Targets → choose Weekly or Monthly and a period → pick a client (or the Sales, TJ or MM section) → type targets → **Save**. You only need to set a target again when it changes; later periods use the most recent one.

## Correct a wrong number
Open Data Entry for that client and week, change the value, and it auto-saves. Note: a **record** that was set by the wrong number does **not** lower itself (Part 6.5). If a record is wrong, it has to be fixed in the `high_scores` table (an SQL change, with a backup).

## Fix a week that was entered under the wrong date
Do not copy and paste by hand if there are many cells. Use a reviewed SQL script that backs up first (the `redate_…` script is the pattern to follow).

## Run SQL safely
1. Name the tables and the change you expect.
2. Back up the tables (or create a backup table).
3. Record row counts before.
4. Run in a transaction (`BEGIN … COMMIT`) when the change must be all-or-nothing.
5. Use `myntmore.` in front of every table.
6. Re-check the counts and look at the UI.
7. Keep the backup until the change has been stable for a while.

## Add a new standard metric (developer)
1. Add it to `src/data/metrics.ts` (or `company_metrics.ts` / `sales_metrics.ts`).
2. If it is calculated, add the formula and store only the source values.
3. If it is a running total, an averaged number, or lower-is-better, add it to `src/data/metricSemantics.ts`.
4. Check Data Entry, the dashboard, Reports, exports and high scores all handle it.
5. Existing clients with an active-metrics list will not see it until it is added to their list.
6. Make sure old rows without the new key still show as blank, not an error.

## Add a new page (developer)
Add the component, add a route file in `src/routes` with the right guard (`requireInternalUser` for operational pages, `requireAdmin` for admin pages), add a sidebar item if needed, and let the router regenerate `routeTree.gen.ts`. Test by typing the URL directly, not just by clicking.

## Add a new table (developer)
New idempotent SQL file in `supabase/`; enable RLS and write policies before the app uses it; give client-owned rows a `client_id`; update the types; add portal policies if clients should see it; test that Client A cannot read Client B using the API directly.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| A client shows `-` everywhere for a week | The week was never saved (no submitted mark), or you are on the wrong week, or the service is switched off |
| A metric is missing from Data Entry | It is not in that client's active-metrics list, or the service is off |
| A rate shows `-` | A needed number is blank, the denominator is 0, or the rate came out over 100% (treated as bad data) |
| No ★ on a record | The metric is lower-is-better, the value is 0, or the record belongs to a different week |
| Dashboard Hot Leads is lower than campaign hot leads | The column shows *Existing Connections* hot leads (L22), not campaign hot leads |
| "Save failed" | Check connection; press Retry; if it persists, note the exact message (it may be a security-policy or a conflict error) |
| "Another teammate updated this week at the same time" | Two people edited the same client-week; reload and re-apply your change |
| Saving in Enwil/Tejas Meetings fails | The `add_enwil_tejas_meetings.sql` migration has not been run |
| Saving in MM Video Pipeline fails | `add_mm_video_pipeline.sql` has not been run |
| A team member sees an empty Settings or gets sent to the dashboard | They are not an admin |
| Pinned row not sticking | You are in a layout where the page scroll area changed; check the browser window height and reload |

---

# Part 11 — Known quirks and open problems

This is an honest list, built from reading the code. The live app could not be signed into when it was written, so a few items are inferences.

## Fixed on 11 November 2026 (kept here so you know they existed)

1. **Client detail page did not open.** `/clients/$id` was registered as a child of `/clients`, but the Clients page has no place to show a child, so "View Details" just showed the list again. The detail route now sits directly under the app root (file `clients_.$id.tsx`). The Monthly Targets link "Set targets in Settings" had the same problem for `/settings/targets`, fixed the same way (`settings_.targets.tsx`). `/settings/team` and `/settings/export` are still nested under Settings; they just show the Settings page and nothing links to them.
2. **Month Comparison summed the Happiness Index** (a month of 8, 7, 9, 8 showed 32); it now averages it.
3. **Portal "This Week's Notes" printed `[object Object]`.** The portal read the notes (C24, C25, L28, L29) as plain text but they are stored as `{ value }` objects. It now reads the text properly, and, like every other portal figure, shows a never-saved week as blank.

## Behaviours that surprise people

3. **Save Draft = Submit.** Every save marks the week submitted; there is no approval step (Part 2).
4. **Colour bands differ by page:** dashboard 100/75/50; Reports and portal 100/75/50 but blue/green/amber/red; Settings → Targets 100/70/40; Clients health bar 75/50.
5. **Monthly View mixes meanings:** client totals cover the whole calendar month; TJ, Sales and MM are month-to-date up to the selected week.
6. **"Hot Leads" on the dashboard is Existing Connections hot leads (L22)**, not campaign hot leads. Campaign hot leads are not rolled up into the client total.
7. **Deleting a week's last campaign data does not zero** the client's old L10/L11/L13/L15/L16/L24 totals.
8. **Cleared targets save as 0**, not blank. Company targets (Sales/TJ/MM) are saved by deleting and re-inserting.
9. **Records are never lowered** (Part 6.5), so a wrong record stays until corrected in the database. The dashboard also re-scans every client's whole history on each load (slower as data grows).
10. **Sales tab "Dashboard"** uses the real current month and ignores the Enwil and Tejas blocks.
11. **The Company Total meeting tracker is typed in**, not the sum of Enwil + Tejas + others.
12. **Team Submission Status** only lists people who have assigned clients.
13. **The week picker uses the browser time zone** for the Monday calculation; "today" logic uses IST.
14. **Clients page seeds 8 sample clients** automatically if the clients table is ever empty.
15. **Search palette** is missing Reports, shows Settings to non-admins (the page then redirects them), and a "⌘E" hint has no shortcut behind it.
16. **No forgot-password link**, and the login page ignores the "redirect back" address.
17. **Help text** in Settings mentions "Monday Mode"; no such page exists (`components/monday/` holds campaign tables and modals only).

## Gaps and unfinished pieces

18. **Custom client metrics are missing** from Reports, Monthly Targets and the Excel export. They do appear in Data Entry, the dashboard, High Scores, the portal and the EOM PDF.
19. **MM Ads** columns are not in the Excel export; company targets appear in the export's Targets sheet with a blank client and the raw ID.
20. **Finance** is a placeholder. Client detail's Overview "Key Performance" card is placeholder text, and the History tab's *View* button does nothing. There is no *edit process* control.
21. Several database tables exist but nothing uses them: `initiatives`, `growth_initiatives`, `growth_initiative_comments`, `finance_data`, `expenses`.
22. `custom_targets` in client settings is read but never written.
23. **Generated types are stale** (`src/integrations/supabase/types.ts` lacks `aha_moments`, `clients.user_id` and a few columns), so some code uses loose typing.
24. Duplicate and unused code: an older metric catalogue in `src/lib/metrics.ts`, several copies of `fmt` / `readNum` helpers with small differences, and unused components (`StatusBadge`, `AutoSaveBar`).
25. Month-to-date on the client card does not recompute L05, L17, L18 and L26 (they are not shown with targets there).

## Deferred bugs from earlier checks

26. A high-score pop-up can be recorded against the wrong week if you switch weeks within about 1.5 seconds of an edit.
27. On the Lead Gen tab, leaving the page can drop unsaved edits made inside an inactive campaign.
28. The dashboard keeps showing the old week's tables briefly while a new week loads.
29. `MonthComparisonView` and `MetricTable` are defined inside the dashboard component, so they re-mount on every refresh (any state inside them resets; the freeze state was moved to the page for this reason).
30. Clearing a Data Entry field, or adding only a note, saves `0` instead of blank.
31. The internal Happiness Index could be read by a client who calls the database API directly (the portal screens hide it, but the policy allows the row).

## Live-database checks to do

32. Confirm these SQL files have been run on the live project: `add_client_type.sql`, `add_mm_video_pipeline.sql`, `add_enwil_tejas_meetings.sql` (confirmed run on 2026-11-06), `recalc_tj_total_posts_without_stories.sql`, and the Newsletter Unsubscribed conversion (old fractional rates → counts). Run `restore_mml07_and_clear_mar23_leftovers.sql` only if the first re-date script ran and the MML07 record (1,421) is not back.
33. Compare the live security policies with Part 8 (especially `custom_metrics`, `tj_custom_metrics` and portal read of client-visible actionables).
34. Drop the three `backup_…` tables once everything is verified.

---

# Part 12 — Glossary

| Term | Meaning |
|---|---|
| **ACH%** | Achievement percentage: actual ÷ target |
| **Actionable** | A task on the Actionables board |
| **Admin / Member** | The two team roles; admins can use Settings and Finance |
| **Aha Moment** | A win posted by an admin that the client sees in their portal |
| **Best Ever Week / Month** | The record for a metric (stored for clients, calculated for TJ/MM/Sales) |
| **Blank vs zero** | Blank means nothing entered (`-`); zero is a real 0 |
| **C## / L## / X##** | Client content, lead-gen and custom metric IDs |
| **Campaign** | One LinkedIn outreach campaign for a client |
| **CEO scorecard** | The historical spreadsheet ("Myntmore Company CEO Dashboard") used to check records and history |
| **Client portal** | The read-only view clients log in to |
| **Client type** | Internal (Enwil, Tejas Jhaveri) or external (everyone else) |
| **Company targets** | Targets with no client, used for TJ, MM and Sales |
| **CTOR** | Click-to-open rate (clicks ÷ opens) of an email |
| **Cumulative / running total** | A metric whose month value is the latest reading, not the sum (followers, subscribers) |
| **Draft** | A saved-but-not-submitted week. In practice every save also submits. |
| **EOM report** | End-of-month client PDF |
| **Existing Connections** | Warm outreach to people the client already knows |
| **Health score** | 0–100 client score (Part 6.6) |
| **Hot lead** | A prospect showing buying interest |
| **ICP** | Ideal Customer Profile: the audience being targeted |
| **In-network / Out-of-network** | Whether LinkedIn impressions came from the client's connections or beyond them (stored as percentage shares) |
| **InMail** | A paid LinkedIn message to someone you are not connected to |
| **IST** | Indian Standard Time, the team's time zone |
| **Lower is better** | Metrics where a smaller number is good (negative replies, cost, bounce rate, unsubscribed…) |
| **MM** | Myntmore's own company content |
| **MTD** | Month to date: the submitted weeks of the month up to the selected week |
| **ORM** | Online reputation management (replies on Instagram, MMI09) |
| **Portal user** | A client login |
| **RLS** | Row-Level Security: database rules about who can see or change which rows |
| **Service flags** | Per-client on/off for Content and for Lead Gen |
| **Sticky / Freeze** | Keeping a header or row pinned while scrolling |
| **Submitted** | A week whose Content or Lead Gen section has been saved |
| **TJ** | Tejas Jhaveri's personal brand |
| **Waalaxy** | The LinkedIn automation tool whose CSV is imported for campaigns |
| **Week** | Monday–Sunday, named by its Monday |
| **Weekly Breakdown** | A table of every week of the month for one client |
| **Workspace week** | The week selected in the top bar |

---

# Part 13 — Change log

A short history of notable changes (newest first), from the commit history.

| Date | Change |
|---|---|
| 11 Nov 2026 | Fixed the client detail page not opening (`/clients/$id`), the Monthly Targets link into Settings → Targets, the Happiness Index being summed in Month Comparison, and `[object Object]` in the portal's This Week's Notes |
| 11 Nov 2026 | Data Entry field order now matches the dashboard (Lead Gen blocks, InMail and Existing Connections fields, campaign Hot Leads before Meetings); added this Bible |
| 6 Nov 2026 | Dashboard blocks renamed **MM LinkedIn** and **MM Instagram** |
| 6 Nov 2026 | **Enwil Meetings** and **Tejas Meetings** trackers (by meeting type) added above the company-total tracker; new `enwil_meetings` / `tejas_meetings` columns |
| 5 Nov 2026 | Sticky headers fixed: the app shell now scrolls inside `<main>`; scroll resets on navigation; block headers sit under the top bar |
| 2 Nov 2026 | **Freeze / Unfreeze** a client's summary row; client name on its own line; metric columns kept right-aligned |
| 26 Oct 2026 | TJ Instagram **Total Posts** no longer counts stories; newsletter **Unsubscribed** is a count; **Video Pipeline** tab added to MM Content; reconciliation SQL against the CEO scorecard; fixes from a follow-up bug check |
| 23–26 Oct 2026 | **Internal vs external clients** (external first) |
| 22 Oct 2026 | MM Content: best-ever trophies, "Managed by" strip |
| 19 Oct 2026 | CEO-scorecard records imported (records never lowered); Tejas LinkedIn newsletter history; fixes from a three-way audit; Targets page fixes |
| 12 Oct 2026 | Weekly and monthly company targets; campaign totals and Paused filter; stale-response protection on the dashboard |
| 4–6 Oct 2026 | One seven-column table across the whole dashboard with best-ever columns; every sub-section collapsible; "Booked via Website \| AI" meeting source; audit fixes (running totals, highs, sales, health, IST) |
| 28–30 Sep 2026 | Separate Email and LinkedIn newsletters; SEO section for MM; MM in/out-network split retired; TJ section rebuilt to match clients; IST and percentage fixes |
| 25 Sep 2026 | Monthly goal-progress cards for key metrics |

---

*End of the Dashboard Bible. If you change how the dashboard works, update this file in the same commit.*
