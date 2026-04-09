# SLA Breach Tracker — Design Spec
**Date:** 2026-04-09  
**Status:** Approved

---

## Overview

A Next.js web app that ingests vendor downtime notification emails (via paste), automatically tracks SLA breaches per product, and generates monthly chargeback reports. Single-user MVP, no authentication.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| AI | Anthropic `claude-sonnet-4-20250514` via `@anthropic-ai/sdk` |
| Database | Turso (libSQL / SQLite-compatible) via `@libsql/client` |
| PDF Export | `jsPDF` (client-side) |
| Deployment | Vercel |

**Why Turso over better-sqlite3:** Vercel serverless functions cannot run native Node.js binaries. Turso is SQLite-compatible (identical SQL syntax) and works on Vercel with no infrastructure changes.

---

## Architecture

### Service Layer Pattern

API routes are thin — they validate input, call a service, and return the result. Business logic lives exclusively in `src/services/`.

```
src/
├── app/
│   ├── page.tsx                  # Summary dashboard
│   ├── inbox/page.tsx            # Email paste inbox
│   ├── sla-config/page.tsx       # SLA rules configuration
│   ├── breach-log/page.tsx       # Outage event table
│   ├── report/page.tsx           # Monthly report generator
│   └── api/
│       ├── parse-email/route.ts  # POST — parse raw email via Claude
│       ├── events/route.ts       # GET / POST — events CRUD
│       ├── sla-rules/route.ts    # GET / POST / DELETE — SLA rules CRUD
│       └── report/route.ts       # POST — generate chargeback letter via Claude
├── services/
│   ├── EmailParserService.ts     # Calls Claude, returns structured ParsedEvent
│   ├── SLAEngine.ts              # Computes breach status, duration, penalty
│   └── ReportGenerator.ts        # Builds Claude prompt, returns letter string
├── lib/
│   ├── db.ts                     # Turso client + typed query helpers
│   └── claude.ts                 # Anthropic SDK client singleton
└── types/
    └── index.ts                  # Shared TypeScript interfaces
```

### Data Flow

```
Email text
  → POST /api/parse-email
  → EmailParserService.parse(text)
  → Claude extracts: vendor, product, event_type, timestamp
  → returns ParsedEvent

User confirms
  → POST /api/events
  → saves to events table
  → if event_type == 'down': create new outage (resolved_at = NULL)
  → if event_type == 'up':  SLAEngine.resolveOutage(vendor, product)
                            → find latest open outage
                            → compute duration_mins
                            → check against SLA rule
                            → set breach_status + penalty_usd

Breach log
  → GET /api/events
  → SLAEngine enriches with computed fields
  → rendered table

Monthly report
  → POST /api/report { vendor, month, year }
  → ReportGenerator.generate(...)
  → Claude writes formal chargeback letter
  → returned as string → modal → jsPDF / clipboard
```

---

## Data Model

```sql
-- Raw parsed email events
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor      TEXT NOT NULL,
  product     TEXT NOT NULL,
  event_type  TEXT NOT NULL CHECK(event_type IN ('down', 'up')),
  timestamp   TEXT NOT NULL,   -- ISO 8601 UTC
  raw_email   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Matched outage incidents (down → up pairs)
CREATE TABLE outages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor        TEXT NOT NULL,
  product       TEXT NOT NULL,
  started_at    TEXT NOT NULL,    -- ISO 8601 UTC
  resolved_at   TEXT,             -- NULL = still active
  duration_mins INTEGER,          -- computed on resolution
  breach_status TEXT CHECK(breach_status IN ('within', 'breached', 'pending')),
  penalty_usd   REAL
);

-- SLA rules per vendor+product
CREATE TABLE sla_rules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor          TEXT NOT NULL,
  product         TEXT NOT NULL,
  uptime_pct      REAL NOT NULL,    -- e.g. 99.9 = 99.9%
  penalty_per_hr  REAL NOT NULL,    -- e.g. 500.00 = $500/hr
  UNIQUE(vendor, product)
);
```

**Outage pairing rule:** When an "up" event arrives, `SLAEngine` finds the **latest unresolved outage** for that vendor+product. One active outage per vendor+product at a time (MVP assumption).

