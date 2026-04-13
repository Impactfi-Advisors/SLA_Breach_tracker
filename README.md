# SLA Breach Tracker

An AI-powered SLA compliance tool for tracking vendor outages, automatically detecting SLA breaches, calculating penalties, and generating formal chargeback letters — all in one web application.

---

## Overview

SLA Breach Tracker helps operations and vendor management teams:

- **Log outages** from vendor email notifications using AI parsing
- **Define SLA contracts** per vendor and product with uptime targets and penalty rates
- **Automatically detect breaches** when cumulative downtime exceeds the contracted uptime SLA
- **Calculate penalties** in dollars based on excess downtime hours
- **Generate AI-written chargeback letters** ready to send to vendors
- **Get AI insights** on your SLA compliance posture at a glance

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Turso (libSQL / SQLite-compatible) |
| AI | Anthropic Claude (Haiku for insights, Sonnet for parsing & reports) |
| Styling | Tailwind CSS |
| PDF Export | jsPDF |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Turso database — get these from https://turso.tech
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Anthropic Claude API — get from https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...
```

**Local development without Turso:** use a local SQLite file by setting:

```env
TURSO_DATABASE_URL=file:local.db
```

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to Use

### Step 1 — Define SLA Rules (SLA Configuration page)

Before logging any outages, set up the SLA contract terms for each vendor product.

1. Navigate to **SLA Config** in the sidebar.
2. Fill in the form:
   - **Vendor name** — e.g. `Acme Corp`
   - **Product / service** — e.g. `Cloud Storage`
   - **Uptime SLA (%)** — the contracted uptime target, e.g. `99.9`
   - **Penalty per hour ($)** — the dollar amount charged per hour of excess downtime, e.g. `500.00`
3. Click **Save Rule**.

The uptime SLA determines the maximum allowed downtime per month. For example, a 99.9% SLA on a 30-day month allows ~43.8 minutes of downtime before a breach is triggered.

You can add one rule per vendor+product combination. To update a rule, remove it and re-add it.

---

### Step 2 — Log Vendor Notification Emails (Email Inbox page)

When a vendor sends an outage notification email (either a "service down" or "service restored" alert), log it here.

1. Navigate to **Email Inbox** in the sidebar.
2. Paste the full text of the vendor email into the text area.
3. Click **Parse Email** — Claude AI extracts:
   - Vendor name
   - Product/service name
   - Event type (`DOWN` or `UP`)
   - Timestamp (converted to UTC ISO 8601)
4. Review the parsed result. If it looks correct, click **Log Event**.

**What happens when you log a `DOWN` event:**
- A new outage record is opened with the event timestamp as `started_at`.
- The dashboard shows it as an active (ACTIVE) outage.

**What happens when you log an `UP` event:**
- The matching open outage is resolved.
- Duration is calculated in minutes.
- If an SLA rule exists for that vendor+product, the SLA engine computes whether the cumulative downtime for the month breaches the contract.
- If breached, a penalty in dollars is calculated and stored.
- A toast notification tells you immediately: breach or within SLA.

**Edge cases handled:**
- If a `DOWN` is logged when an outage is already open, it's ignored (deduplication).
- If an `UP` is logged with no matching open outage, a warning is shown.
- Multiple outages in a month are cumulated before evaluating the breach threshold.

---

### Step 3 — Monitor Outages (Dashboard)

The **Dashboard** gives a real-time overview:

- **Active Outages** — count of outages currently in progress (unresolved).
- **Penalties This Month** — total penalty dollars accrued from breached outages.
- **Outages This Month** — total outage count and how many are resolved.
- **Active outage banner** — appears at the top when any outage is unresolved, listing affected vendors.
- **Recent Activity** — the last 8 outages with vendor, product, duration, status, and penalty.

#### AI Insights

Click **Generate Insights** to send your SLA data to Claude Haiku for analysis. It returns 3–4 specific, actionable observations — e.g. which vendor is a repeat offender, whether you're trending toward a breach, or if all systems are healthy. Click **Refresh** to regenerate with the latest data.

---

### Step 4 — Browse the Full Breach Log (Breach Log page)

Navigate to **Breach Log** to see all recorded outages with filter tabs:

| Filter | Shows |
|---|---|
| All | Every outage ever recorded |
| Active | Currently unresolved outages |
| Breached | Outages that triggered an SLA breach |
| Within SLA | Resolved outages that stayed within the SLA |

Each row shows: vendor, product, start time, end time, duration, status badge, and penalty amount.

---

### Step 5 — Generate a Chargeback Letter (Reports page)

When you have breached outages and need to formally request a penalty credit from a vendor:

1. Navigate to **Reports** in the sidebar.
2. Select the **vendor**, **month**, and **year**.
3. Click **Generate with AI** — Claude Sonnet writes a formal chargeback letter that includes:
   - A summary of each SLA breach in the selected period
   - Duration and penalty amounts per incident
   - Total penalty amount being claimed
   - Professional tone suitable for vendor correspondence
4. **Copy** the letter to clipboard, or **Export PDF** to save a formatted PDF file.

> The report button is disabled if no vendor with breached outages exists for the selected period.

---

## SLA Breach Calculation

The SLA engine computes breach status as follows:

1. **Allowed downtime minutes** = `(1 - uptime_pct / 100) × minutes_in_month`
   - Example: 99.9% SLA in April (30 days = 43,200 min) → 43.2 minutes allowed
2. **Cumulative downtime** = sum of all resolved outage durations for that vendor+product in the same calendar month
3. **Breach** is triggered when `cumulative_downtime > allowed_downtime`
4. **Penalty** = `(excess_minutes / 60) × penalty_per_hr`

The calculation uses UTC month boundaries and accumulates across all outages in the month, not just the current one.

---

## REST API Reference

All endpoints are under `/api`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/parse-email` | Parse raw email text into a structured event |
| `POST` | `/api/events` | Log a parsed event and resolve outages |
| `GET` | `/api/events` | List all raw events |
| `GET` | `/api/outages` | List all outage records |
| `GET` | `/api/sla-rules` | List all SLA rules |
| `POST` | `/api/sla-rules` | Create an SLA rule |
| `DELETE` | `/api/sla-rules/:id` | Delete an SLA rule |
| `POST` | `/api/report` | Generate an AI chargeback letter |
| `GET` | `/api/insights` | Get AI insights on current SLA data |

