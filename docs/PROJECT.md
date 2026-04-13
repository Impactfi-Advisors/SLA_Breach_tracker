# SLA Breach Tracker — Project Knowledge Base

## What It Does

Internal tool that:
1. Ingests vendor downtime notification emails (manually or via IMAP automation)
2. Tracks outages per vendor/product with start/end times and durations
3. Evaluates monthly SLA compliance and calculates penalty amounts
4. Generates formal chargeback letters using AI
5. Gives each vendor company a read-only portal to view their own SLA data

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript |
| Database | Turso (libSQL / SQLite) |
| AI | Anthropic Claude (Sonnet 4 + Haiku) |
| IMAP | imapflow |
| PDF | jsPDF |
| Styling | Tailwind CSS |
| Runtime | Node.js 20 |

---

## Environment Variables

All go in `.env.local`. Never commit this file.

```bash
# Database (Turso)
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...               # omit for local file-based SQLite

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Admin authentication (min 16 chars)
ADMIN_API_SECRET=<random-32-char-string>

# IMAP password encryption (must be exactly 64 hex chars = 32 bytes)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64-char-hex>

# Cron endpoint protection (min 16 chars)
CRON_SECRET=<random-32-char-string>
```

---

## Running Locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build check
npm test           # jest test suite
npm run lint       # eslint
```

First visit redirects to `/login`. Password = value of `ADMIN_API_SECRET`.

---

## Database Schema

Auto-migrated on startup via `src/instrumentation.ts` → `src/lib/db.ts:migrate()`.

### `events`
Raw incoming email records.
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| vendor | TEXT | company name |
| product | TEXT | product/service name |
| event_type | TEXT | `'down'` or `'up'` |
| timestamp | TEXT | ISO 8601 UTC — when the event occurred |
| raw_email | TEXT | full email body |
| created_at | TEXT | when the row was inserted |

### `outages`
Tracked downtime incidents. One outage = one down→up lifecycle.
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| vendor | TEXT | |
| product | TEXT | |
| started_at | TEXT | ISO 8601 UTC |
| resolved_at | TEXT | nullable — null = still active |
| duration_mins | INTEGER | nullable — set on resolution |
| breach_status | TEXT | `'pending'` / `'within'` / `'breached'` |
| penalty_usd | REAL | nullable — calculated on resolution |

### `sla_rules`
SLA contracts per vendor+product.
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| vendor | TEXT | must match companies.name exactly |
| product | TEXT | |
| uptime_pct | REAL | e.g. `99.9` |
| penalty_per_hr | REAL | e.g. `500.00` |
| | | UNIQUE(vendor, product) |

### `companies`
Vendor registry — maps company names to email domains and portal tokens.
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT UNIQUE | must match vendor in sla_rules |
| domains | TEXT | JSON array: `'["acme.com","status.acme.com"]'` |
| access_token | TEXT UNIQUE | UUID v4 — used for portal URL |
| created_at | TEXT | |

### `products`
Product catalog with category classification.
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| vendor | TEXT | |
| name | TEXT | |
| category | TEXT | `'core'` / `'mobile'` / `'web'` / `'api'` / `'other'` |
| created_at | TEXT | |
| | | UNIQUE(vendor, name) |

### `email_accounts`
IMAP accounts polled for vendor emails.
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| label | TEXT | display name |
| host | TEXT | e.g. `imap.gmail.com` |
| port | INTEGER | default 993 |
| tls | INTEGER | 0 or 1 |
| username | TEXT | email address |
| password | TEXT | AES-256-GCM encrypted at rest |
| mailbox | TEXT | default `INBOX` |
| last_uid | INTEGER | IMAP UID cursor for incremental fetch |
| active | INTEGER | 0 or 1 |
| created_at | TEXT | |

### `email_poll_log`
Audit trail for every automated email processing attempt.
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| account_id | INTEGER | FK to email_accounts.id |
| message_uid | INTEGER | IMAP UID |
| subject | TEXT | email subject |
| sender | TEXT | from address |
| matched_vendor | TEXT | resolved vendor or null |
| status | TEXT | `'processed'` / `'skipped'` / `'error'` / `'duplicate'` |
| error_msg | TEXT | nullable |
| event_id | INTEGER | FK to events.id if processed |
| processed_at | TEXT | |

---

## API Routes

### Auth (public — no middleware)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Validates password, sets `admin_session` HttpOnly cookie |
| POST | `/api/auth/logout` | Clears `admin_session` cookie |

### Admin API (protected by middleware — requires cookie or Bearer token)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/companies` | List all companies |
| POST | `/api/companies` | Create company (auto-generates access_token) |
| GET | `/api/companies/[id]` | Get single company |
| PUT | `/api/companies/[id]` | Update name/domains |
| DELETE | `/api/companies/[id]` | Delete company |
| POST | `/api/companies/[id]/regenerate-token` | Issue new portal token (invalidates old) |
| GET | `/api/products` | List products (optional `?vendor=` filter) |
| POST | `/api/products` | Create product |
| GET/DELETE | `/api/products/[id]` | Get / delete product |
| GET | `/api/sla-rules` | List all SLA rules |
| POST | `/api/sla-rules` | Create SLA rule |
| DELETE | `/api/sla-rules/[id]` | Delete SLA rule |
| GET POST | `/api/events` | List / create events (triggers outage lifecycle) |
| GET | `/api/outages` | List all outages |
| GET | `/api/email-accounts` | List IMAP accounts (passwords redacted) |
| POST | `/api/email-accounts` | Add IMAP account |
| GET/DELETE | `/api/email-accounts/[id]` | Get (redacted) / delete account |
| POST | `/api/email-accounts/[id]/test` | Test IMAP connectivity |
| GET | `/api/cron/email-poll` | Trigger email poll (also requires `x-cron-secret` header) |
| GET | `/api/poll-log` | Audit log (`?limit=50&status=error`) |
| POST | `/api/report` | Generate chargeback letter (vendor, month, year) |
| GET | `/api/insights` | AI-generated analysis of current month |
| POST | `/api/parse-email` | Parse raw email text via Claude |

