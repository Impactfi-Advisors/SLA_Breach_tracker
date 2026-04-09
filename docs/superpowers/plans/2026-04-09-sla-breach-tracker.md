# SLA Breach Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app that ingests vendor downtime emails, tracks SLA breaches per product, and generates monthly chargeback reports.

**Architecture:** Thin API routes delegate to a service layer (`EmailParserService`, `SLAEngine`, `ReportGenerator`). Data persists in Turso (libSQL). Claude handles email parsing and report generation. No authentication — single-user MVP.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, `@anthropic-ai/sdk` (claude-sonnet-4-20250514), `@libsql/client` (Turso), `jspdf`, Jest + ts-jest

---

## File Map

```
src/
├── app/
│   ├── layout.tsx                        # Root layout + sidebar nav
│   ├── page.tsx                          # Summary dashboard (server component)
│   ├── inbox/page.tsx                    # Email paste inbox (client component)
│   ├── sla-config/page.tsx               # SLA rules CRUD (client component)
│   ├── breach-log/page.tsx               # Outage table (server component)
│   ├── report/page.tsx                   # Report generator (client component)
│   └── api/
│       ├── parse-email/route.ts          # POST — Claude parses email
│       ├── events/route.ts               # GET/POST — raw events
│       ├── outages/route.ts              # GET — outage records
│       ├── sla-rules/route.ts            # GET/POST — SLA rules
│       ├── sla-rules/[id]/route.ts       # DELETE — SLA rule by id
│       └── report/route.ts              # POST — generate chargeback letter
├── services/
│   ├── EmailParserService.ts             # Claude email extraction
│   ├── SLAEngine.ts                      # Breach calculation, duration
│   └── ReportGenerator.ts               # Claude chargeback letter
├── lib/
│   ├── db.ts                             # Turso client + all query helpers + migrate()
│   └── claude.ts                         # Anthropic SDK singleton
├── types/
│   └── index.ts                          # Shared TypeScript interfaces
└── instrumentation.ts                    # Runs migrate() on server startup

tests/
├── services/
│   ├── SLAEngine.test.ts
│   ├── EmailParserService.test.ts
│   └── ReportGenerator.test.ts
└── api/
    ├── parse-email.test.ts
    └── sla-rules.test.ts

next.config.ts                            # serverExternalPackages for @libsql/client
jest.config.ts
.env.local.example
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via scaffold)
- Create: `next.config.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Scaffold Next.js project**

Run from `/home/akash/SLA_Breach_Tracker`:
```bash
npx create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```
Expected: Creates `src/`, `package.json`, `tailwind.config.ts`, `tsconfig.json`, etc. Say yes to overwrite if prompted (only CLAUDE.md + docs/ already exist).

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @anthropic-ai/sdk @libsql/client jspdf
```
Expected: `package.json` now lists these three packages in `dependencies`.

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D jest jest-environment-node @types/jest ts-jest
```

- [ ] **Step 4: Write next.config.ts**

Replace the generated `next.config.ts` with:
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
}

export default nextConfig
```

- [ ] **Step 5: Write .env.local.example**

```bash
cat > .env.local.example << 'EOF'
ANTHROPIC_API_KEY=your_anthropic_api_key_here
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=
EOF
```

- [ ] **Step 6: Copy to .env.local**

```bash
cp .env.local.example .env.local
```
Then set `ANTHROPIC_API_KEY` to your real key. Leave `TURSO_DATABASE_URL=file:./local.db` for local development — `@libsql/client` supports local SQLite files natively.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project with Turso, Claude, jsPDF deps"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write types**

Create `src/types/index.ts`:
```typescript
export interface ParsedEvent {
  vendor: string
  product: string
  event_type: 'down' | 'up'
  timestamp: string // ISO 8601 UTC
}

export interface RawEvent extends ParsedEvent {
  id: number
  raw_email: string
  created_at: string
}

export interface Outage {
  id: number
  vendor: string
  product: string
  started_at: string       // ISO 8601 UTC
  resolved_at: string | null
  duration_mins: number | null
  breach_status: 'within' | 'breached' | 'pending'
  penalty_usd: number | null
}

export interface SLARule {
  id: number
  vendor: string
  product: string
  uptime_pct: number    // e.g. 99.9
  penalty_per_hr: number // e.g. 500.00
}

export interface BreachResult {
  status: 'within' | 'breached'
  penalty: number
  excessMins: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript interfaces"
```

---

## Task 3: Jest Setup

**Files:**
- Create: `jest.config.ts`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Write jest.config.ts**

Create `jest.config.ts` at the project root:
```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 2: Add test scripts to package.json**

Open `package.json`. In the `"scripts"` section, ensure these lines exist (add/replace as needed):
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 3: Create test directories**

```bash
mkdir -p tests/services tests/api
```

- [ ] **Step 4: Verify Jest can run (empty suite)**

```bash
npx jest --passWithNoTests
```
Expected output: `Test Suites: 0 skipped` or similar, exit 0.

- [ ] **Step 5: Commit**

```bash
git add jest.config.ts package.json tests/
git commit -m "chore: configure Jest with ts-jest for Next.js"
```

---

## Task 4: Database Library

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Write db.ts**

Create `src/lib/db.ts`:
```typescript
import { createClient, Client } from '@libsql/client'
import type { ParsedEvent, RawEvent, Outage, SLARule } from '@/types'

let _db: Client | null = null

function getDb(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    })
  }
  return _db
}

export async function migrate(): Promise<void> {
  const db = getDb()
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor      TEXT NOT NULL,
      product     TEXT NOT NULL,
      event_type  TEXT NOT NULL CHECK(event_type IN ('down', 'up')),
      timestamp   TEXT NOT NULL,
      raw_email   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS outages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor        TEXT NOT NULL,
      product       TEXT NOT NULL,
      started_at    TEXT NOT NULL,
      resolved_at   TEXT,
      duration_mins INTEGER,
      breach_status TEXT DEFAULT 'pending' CHECK(breach_status IN ('within', 'breached', 'pending')),
      penalty_usd   REAL
    );
    CREATE TABLE IF NOT EXISTS sla_rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor          TEXT NOT NULL,
      product         TEXT NOT NULL,
      uptime_pct      REAL NOT NULL,
      penalty_per_hr  REAL NOT NULL,
      UNIQUE(vendor, product)
    );
  `)
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function insertEvent(
  event: ParsedEvent & { raw_email: string }
): Promise<number> {
  const db = getDb()
  const result = await db.execute({
    sql: `INSERT INTO events (vendor, product, event_type, timestamp, raw_email)
          VALUES (?, ?, ?, ?, ?)`,
    args: [event.vendor, event.product, event.event_type, event.timestamp, event.raw_email],
  })
  return Number(result.lastInsertRowid)
}

