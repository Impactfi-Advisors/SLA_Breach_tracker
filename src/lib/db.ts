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