### Company Portal (public — token auth only)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/portal/[token]` | Returns company-specific outages + SLA rules + stats |

---

## UI Pages

### Admin (require login)
| Path | Description |
|------|-------------|
| `/` | Dashboard — stats cards, AI insights, recent outages |
| `/inbox` | Manual email paste → Claude parse → log event |
| `/sla-config` | SLA rules management (vendor, product, uptime %, penalty/hr) |
| `/breach-log` | All outages with filter tabs (All / Active / Breached / Within SLA) |
| `/report` | Generate AI chargeback letter for a vendor/month |
| `/companies` | Company registry — domains, portal link, copy/regenerate |
| `/products` | Product catalog with category badges |
| `/email-config` | IMAP accounts — add, test, Poll Now button |
| `/email-config/poll-log` | Email ingestion audit log |

### Public
| Path | Description |
|------|-------------|
| `/login` | Admin login page |
| `/portal/[token]` | Company-facing read-only SLA portal |

---

## Services

### `SLAEngine` (`src/services/SLAEngine.ts`)
Pure calculation — no DB calls.
- `allowedDowntimeMins(uptimePct, month, year)` — max downtime budget for a month
- `computeBreachStatus({totalOutageMins, uptimePct, penaltyPerHr, month, year})` → `{status, penalty, excessMins}`
- `durationMins(startedAt, resolvedAt)` → integer minutes

**Breach formula:**
```
allowedMins = daysInMonth × 24 × 60 × (1 - uptimePct / 100)
excessMins  = cumulativeOutageMins - allowedMins
penalty     = (excessMins / 60) × penaltyPerHr   (if excess > 0)
```
Cumulative = sum of all resolved outages for same vendor+product in the same calendar month.

### `EmailParserService` (`src/services/EmailParserService.ts`)
- `parse(rawEmail, hintVendor?)` → `ParsedEvent`
- Uses Claude Sonnet 4, max 256 tokens
- `hintVendor` injected into system prompt to force vendor match (prompt injection defense)
- Throws on parse failure or `{"error": "..."}` response