export async function getEvents(): Promise<RawEvent[]> {
  const db = getDb()
  const result = await db.execute(
    'SELECT * FROM events ORDER BY created_at DESC'
  )
  return result.rows as unknown as RawEvent[]
}

// ── Outages ───────────────────────────────────────────────────────────────────

export async function insertOutage(
  vendor: string,
  product: string,
  startedAt: string
): Promise<number> {
  const db = getDb()
  const result = await db.execute({
    sql: `INSERT INTO outages (vendor, product, started_at, breach_status)
          VALUES (?, ?, ?, 'pending')`,
    args: [vendor, product, startedAt],
  })
  return Number(result.lastInsertRowid)
}

export async function getOpenOutage(
  vendor: string,
  product: string
): Promise<Outage | null> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT * FROM outages
          WHERE vendor = ? AND product = ? AND resolved_at IS NULL
          ORDER BY started_at DESC LIMIT 1`,
    args: [vendor, product],
  })
  return result.rows.length > 0 ? (result.rows[0] as unknown as Outage) : null
}

export async function resolveOutage(
  id: number,
  resolvedAt: string,
  durationMins: number,
  breachStatus: string,
  penaltyUsd: number | null
): Promise<void> {
  const db = getDb()
  await db.execute({
    sql: `UPDATE outages
          SET resolved_at = ?, duration_mins = ?, breach_status = ?, penalty_usd = ?
          WHERE id = ?`,
    args: [resolvedAt, durationMins, breachStatus, penaltyUsd, id],
  })
}

export async function getOutages(): Promise<Outage[]> {
  const db = getDb()
  const result = await db.execute(
    'SELECT * FROM outages ORDER BY started_at DESC'
  )
  return result.rows as unknown as Outage[]
}

export async function getBreachedOutagesByVendorMonth(
  vendor: string,
  month: number,
  year: number
): Promise<Outage[]> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT * FROM outages
          WHERE vendor = ?
            AND breach_status = 'breached'
            AND strftime('%m', started_at) = ?
            AND strftime('%Y', started_at) = ?`,
    args: [vendor, String(month).padStart(2, '0'), String(year)],
  })
  return result.rows as unknown as Outage[]
}

// ── SLA Rules ─────────────────────────────────────────────────────────────────

export async function insertSLARule(
  rule: Omit<SLARule, 'id'>
): Promise<number> {
  const db = getDb()
  const result = await db.execute({
    sql: `INSERT INTO sla_rules (vendor, product, uptime_pct, penalty_per_hr)
          VALUES (?, ?, ?, ?)`,
    args: [rule.vendor, rule.product, rule.uptime_pct, rule.penalty_per_hr],
  })
  return Number(result.lastInsertRowid)
}

export async function getSLARules(): Promise<SLARule[]> {
  const db = getDb()
  const result = await db.execute(
    'SELECT * FROM sla_rules ORDER BY vendor, product'
  )
  return result.rows as unknown as SLARule[]
}

export async function getSLARuleForProduct(
  vendor: string,
  product: string
): Promise<SLARule | null> {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM sla_rules WHERE vendor = ? AND product = ? LIMIT 1',
    args: [vendor, product],
  })
  return result.rows.length > 0 ? (result.rows[0] as unknown as SLARule) : null
}