**Breach calculation:**
- Total minutes in month = days_in_month × 24 × 60
- Allowed downtime = total_minutes × (1 - uptime_pct / 100)
- Excess downtime = sum of outage duration_mins for month − allowed_downtime
- If excess > 0: `breach_status = 'breached'`, `penalty_usd = (excess_mins / 60) × penalty_per_hr`
- Active outages: `breach_status = 'pending'`
- Cross-month outages: assigned to the month of `started_at` (MVP simplification)

---

## API Routes

### `POST /api/parse-email`
**Body:** `{ rawEmail: string }`  
**Returns:** `{ vendor: string, product: string, event_type: 'down'|'up', timestamp: string }`  
**Action:** Sends email text to Claude with extraction prompt. Returns structured `ParsedEvent`. Does NOT save to DB — user confirms first.

### `POST /api/events`
**Body:** `ParsedEvent`  
**Returns:** `{ eventId: number, outageId: number | null }`  
**Action:** Saves event. Creates or resolves outage. Computes breach status if resolving.

### `GET /api/events`
**Returns:** Array of raw parsed events (for audit/debug purposes).

### `GET /api/outages`
**Returns:** Array of outage records with computed fields (duration, breach status, penalty). Used by the breach log page.

### `POST /api/sla-rules`
**Body:** `{ vendor, product, uptime_pct, penalty_per_hr }`  
**Returns:** Created rule.

### `GET /api/sla-rules`
**Returns:** All SLA rules.

### `DELETE /api/sla-rules/[id]`
**Returns:** `{ success: true }`

### `POST /api/report`
**Body:** `{ vendor: string, month: number, year: number }`  
**Returns:** `{ letter: string }`  
**Action:** Fetches all breached outages for vendor+month. Builds prompt with breach data. Claude writes formal chargeback letter. Returns as plain string.

---

## UI Pages

### `/` — Summary Dashboard
Three stat cards:
- **Active Outages** — count of outages where `resolved_at IS NULL`
- **Total Penalties This Month** — sum of `penalty_usd` for current month
- **Top Offending Vendor** — vendor with highest penalty_usd this month

Data fetched server-side (Next.js Server Components).

### `/inbox` — Email Paste Inbox
1. Textarea for raw email text
2. "Parse Email" button → calls `POST /api/parse-email`
3. Shows parsed result: vendor, product, event type, timestamp
4. "Log Event" button → calls `POST /api/events`
5. Success toast with outage status (opened / resolved + breach result)

### `/sla-config` — SLA Configuration
- Table of existing rules: Vendor | Product | Uptime % | Penalty/hr | Delete
- "Add Rule" inline form: vendor, product, uptime %, penalty/hr, Save button
- Validation: uptime_pct must be 0–100, penalty_per_hr must be > 0

### `/breach-log` — Outage Log
Table columns: Vendor | Product | Start | End | Duration | SLA Status | Penalty  
- End = "Active" if `resolved_at IS NULL`
- Duration = "Ongoing" if active
- Status badge: green (within SLA), red (breached), yellow (pending/active)
- Sortable by vendor and start date

### `/report` — Monthly Report Generator
1. Dropdowns: vendor (from existing outage data) + month + year
2. "Generate Report" button → `POST /api/report`
3. Loading state while Claude generates
4. Report displays in modal as formatted text
5. Modal footer:
   - "Copy to Clipboard" (navigator.clipboard API)
   - "Export PDF" (jsPDF — A4, monospace font, letter content)

---

## Claude Prompts

### Email Parsing (EmailParserService)
System prompt instructs Claude to return strict JSON only:
```json
{
  "vendor": "string",
  "product": "string", 
  "event_type": "down" | "up",
  "timestamp": "ISO 8601 UTC string"
}
```
If extraction fails (insufficient info), Claude returns `{ "error": "reason" }`.

### Report Generation (ReportGenerator)
Prompt includes: vendor name, month/year, list of each breach (product, duration, penalty), total owed. Claude writes a formal business chargeback letter. No JSON — plain text output.

---

## Environment Variables

Stored in `.env.local`, never committed:

```
ANTHROPIC_API_KEY=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

---

## Error Handling

- Claude parse failure: show error toast, do not save event
- No matching SLA rule on resolution: outage saved, breach_status = 'pending', penalty = null
- No open outage found for "up" event: save event, show warning ("No open outage found for this product")
- Turso connection error: 500 with `{ error: "DB unavailable" }`

---

## Out of Scope (MVP)

- User authentication
- Live email mailbox integration
- Multi-tenant support
- Timezone-aware SLA windows
- Historical SLA trend charts
- Email notifications