---

## Database Schema

```sql
-- Raw email events
events (id, vendor, product, event_type, timestamp, raw_email, created_at)

-- Outage lifecycle records
outages (id, vendor, product, started_at, resolved_at, duration_mins, breach_status, penalty_usd)

-- SLA contracts
sla_rules (id, vendor, product, uptime_pct, penalty_per_hr)
```

The database is auto-migrated on first request via `migrate()` in `src/lib/db.ts`.

---

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint
npm run lint
```

Tests are in `/tests` and run with Jest in a Node environment.

---

## Project Structure

```
src/
├── app/
│   ├── api/           # API route handlers
│   ├── components/    # Shared UI components (NavLinks, Dashboard)
│   ├── breach-log/    # Breach log page
│   ├── inbox/         # Email inbox page
│   ├── report/        # Report generation page
│   ├── sla-config/    # SLA rules configuration page
│   ├── layout.tsx     # Root layout with sidebar navigation
│   └── page.tsx       # Dashboard (dynamic import, no SSR)
├── lib/
│   ├── claude.ts      # Anthropic client singleton
│   └── db.ts          # Database access layer
├── services/
│   ├── EmailParserService.ts  # Claude-based email parsing
│   ├── ReportGenerator.ts     # Claude-based chargeback letter generation
│   └── SLAEngine.ts           # Breach detection and penalty calculation
└── types/
    └── index.ts       # Shared TypeScript interfaces
```