export async function deleteSLARule(id: number): Promise<void> {
  const db = getDb()
  await db.execute({
    sql: 'DELETE FROM sla_rules WHERE id = ?',
    args: [id],
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add Turso DB client with migrate() and query helpers"
```

---

## Task 5: Claude Client

**Files:**
- Create: `src/lib/claude.ts`

- [ ] **Step 1: Write claude.ts**

Create `src/lib/claude.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  }
  return _client
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add Anthropic SDK client singleton"
```

---

## Task 6: SLAEngine Service (TDD)

**Files:**
- Create: `tests/services/SLAEngine.test.ts`
- Create: `src/services/SLAEngine.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/SLAEngine.test.ts`:
```typescript
import { SLAEngine } from '../../src/services/SLAEngine'

describe('SLAEngine', () => {
  describe('daysInMonth', () => {
    it('returns 30 for April 2026', () => {
      expect(SLAEngine.daysInMonth(4, 2026)).toBe(30)
    })
    it('returns 31 for January 2026', () => {
      expect(SLAEngine.daysInMonth(1, 2026)).toBe(31)
    })
    it('returns 28 for February 2026 (non-leap year)', () => {
      expect(SLAEngine.daysInMonth(2, 2026)).toBe(28)
    })
  })

  describe('allowedDowntimeMins', () => {
    it('computes allowed downtime for 99.9% uptime in April 2026', () => {
      // 30 days * 24 * 60 = 43200 total mins; 43200 * 0.001 = 43.2
      expect(SLAEngine.allowedDowntimeMins(99.9, 4, 2026)).toBeCloseTo(43.2, 1)
    })
    it('computes allowed downtime for 99.5% uptime in January 2026', () => {
      // 31 * 24 * 60 = 44640; 44640 * 0.005 = 223.2
      expect(SLAEngine.allowedDowntimeMins(99.5, 1, 2026)).toBeCloseTo(223.2, 1)
    })
  })

  describe('computeBreachStatus', () => {
    it('returns within when outage is under allowed downtime', () => {
      const result = SLAEngine.computeBreachStatus({
        totalOutageMins: 30,
        uptimePct: 99.9,
        penaltyPerHr: 500,
        month: 4,
        year: 2026,
      })
      expect(result.status).toBe('within')
      expect(result.penalty).toBe(0)
      expect(result.excessMins).toBe(0)
    })

    it('returns breached when outage exceeds allowed downtime', () => {
      // allowed = 43.2 mins; outage = 104 mins; excess = 60.8 mins
      const result = SLAEngine.computeBreachStatus({
        totalOutageMins: 104,
        uptimePct: 99.9,
        penaltyPerHr: 500,
        month: 4,
        year: 2026,
      })
      expect(result.status).toBe('breached')
      expect(result.penalty).toBeGreaterThan(0)
      expect(result.excessMins).toBeCloseTo(60.8, 0)
    })

    it('computes penalty as (excessMins / 60) * penaltyPerHr', () => {
      const result = SLAEngine.computeBreachStatus({
        totalOutageMins: 104,
        uptimePct: 99.9,
        penaltyPerHr: 600,
        month: 4,
        year: 2026,
      })
      const expected = (result.excessMins / 60) * 600
      expect(result.penalty).toBeCloseTo(expected, 2)
    })

    it('rounds penalty to 2 decimal places', () => {
      const result = SLAEngine.computeBreachStatus({
        totalOutageMins: 104,
        uptimePct: 99.9,
        penaltyPerHr: 500,
        month: 4,
        year: 2026,
      })
      expect(result.penalty).toBe(Math.round(result.penalty * 100) / 100)
    })
  })

  describe('durationMins', () => {
    it('computes duration between two ISO timestamps', () => {
      expect(SLAEngine.durationMins(
        '2026-04-01T10:00:00Z',
        '2026-04-01T11:30:00Z'
      )).toBe(90)
    })
    it('returns 0 for same start and end', () => {
      expect(SLAEngine.durationMins(
        '2026-04-01T10:00:00Z',
        '2026-04-01T10:00:00Z'
      )).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/services/SLAEngine.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../../src/services/SLAEngine'`

- [ ] **Step 3: Create services directory and write SLAEngine.ts**

```bash
mkdir -p src/services
```

Create `src/services/SLAEngine.ts`:
```typescript
import type { BreachResult } from '@/types'

export class SLAEngine {
  /** Number of days in a given month (month is 1-based). */
  static daysInMonth(month: number, year: number): number {
    return new Date(year, month, 0).getDate()
  }

  /** Maximum allowed downtime in minutes for a given SLA and month. */
  static allowedDowntimeMins(uptimePct: number, month: number, year: number): number {
    const totalMins = SLAEngine.daysInMonth(month, year) * 24 * 60
    return totalMins * (1 - uptimePct / 100)
  }

  /**
   * Given total outage minutes for a product in a month, compute breach status.
   * Note: totalOutageMins is for this single outage. For cumulative monthly SLA,
   * sum all outage durations before calling.
   */
  static computeBreachStatus(params: {
    totalOutageMins: number
    uptimePct: number
    penaltyPerHr: number
    month: number
    year: number
  }): BreachResult {
    const allowed = SLAEngine.allowedDowntimeMins(params.uptimePct, params.month, params.year)
    const excess = params.totalOutageMins - allowed
    if (excess <= 0) {
      return { status: 'within', penalty: 0, excessMins: 0 }
    }
    const rawPenalty = (excess / 60) * params.penaltyPerHr
    return {
      status: 'breached',
      penalty: Math.round(rawPenalty * 100) / 100,
      excessMins: excess,
    }
  }

  /** Duration in minutes between two ISO 8601 timestamps. */
  static durationMins(startedAt: string, resolvedAt: string): number {
    return Math.floor(
      (new Date(resolvedAt).getTime() - new Date(startedAt).getTime()) / 60000
    )
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/services/SLAEngine.test.ts --no-coverage
```
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/SLAEngine.ts tests/services/SLAEngine.test.ts
git commit -m "feat: add SLAEngine with breach calculation and duration helpers"
```

---

## Task 7: EmailParserService (TDD)

**Files:**
- Create: `tests/services/EmailParserService.test.ts`
- Create: `src/services/EmailParserService.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/EmailParserService.test.ts`:
```typescript
import { EmailParserService } from '../../src/services/EmailParserService'
import { getClaudeClient } from '../../src/lib/claude'

jest.mock('../../src/lib/claude')

describe('EmailParserService.parse', () => {
  const mockCreate = jest.fn()

  beforeEach(() => {
    jest.mocked(getClaudeClient).mockReturnValue({
      messages: { create: mockCreate },
    } as any)
  })

  afterEach(() => jest.clearAllMocks())

  it('returns ParsedEvent on successful extraction', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor: 'Acme Bank',
          product: 'Core Banking',
          event_type: 'down',
          timestamp: '2026-04-01T10:00:00Z',
        }),
      }],
    })

    const result = await EmailParserService.parse('Core Banking is down.')
    expect(result.vendor).toBe('Acme Bank')
    expect(result.product).toBe('Core Banking')
    expect(result.event_type).toBe('down')
    expect(result.timestamp).toBe('2026-04-01T10:00:00Z')
  })

  it('throws when Claude returns an error field', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ error: 'Cannot determine event type' }) }],
    })

    await expect(EmailParserService.parse('Hello world')).rejects.toThrow(
      'Email parse failed: Cannot determine event type'
    )
  })

  it('throws when Claude returns non-JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot help with that.' }],
    })

    await expect(EmailParserService.parse('junk')).rejects.toThrow()
  })

  it('calls Claude with the raw email as user message', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({ vendor: 'X', product: 'Y', event_type: 'up', timestamp: '2026-04-01T00:00:00Z' }),
      }],
    })

    await EmailParserService.parse('Service is back up.')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Service is back up.' }],
      })
    )
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/services/EmailParserService.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../../src/services/EmailParserService'`