### `EmailIngestionService` (`src/services/EmailIngestionService.ts`)
Full automation pipeline for a single email:
1. `DomainMatcherService.matchVendor(senderEmail)` → vendor name or null
2. If null → log `skipped`
3. `EmailParserService.parse(rawEmail, vendor)` → ParsedEvent
4. Enforce `parsed.vendor === vendor` (prompt injection guard)
5. Validate `parsed.event_type` is `'down'` or `'up'`
6. Check for duplicate open outage (down events)
7. Insert event, create/resolve outage, calculate breach
8. Log result to `email_poll_log`

### `DomainMatcherService` (`src/services/DomainMatcherService.ts`)
- `matchVendor(senderEmail)` → vendor name or null
- Extracts domain from sender, matches against `companies.domains` JSON arrays
- Supports exact match (`acme.com`) and parent-domain match (`alerts.acme.com` → `acme.com`)

### `ReportGenerator` (`src/services/ReportGenerator.ts`)
- `generate({vendor, month, year, outages, totalPenalty})` → letter string
- Claude Sonnet 4, formal business letter format
- Itemizes each breach, states total penalty, Net 30 terms

### `EmailParserService` → Claude model usage
| Service | Model | Max tokens | Purpose |
|---------|-------|-----------|---------|
| EmailParserService | claude-sonnet-4-20250514 | 256 | Extract event fields from email |
| ReportGenerator | claude-sonnet-4-20250514 | 1024 | Write chargeback letter |
| Insights API | claude-haiku-4-5-20251001 | 600 | Dashboard AI analysis |

---

## Authentication & Security

### Admin auth
- Middleware at `src/middleware.ts` guards all admin routes
- Browser: HttpOnly cookie `admin_session` (set by `/api/auth/login`, 7-day expiry)
- Programmatic (cron/scripts): `Authorization: Bearer <ADMIN_API_SECRET>` header
- Unauthenticated browser requests → 307 redirect to `/login?next=<original-path>`
- Unauthenticated API requests → 401 JSON

### Cron endpoint
- Requires `x-cron-secret` header matching `CRON_SECRET` env var
- Also behind admin middleware (Bearer token)
- Returns 500 if `CRON_SECRET` is unset or under 16 chars

### Company portal
- Token = UUID v4 (122 bits entropy) stored in `companies.access_token`
- Portal URL: `/portal/<token>` — excluded from admin middleware
- Token regeneration via admin UI invalidates old link immediately
- Returns only last 12 months of outage data

### IMAP passwords
- Encrypted with AES-256-GCM before DB insert (`src/lib/encryption.ts`)
- IV + auth tag + ciphertext stored as `iv:tag:enc` hex string
- Decrypted in-process when fetching accounts for polling
- Never returned in API responses (replaced with `••••••••`)

### Input validation
- All `[id]` params: `parseInt(raw, 10)` + `isNaN` guard → 400 on invalid
- Port numbers: validated 1–65535
- Year in report: validated 2000 to currentYear+1
- `event_type`: validated at DB level (CHECK constraint) and API level
- Parameterized queries throughout — no SQL injection risk
- DB errors logged server-side, generic "Internal server error" returned to caller

---

## Email Automation Flow

```
External cron (every 5 min)
  → GET /api/cron/email-poll
      (x-cron-secret header + Bearer token)
        ↓
    Load active email_accounts from DB
        ↓
    For each account:
      fetchNewMessages(account)   ← imapflow, UIDs > last_uid
        ↓
      For each message:
        EmailIngestionService.ingest({rawEmail, senderEmail, uid, accountId})
          ├── DomainMatcherService.matchVendor(sender)
          │     → queries companies table, domain match
          ├── EmailParserService.parse(rawEmail, hintVendor)
          │     → Claude Sonnet 4
          ├── vendor match assertion (prompt injection guard)
          ├── insertEvent()
          ├── insertOutage() or resolveOutage() + SLAEngine
          └── insertPollLog()
        ↓
      updateEmailAccountLastUid(account.id, maxUid)
        ↓
    Return { processed, skipped, errors }
```

---

## Key Business Rules