- [ ] **Step 3: Write EmailParserService.ts**

Create `src/services/EmailParserService.ts`:
```typescript
import { getClaudeClient } from '@/lib/claude'
import type { ParsedEvent } from '@/types'

export class EmailParserService {
  static async parse(rawEmail: string): Promise<ParsedEvent> {
    const client = getClaudeClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: `You are an email parser that extracts vendor downtime information.
Return ONLY valid JSON with this exact schema — no other text:
{
  "vendor": "<company name>",
  "product": "<product or service name>",
  "event_type": "down" | "up",
  "timestamp": "<ISO 8601 UTC string>"
}
If you cannot extract the required fields, return: {"error": "<reason>"}`,
      messages: [{ role: 'user', content: rawEmail }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text)

    if ('error' in parsed) {
      throw new Error(`Email parse failed: ${parsed.error}`)
    }

    return parsed as ParsedEvent
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/services/EmailParserService.test.ts --no-coverage
```
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/EmailParserService.ts tests/services/EmailParserService.test.ts
git commit -m "feat: add EmailParserService using Claude for structured extraction"
```

---

## Task 8: ReportGenerator (TDD)

**Files:**
- Create: `tests/services/ReportGenerator.test.ts`
- Create: `src/services/ReportGenerator.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/ReportGenerator.test.ts`:
```typescript
import { ReportGenerator } from '../../src/services/ReportGenerator'
import { getClaudeClient } from '../../src/lib/claude'
import type { Outage } from '../../src/types'

jest.mock('../../src/lib/claude')

const sampleOutage: Outage = {
  id: 1,
  vendor: 'Acme Bank',
  product: 'Core Banking',
  started_at: '2026-04-01T10:00:00Z',
  resolved_at: '2026-04-01T11:00:00Z',
  duration_mins: 60,
  breach_status: 'breached',
  penalty_usd: 500,
}

describe('ReportGenerator.generate', () => {
  const mockCreate = jest.fn()

  beforeEach(() => {
    jest.mocked(getClaudeClient).mockReturnValue({
      messages: { create: mockCreate },
    } as any)
  })

  afterEach(() => jest.clearAllMocks())

  it('returns the letter string from Claude', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Dear Acme Bank, you owe $500.00...' }],
    })

    const result = await ReportGenerator.generate({
      vendor: 'Acme Bank',
      month: 4,
      year: 2026,
      outages: [sampleOutage],
      totalPenalty: 500,
    })

    expect(result).toBe('Dear Acme Bank, you owe $500.00...')
  })

  it('calls Claude exactly once', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Letter content.' }],
    })

    await ReportGenerator.generate({
      vendor: 'Acme Bank',
      month: 4,
      year: 2026,
      outages: [sampleOutage],
      totalPenalty: 500,
    })

    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('includes vendor, month, and total in the prompt', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Letter.' }],
    })

    await ReportGenerator.generate({
      vendor: 'Acme Bank',
      month: 4,
      year: 2026,
      outages: [sampleOutage],
      totalPenalty: 500,
    })

    const callArg = mockCreate.mock.calls[0][0]
    const promptText = callArg.messages[0].content as string
    expect(promptText).toContain('Acme Bank')
    expect(promptText).toContain('April 2026')
    expect(promptText).toContain('500.00')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/services/ReportGenerator.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../../src/services/ReportGenerator'`

- [ ] **Step 3: Write ReportGenerator.ts**

Create `src/services/ReportGenerator.ts`:
```typescript
import { getClaudeClient } from '@/lib/claude'
import type { Outage } from '@/types'

export class ReportGenerator {
  static async generate(params: {
    vendor: string
    month: number
    year: number
    outages: Outage[]
    totalPenalty: number
  }): Promise<string> {
    const client = getClaudeClient()
    const monthName = new Date(params.year, params.month - 1, 1)
      .toLocaleString('en-US', { month: 'long' })

    const breachLines = params.outages
      .map(
        o =>
          `- Product: ${o.product}, Duration: ${o.duration_mins} min, Penalty: $${o.penalty_usd?.toFixed(2) ?? '0.00'}`
      )
      .join('\n')

    const prompt = `Write a formal chargeback letter to ${params.vendor} for SLA breaches in ${monthName} ${params.year}.

SLA Breaches:
${breachLines}

Total penalty owed: $${params.totalPenalty.toFixed(2)}

Requirements:
- Professional business letter format
- Include [Your Company] and [Address] placeholders for sender details
- Today's date: ${new Date().toISOString().split('T')[0]}
- Itemize each breach with product name, duration, and penalty
- State total amount owed
- Payment terms: Net 30 days
- Formal closing`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/services/ReportGenerator.test.ts --no-coverage
```
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```
Expected: PASS — all test files green.

- [ ] **Step 6: Commit**

```bash
git add src/services/ReportGenerator.ts tests/services/ReportGenerator.test.ts
git commit -m "feat: add ReportGenerator using Claude for chargeback letters"
```

---

## Task 9: API Route — parse-email

**Files:**
- Create: `src/app/api/parse-email/route.ts`
- Create: `tests/api/parse-email.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/parse-email.test.ts`:
```typescript
import { POST } from '../../src/app/api/parse-email/route'
import { EmailParserService } from '../../src/services/EmailParserService'

jest.mock('../../src/services/EmailParserService')

describe('POST /api/parse-email', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns 400 when rawEmail is missing', async () => {
    const req = new Request('http://localhost/api/parse-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('returns parsed event on success', async () => {
    jest.mocked(EmailParserService.parse).mockResolvedValue({
      vendor: 'Acme',
      product: 'Core Banking',
      event_type: 'down',
      timestamp: '2026-04-01T10:00:00Z',
    })

    const req = new Request('http://localhost/api/parse-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawEmail: 'Core Banking is down.' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.vendor).toBe('Acme')
    expect(data.event_type).toBe('down')
  })

  it('returns 422 when EmailParserService throws', async () => {
    jest.mocked(EmailParserService.parse).mockRejectedValue(
      new Error('Email parse failed: insufficient info')
    )

    const req = new Request('http://localhost/api/parse-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawEmail: 'Hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error).toContain('Email parse failed')
  })
})
```

- [ ] **Step 2: Run test — verify fail**

```bash
npx jest tests/api/parse-email.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../../src/app/api/parse-email/route'`

- [ ] **Step 3: Write route handler**

Create `src/app/api/parse-email/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { EmailParserService } from '@/services/EmailParserService'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const rawEmail: unknown = body.rawEmail

  if (!rawEmail || typeof rawEmail !== 'string') {
    return NextResponse.json({ error: 'rawEmail is required' }, { status: 400 })
  }

  try {
    const event = await EmailParserService.parse(rawEmail)
    return NextResponse.json(event)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 422 }
    )
  }
}
```

- [ ] **Step 4: Run test — verify pass**

```bash
npx jest tests/api/parse-email.test.ts --no-coverage
```
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/parse-email/route.ts tests/api/parse-email.test.ts
git commit -m "feat: add POST /api/parse-email route"
```

---

## Task 10: API Route — events (GET + POST)

**Files:**
- Create: `src/app/api/events/route.ts`

- [ ] **Step 1: Write route**

Create `src/app/api/events/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  insertEvent,
  getEvents,
  insertOutage,
  getOpenOutage,
  resolveOutage,
  getSLARuleForProduct,
} from '@/lib/db'
import { SLAEngine } from '@/services/SLAEngine'