1. **Breach is monthly** — cumulative downtime per vendor+product per calendar month is compared against the monthly allowance
2. **Penalty only on resolution** — breach status and penalty are calculated when the 'up' event arrives, using all prior resolved outages in the same month
3. **One open outage at a time** — duplicate 'down' events for the same vendor+product are ignored (existing outage ID returned, warning logged)
4. **'up' with no open outage** — warns but does not error; event is still stored
5. **Pending status** — outages stay `'pending'` while active (no SLA rule match possible until resolved)
6. **Company name must match exactly** — `companies.name` = `sla_rules.vendor` = `events.vendor` (case-sensitive)

---

## File Structure

```
src/
├── middleware.ts                    Admin auth guard
├── instrumentation.ts               Runs DB migrations on startup
├── types/
│   └── index.ts                     All TypeScript interfaces
├── lib/
│   ├── db.ts                        All database access functions
│   ├── claude.ts                    Anthropic SDK client singleton
│   ├── encryption.ts                AES-256-GCM encrypt/decrypt for passwords
│   └── imap.ts                      imapflow wrapper — fetch + test connection
├── services/
│   ├── SLAEngine.ts                 Breach/penalty calculation (pure functions)
│   ├── EmailParserService.ts        Claude email → ParsedEvent
│   ├── EmailIngestionService.ts     Full automation pipeline orchestrator
│   ├── DomainMatcherService.ts      Sender email → vendor name
│   └── ReportGenerator.ts          Claude → chargeback letter
└── app/
    ├── layout.tsx                   Root layout with sidebar nav + logout
    ├── page.tsx                     Dashboard (stats + AI insights)
    ├── login/page.tsx               Admin login form
    ├── inbox/page.tsx               Manual email paste + parse + log
    ├── sla-config/page.tsx          SLA rules CRUD
    ├── breach-log/page.tsx          Outage history with filters
    ├── report/page.tsx              Chargeback letter generator + PDF export
    ├── companies/page.tsx           Company registry + portal links
    ├── products/page.tsx            Product catalog
    ├── email-config/page.tsx        IMAP account management
    ├── email-config/poll-log/       Ingestion audit log
    ├── portal/[token]/page.tsx      Company-facing SLA portal (public)
    ├── components/
    │   ├── Dashboard.tsx            Stats cards + AI insights panel
    │   ├── NavLinks.tsx             Sidebar navigation
    │   └── LogoutButton.tsx         Logout icon button
    └── api/
        ├── auth/login/              POST — set session cookie
        ├── auth/logout/             POST — clear session cookie
        ├── companies/               CRUD + regenerate-token
        ├── products/                CRUD
        ├── sla-rules/               CRUD
        ├── events/                  GET all + POST (outage lifecycle)
        ├── outages/                 GET all
        ├── email-accounts/          CRUD + test connection
        ├── cron/email-poll/         Automated polling trigger
        ├── poll-log/                Audit log query
        ├── parse-email/             Manual Claude parsing
        ├── report/                  Chargeback letter generation
        ├── insights/                AI dashboard analysis
        └── portal/[token]/          Company portal data
```

---

## Setup Checklist (New Deployment)

- [ ] `npm install`
- [ ] Create `.env.local` with all 5 env vars (see above)
- [ ] Set `TURSO_DATABASE_URL` — local: `file:local.db`, cloud: Turso dashboard URL
- [ ] DB tables auto-created on first startup (no manual migration needed)
- [ ] Visit `http://localhost:3000` → redirects to `/login`
- [ ] Log in with `ADMIN_API_SECRET`
- [ ] Add companies at `/companies` — name must match SLA rule vendor names exactly
- [ ] Add SLA rules at `/sla-config`
- [ ] Add IMAP account at `/email-config`, click **Test Connection**
- [ ] Set up external cron to `GET /api/cron/email-poll` every 5 min with both headers:
  ```
  Authorization: Bearer <ADMIN_API_SECRET>
  x-cron-secret: <CRON_SECRET>
  ```
- [ ] Share portal URLs with vendor companies: `/portal/<their-token>`

---

## Vercel Deployment

```json
// vercel.json — cron configuration
{
  "crons": [
    {
      "path": "/api/cron/email-poll",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Vercel Cron calls with a `Authorization` header automatically if configured. Also add `x-cron-secret` via Vercel environment variables and a custom header in the cron config.