export async function GET() {
  const events = await getEvents()
  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { vendor, product, event_type, timestamp } = body
  const rawEmail: string = body.rawEmail

  if (!vendor || !product || !event_type || !timestamp || !rawEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (event_type !== 'down' && event_type !== 'up') {
    return NextResponse.json({ error: 'event_type must be down or up' }, { status: 400 })
  }

  const eventId = await insertEvent({ vendor, product, event_type, timestamp, raw_email: rawEmail })

  if (event_type === 'down') {
    const outageId = await insertOutage(vendor, product, timestamp)
    return NextResponse.json({ eventId, outageId })
  }

  // 'up' — resolve the open outage
  const openOutage = await getOpenOutage(vendor, product)
  if (!openOutage) {
    return NextResponse.json({
      eventId,
      outageId: null,
      warning: 'No open outage found for this product',
    })
  }

  const durationMins = SLAEngine.durationMins(openOutage.started_at, timestamp)
  const rule = await getSLARuleForProduct(vendor, product)

  let breachStatus = 'pending'
  let penaltyUsd: number | null = null

  if (rule) {
    const dt = new Date(openOutage.started_at)
    const result = SLAEngine.computeBreachStatus({
      totalOutageMins: durationMins,
      uptimePct: rule.uptime_pct,
      penaltyPerHr: rule.penalty_per_hr,
      month: dt.getUTCMonth() + 1,
      year: dt.getUTCFullYear(),
    })
    breachStatus = result.status
    penaltyUsd = result.status === 'breached' ? result.penalty : 0
  }

  await resolveOutage(openOutage.id, timestamp, durationMins, breachStatus, penaltyUsd)
  return NextResponse.json({ eventId, outageId: openOutage.id, breachStatus, penaltyUsd })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "feat: add GET/POST /api/events route"
```

---

## Task 11: API Routes — outages + sla-rules

**Files:**
- Create: `src/app/api/outages/route.ts`
- Create: `src/app/api/sla-rules/route.ts`
- Create: `src/app/api/sla-rules/[id]/route.ts`
- Create: `tests/api/sla-rules.test.ts`

- [ ] **Step 1: Write failing sla-rules test**

Create `tests/api/sla-rules.test.ts`:
```typescript
import { POST } from '../../src/app/api/sla-rules/route'
import * as db from '../../src/lib/db'

jest.mock('../../src/lib/db')

describe('POST /api/sla-rules', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns 400 when fields are missing', async () => {
    const req = new Request('http://localhost/api/sla-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'Acme' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when uptime_pct is out of range', async () => {
    const req = new Request('http://localhost/api/sla-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'Acme', product: 'Core', uptime_pct: 101, penalty_per_hr: 500 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when penalty_per_hr is zero', async () => {
    const req = new Request('http://localhost/api/sla-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'Acme', product: 'Core', uptime_pct: 99.9, penalty_per_hr: 0 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 with the created rule on success', async () => {
    jest.mocked(db.insertSLARule).mockResolvedValue(42)

    const req = new Request('http://localhost/api/sla-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'Acme', product: 'Core', uptime_pct: 99.9, penalty_per_hr: 500 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe(42)
    expect(data.vendor).toBe('Acme')
  })
})
```

- [ ] **Step 2: Run test — verify fail**

```bash
npx jest tests/api/sla-rules.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../../src/app/api/sla-rules/route'`

- [ ] **Step 3: Write outages route**

Create `src/app/api/outages/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getOutages } from '@/lib/db'

export async function GET() {
  const outages = await getOutages()
  return NextResponse.json(outages)
}
```

- [ ] **Step 4: Write sla-rules route**

Create `src/app/api/sla-rules/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSLARules, insertSLARule } from '@/lib/db'

export async function GET() {
  const rules = await getSLARules()
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { vendor, product, uptime_pct, penalty_per_hr } = body

  if (!vendor || !product || uptime_pct == null || penalty_per_hr == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof uptime_pct !== 'number' || uptime_pct < 0 || uptime_pct > 100) {
    return NextResponse.json({ error: 'uptime_pct must be a number between 0 and 100' }, { status: 400 })
  }
  if (typeof penalty_per_hr !== 'number' || penalty_per_hr <= 0) {
    return NextResponse.json({ error: 'penalty_per_hr must be greater than 0' }, { status: 400 })
  }

  const id = await insertSLARule({ vendor, product, uptime_pct, penalty_per_hr })
  return NextResponse.json({ id, vendor, product, uptime_pct, penalty_per_hr }, { status: 201 })
}
```

- [ ] **Step 5: Write sla-rules/[id] route**

Create `src/app/api/sla-rules/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { deleteSLARule } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  await deleteSLARule(id)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: Run sla-rules test — verify pass**

```bash
npx jest tests/api/sla-rules.test.ts --no-coverage
```
Expected: PASS — all 4 tests green.

- [ ] **Step 7: Run all tests**

```bash
npx jest --no-coverage
```
Expected: PASS — all suites green.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/outages/route.ts src/app/api/sla-rules/ tests/api/sla-rules.test.ts
git commit -m "feat: add GET /api/outages and SLA rules CRUD routes"
```

---

## Task 12: API Route — report

**Files:**
- Create: `src/app/api/report/route.ts`

- [ ] **Step 1: Write route**

Create `src/app/api/report/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getBreachedOutagesByVendorMonth } from '@/lib/db'
import { ReportGenerator } from '@/services/ReportGenerator'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { vendor, month, year } = body

  if (!vendor || !month || !year) {
    return NextResponse.json({ error: 'vendor, month, and year are required' }, { status: 400 })
  }
  if (typeof month !== 'number' || month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 })
  }

  const outages = await getBreachedOutagesByVendorMonth(vendor, month, year)
  if (outages.length === 0) {
    return NextResponse.json(
      { error: 'No breached outages found for this vendor and month' },
      { status: 404 }
    )
  }

  const totalPenalty = outages.reduce((sum, o) => sum + (o.penalty_usd ?? 0), 0)
  const letter = await ReportGenerator.generate({ vendor, month, year, outages, totalPenalty })
  return NextResponse.json({ letter })
}
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```
Expected: PASS — all suites still green.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/report/route.ts
git commit -m "feat: add POST /api/report route for chargeback letter generation"
```

---

## Task 13: Root Layout + Navigation

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css` (ensure Tailwind directives present)

- [ ] **Step 1: Verify globals.css has Tailwind directives**

Open `src/app/globals.css`. It should contain:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
If not, replace the file with these three lines.

- [ ] **Step 2: Write layout.tsx**

Replace `src/app/layout.tsx` with:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SLA Breach Tracker',
  description: 'Track vendor SLA breaches and generate chargeback reports',
}

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/inbox', label: 'Email Inbox' },
  { href: '/sla-config', label: 'SLA Config' },
  { href: '/breach-log', label: 'Breach Log' },
  { href: '/report', label: 'Reports' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <nav className="w-56 shrink-0 bg-gray-900 text-white p-4 flex flex-col gap-1">
            <div className="text-lg font-bold mb-4 px-3 text-blue-400">SLA Tracker</div>
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 bg-gray-50 min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: add root layout with sidebar navigation"
```

---

## Task 14: Summary Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write dashboard page**

Replace `src/app/page.tsx` with:
```tsx
import { getOutages } from '@/lib/db'

function StatCard({
  title,
  value,
  colorClass,
}: {
  title: string
  value: string | number
  colorClass: string
}) {
  return (
    <div className={`rounded-lg p-6 text-white shadow-sm ${colorClass}`}>
      <div className="text-sm font-medium opacity-80">{title}</div>
      <div className="text-3xl font-bold mt-2 truncate">{value}</div>
    </div>
  )
}

export default async function DashboardPage() {
  const outages = await getOutages()

  const now = new Date()
  const currentMonth = now.getUTCMonth() + 1
  const currentYear = now.getUTCFullYear()

  const activeOutages = outages.filter(o => !o.resolved_at)

  const thisMonthOutages = outages.filter(o => {
    const d = new Date(o.started_at)
    return (
      d.getUTCMonth() + 1 === currentMonth &&
      d.getUTCFullYear() === currentYear
    )
  })

  const totalPenalties = thisMonthOutages.reduce(
    (sum, o) => sum + (o.penalty_usd ?? 0),
    0
  )

  const vendorPenalties: Record<string, number> = {}
  thisMonthOutages.forEach(o => {
    vendorPenalties[o.vendor] = (vendorPenalties[o.vendor] ?? 0) + (o.penalty_usd ?? 0)
  })
  const topVendor =
    Object.entries(vendorPenalties).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None'

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Active Outages"
          value={activeOutages.length}
          colorClass="bg-yellow-500"
        />
        <StatCard
          title="Penalties This Month"
          value={`$${totalPenalties.toFixed(2)}`}
          colorClass="bg-red-500"
        />
        <StatCard
          title="Top Offending Vendor"
          value={topVendor}
          colorClass="bg-orange-500"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add summary dashboard with active outages and penalty stats"
```

---

## Task 15: Inbox Page

**Files:**
- Create: `src/app/inbox/page.tsx`

- [ ] **Step 1: Write inbox page**

Create `src/app/inbox/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { ParsedEvent } from '@/types'

export default function InboxPage() {
  const [rawEmail, setRawEmail] = useState('')
  const [parsed, setParsed] = useState<ParsedEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleParse() {
    if (!rawEmail.trim()) return
    setParsing(true)
    setError(null)
    setParsed(null)
    try {
      const res = await fetch('/api/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setParsed(data as ParsedEvent)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!parsed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed, rawEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      let msg: string
      if (data.warning) {
        msg = `Saved. Warning: ${data.warning}`
      } else if (data.breachStatus === 'breached') {
        msg = `Outage resolved. BREACH DETECTED. Penalty: $${(data.penaltyUsd as number)?.toFixed(2)}`
      } else if (data.breachStatus === 'within') {
        msg = 'Outage resolved. Within SLA.'
      } else if (parsed.event_type === 'down') {
        msg = 'New outage opened.'
      } else {
        msg = 'Event saved.'
      }

      setToast(msg)
      setRawEmail('')
      setParsed(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Email Inbox</h1>

      {toast && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 rounded text-green-800 flex justify-between items-start">
          <span>{toast}</span>
          <button
            className="ml-3 text-green-600 hover:text-green-800"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      )}

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Paste raw vendor email
      </label>
      <textarea
        className="w-full h-48 p-3 border border-gray-300 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
        placeholder="Paste the full email text here..."
        value={rawEmail}
        onChange={e => setRawEmail(e.target.value)}
      />

      <button
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        onClick={handleParse}
        disabled={parsing || !rawEmail.trim()}
      >
        {parsing ? 'Parsing...' : 'Parse Email'}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-100 border border-red-400 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {parsed && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded shadow-sm">
          <h2 className="font-semibold mb-3 text-gray-700">Parsed Result</h2>
          <table className="text-sm w-full mb-3">
            <tbody>
              <tr>
                <td className="text-gray-500 pr-4 py-1 w-24">Vendor</td>
                <td className="font-medium">{parsed.vendor}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-1">Product</td>
                <td className="font-medium">{parsed.product}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-1">Event</td>
                <td className={`font-bold ${parsed.event_type === 'down' ? 'text-red-600' : 'text-green-600'}`}>
                  {parsed.event_type.toUpperCase()}
                </td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-1">Timestamp</td>
                <td className="font-medium">{new Date(parsed.timestamp).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Log Event'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/inbox/page.tsx
git commit -m "feat: add email inbox page with parse-then-confirm flow"
```

---

## Task 16: SLA Config Page

**Files:**
- Create: `src/app/sla-config/page.tsx`

- [ ] **Step 1: Write SLA config page**

Create `src/app/sla-config/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import type { SLARule } from '@/types'

export default function SLAConfigPage() {
  const [rules, setRules] = useState<SLARule[]>([])
  const [form, setForm] = useState({
    vendor: '',
    product: '',
    uptime_pct: '',
    penalty_per_hr: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function loadRules() {
    const res = await fetch('/api/sla-rules')
    const data = await res.json()
    setRules(data as SLARule[])
  }

  useEffect(() => { loadRules() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/sla-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: form.vendor,
          product: form.product,
          uptime_pct: parseFloat(form.uptime_pct),
          penalty_per_hr: parseFloat(form.penalty_per_hr),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error as string); return }
      setForm({ vendor: '', product: '', uptime_pct: '', penalty_per_hr: '' })
      await loadRules()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/sla-rules/${id}`, { method: 'DELETE' })
    await loadRules()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">SLA Configuration</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Vendor', 'Product', 'Uptime %', 'Penalty / hr', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No SLA rules defined yet.
                </td>
              </tr>
            )}
            {rules.map(rule => (
              <tr key={rule.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">{rule.vendor}</td>
                <td className="px-4 py-3">{rule.product}</td>
                <td className="px-4 py-3">{rule.uptime_pct}%</td>
                <td className="px-4 py-3">${rule.penalty_per_hr.toFixed(2)}/hr</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 max-w-lg">
        <h2 className="font-semibold mb-4 text-gray-700">Add SLA Rule</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm col-span-1"
            placeholder="Vendor name"
            value={form.vendor}
            onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
            required
          />
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm col-span-1"
            placeholder="Product name"
            value={form.product}
            onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
            required
          />
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm col-span-1"
            type="number"
            step="0.001"
            min="0"
            max="100"
            placeholder="Uptime % (e.g. 99.9)"
            value={form.uptime_pct}
            onChange={e => setForm(f => ({ ...f, uptime_pct: e.target.value }))}
            required
          />
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm col-span-1"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Penalty per hour ($)"
            value={form.penalty_per_hr}
            onChange={e => setForm(f => ({ ...f, penalty_per_hr: e.target.value }))}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? 'Saving...' : 'Save Rule'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/sla-config/page.tsx
git commit -m "feat: add SLA config page with rules table and add form"
```

---

## Task 17: Breach Log Page

**Files:**
- Create: `src/app/breach-log/page.tsx`

- [ ] **Step 1: Write breach log page**

Create `src/app/breach-log/page.tsx`:
```tsx
import { getOutages } from '@/lib/db'
import type { Outage } from '@/types'

function StatusBadge({ status }: { status: Outage['breach_status'] }) {
  const styles: Record<NonNullable<Outage['breach_status']>, string> = {
    within: 'bg-green-100 text-green-700',
    breached: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }
  const s = status ?? 'pending'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[s]}`}>
      {s.toUpperCase()}
    </span>
  )
}

function formatDuration(mins: number | null, resolvedAt: string | null): string {
  if (!resolvedAt) return 'Ongoing'
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default async function BreachLogPage() {
  const outages = await getOutages()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Breach Log</h1>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Vendor', 'Product', 'Start', 'End', 'Duration', 'Status', 'Penalty'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outages.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No outages logged yet.
                </td>
              </tr>
            )}
            {outages.map(o => (
              <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{o.vendor}</td>
                <td className="px-4 py-3">{o.product}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(o.started_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {o.resolved_at ? (
                    new Date(o.resolved_at).toLocaleString()
                  ) : (
                    <span className="text-yellow-600 font-medium">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDuration(o.duration_mins, o.resolved_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.breach_status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {o.penalty_usd != null ? `$${o.penalty_usd.toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/breach-log/page.tsx
git commit -m "feat: add breach log page with color-coded status badges"
```

---

## Task 18: Report Page

**Files:**
- Create: `src/app/report/page.tsx`

- [ ] **Step 1: Write report page**

Create `src/app/report/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import type { Outage } from '@/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ReportPage() {
  const [vendors, setVendors] = useState<string[]>([])
  const [vendor, setVendor] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [letter, setLetter] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/outages')
      .then(r => r.json())
      .then((data: Outage[]) => {
        const unique = [...new Set(data.map(o => o.vendor))].sort()
        setVendors(unique)
        if (unique.length > 0) setVendor(unique[0])
      })
  }, [])

  async function handleGenerate() {
    if (!vendor) return
    setLoading(true)
    setError(null)
    setLetter(null)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor, month, year }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error as string)
      setLetter(data.letter as string)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!letter) return
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExportPDF() {
    if (!letter) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFont('courier', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(letter, 180)
    doc.text(lines, 15, 20)
    doc.save(
      `chargeback-${vendor.replace(/\s+/g, '-')}-${year}-${String(month).padStart(2, '0')}.pdf`
    )
  }

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear]

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Monthly Report</h1>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Vendor</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px]"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
            >
              {vendors.length === 0 && <option value="">No vendors</option>}
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              value={month}
              onChange={e => setMonth(parseInt(e.target.value, 10))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              value={year}
              onChange={e => setYear(parseInt(e.target.value, 10))}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            onClick={handleGenerate}
            disabled={loading || !vendor}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 rounded text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {letter && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <span className="font-semibold text-gray-700 text-sm">Chargeback Letter</span>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleExportPDF}
                className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-900"
              >
                Export PDF
              </button>
            </div>
          </div>
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap text-gray-700 max-h-[500px] overflow-y-auto">
            {letter}
          </pre>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/report/page.tsx
git commit -m "feat: add monthly report page with vendor/month selection and PDF export"
```

---

## Task 19: Instrumentation + Final Wiring

**Files:**
- Create: `src/instrumentation.ts`
- Verify: `next.config.ts` (already done in Task 1)

- [ ] **Step 1: Write instrumentation.ts**

Create `src/instrumentation.ts`:
```typescript
export async function register() {
  // Only run migrations in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { migrate } = await import('./lib/db')
    await migrate()
  }
}
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```
Expected: PASS — all suites green.

- [ ] **Step 3: Build the app**

```bash
npm run build
```
Expected: Build completes with no errors. You may see a warning about `params` being async in `[id]/route.ts` — this is acceptable in Next.js 14.

- [ ] **Step 4: Smoke test locally**

```bash
npm run dev
```
Open `http://localhost:3000`. Verify:
- Sidebar nav renders with all 5 links
- Dashboard shows 3 stat cards (all zeros, no data yet)
- Inbox page shows textarea and Parse button
- SLA Config shows empty rules table and add form
- Breach Log shows empty table
- Report page shows vendor/month/year selectors

- [ ] **Step 5: Final commit**

```bash
git add src/instrumentation.ts
git commit -m "feat: add instrumentation.ts to run DB migrations on server startup"
```

---

## Task 20: Vercel Deployment Setup

**Files:**
- No code changes — configuration only

- [ ] **Step 1: Create Turso database**

If not already done:
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up / log in
turso auth login

# Create database
turso db create sla-breach-tracker

# Get connection URL
turso db show sla-breach-tracker --url

# Create auth token
turso db tokens create sla-breach-tracker
```

- [ ] **Step 2: Update .env.local with Turso credentials**

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
TURSO_DATABASE_URL=libsql://sla-breach-tracker-<your-org>.turso.io
TURSO_AUTH_TOKEN=eyJ...
```

- [ ] **Step 3: Push to GitHub and deploy to Vercel**

```bash
git remote add origin https://github.com/<your-username>/sla-breach-tracker.git
git push -u origin main
```

Then in Vercel dashboard:
1. Import the GitHub repo
2. Add environment variables: `ANTHROPIC_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
3. Deploy

- [ ] **Step 4: Verify deployed app**

Open the Vercel URL. Navigate to each page. Log a test email via the inbox to confirm end-to-end flow.

---

## Spec Coverage Checklist

| Feature | Task(s) |
|---------|---------|
| Email paste inbox → Claude parse → confirm → save | T9, T10, T15 |
| SLA rules CRUD | T11, T16 |
| Breach log with status/penalty | T4 (db), T6 (SLAEngine), T10, T17 |
| Monthly report generation | T8, T12, T18 |
| Summary dashboard (3 stat cards) | T14 |
| jsPDF export | T18 |
| Copy to clipboard | T18 |
| Turso DB (not better-sqlite3) | T4 |
| API keys in .env.local | T1 |
| Outage pairing (latest unresolved) | T4 (`getOpenOutage`), T10 |
| Active outage shown as ongoing | T17 |
| No auth | — (by omission) |
