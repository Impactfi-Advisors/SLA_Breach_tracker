import { createClient, Client } from '@libsql/client'
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption'
import type { RawEvent, Outage, SLARule, Bank, Product, EmailAccount, PollLogEntry } from '@/types'

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
    CREATE TABLE IF NOT EXISTS banks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL UNIQUE,
      email_alias  TEXT NOT NULL UNIQUE,
      access_token TEXT UNIQUE,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id     INTEGER REFERENCES banks(id),
      vendor      TEXT NOT NULL,
      product     TEXT NOT NULL,
      event_type  TEXT NOT NULL CHECK(event_type IN ('down', 'up')),
      timestamp   TEXT NOT NULL,
      raw_email   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS outages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id       INTEGER REFERENCES banks(id),
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
      bank_id         INTEGER REFERENCES banks(id),
      vendor          TEXT NOT NULL,
      product         TEXT NOT NULL,
      uptime_pct      REAL NOT NULL,
      penalty_per_hr  REAL NOT NULL,
      UNIQUE(bank_id, vendor, product)
    );
    CREATE TABLE IF NOT EXISTS companies (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL UNIQUE,
      domains      TEXT NOT NULL,
      access_token TEXT UNIQUE,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor     TEXT NOT NULL,
      name       TEXT NOT NULL,
      category   TEXT NOT NULL DEFAULT 'core' CHECK(category IN ('core','mobile','web','api','other')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(vendor, name)
    );
    CREATE TABLE IF NOT EXISTS email_accounts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT NOT NULL,
      host       TEXT NOT NULL,
      port       INTEGER NOT NULL DEFAULT 993,
      tls        INTEGER NOT NULL DEFAULT 1,
      username   TEXT NOT NULL,
      password   TEXT NOT NULL,
      mailbox    TEXT NOT NULL DEFAULT 'INBOX',
      last_uid   INTEGER NOT NULL DEFAULT 0,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS email_poll_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id     INTEGER NOT NULL,
      message_uid    INTEGER,
      subject        TEXT,
      sender         TEXT,
      matched_vendor TEXT,
      status         TEXT NOT NULL CHECK(status IN ('processed','skipped','error','duplicate')),
      error_msg      TEXT,
      event_id       INTEGER,
      processed_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Additive migrations for existing installations
  const migrations = [
    'ALTER TABLE companies ADD COLUMN access_token TEXT UNIQUE',
    'ALTER TABLE events ADD COLUMN bank_id INTEGER REFERENCES banks(id)',
    'ALTER TABLE outages ADD COLUMN bank_id INTEGER REFERENCES banks(id)',
    'ALTER TABLE sla_rules ADD COLUMN bank_id INTEGER REFERENCES banks(id)',
  ]
  for (const sql of migrations) {
    try { await db.execute(sql) } catch { /* column already exists */ }
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function insertEvent(event: {
  bank_id: number
  vendor: string
  product: string
  event_type: 'down' | 'up'
  timestamp: string
  raw_email: string
}): Promise<number> {
  const db = getDb()
  const result = await db.execute({
    sql: `INSERT INTO events (bank_id, vendor, product, event_type, timestamp, raw_email)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [event.bank_id, event.vendor, event.product, event.event_type, event.timestamp, event.raw_email],
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
  bankId: number,
  vendor: string,
  product: string,
  startedAt: string
): Promise<number> {
  const db = getDb()
  const result = await db.execute({
    sql: `INSERT INTO outages (bank_id, vendor, product, started_at, breach_status)
          VALUES (?, ?, ?, ?, 'pending')`,
    args: [bankId, vendor, product, startedAt],
  })
  return Number(result.lastInsertRowid)
}

export async function getOpenOutage(
  bankId: number,
  vendor: string,
  product: string
): Promise<Outage | null> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT * FROM outages
          WHERE bank_id = ? AND vendor = ? AND product = ? AND resolved_at IS NULL
          ORDER BY started_at DESC LIMIT 1`,
    args: [bankId, vendor, product],
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

export async function getOutagesByBank(bankId: number): Promise<Outage[]> {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM outages WHERE bank_id = ? ORDER BY started_at DESC',
    args: [bankId],
  })
  return result.rows as unknown as Outage[]
}

export async function getResolvedOutageMinsForMonth(
  bankId: number,
  vendor: string,
  product: string,
  month: number,
  year: number
): Promise<number> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT COALESCE(SUM(duration_mins), 0) AS total
          FROM outages
          WHERE bank_id = ?
            AND vendor = ?
            AND product = ?
            AND resolved_at IS NOT NULL
            AND strftime('%m', started_at) = ?
            AND strftime('%Y', started_at) = ?`,
    args: [bankId, vendor, product, String(month).padStart(2, '0'), String(year)],
  })
  return Number((result.rows[0] as unknown as { total: number }).total)
}

export async function getBreachedOutagesByVendorMonth(
  bankId: number,
  vendor: string,
  month: number,
  year: number
): Promise<Outage[]> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT * FROM outages
          WHERE bank_id = ?
            AND vendor = ?
            AND breach_status = 'breached'
            AND strftime('%m', started_at) = ?
            AND strftime('%Y', started_at) = ?`,
    args: [bankId, vendor, String(month).padStart(2, '0'), String(year)],
  })
  return result.rows as unknown as Outage[]
}

// ── SLA Rules ─────────────────────────────────────────────────────────────────

export async function insertSLARule(rule: {
  bank_id: number
  vendor: string
  product: string
  uptime_pct: number
  penalty_per_hr: number
}): Promise<number> {
  const db = getDb()
  const result = await db.execute({
    sql: `INSERT INTO sla_rules (bank_id, vendor, product, uptime_pct, penalty_per_hr)
          VALUES (?, ?, ?, ?, ?)`,
    args: [rule.bank_id, rule.vendor, rule.product, rule.uptime_pct, rule.penalty_per_hr],
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

export async function getSLARulesByBank(bankId: number): Promise<SLARule[]> {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM sla_rules WHERE bank_id = ? ORDER BY vendor, product',
    args: [bankId],
  })
  return result.rows as unknown as SLARule[]
}

export async function getSLARuleForProduct(
  bankId: number,
  vendor: string,
  product: string
): Promise<SLARule | null> {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM sla_rules WHERE bank_id = ? AND vendor = ? AND product = ? LIMIT 1',
    args: [bankId, vendor, product],
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

// ── Banks ─────────────────────────────────────────────────────────────────────

export async function insertBank(name: string, emailAlias: string): Promise<number> {
  const db = getDb()
  const token = crypto.randomUUID()
  const result = await db.execute({
    sql: 'INSERT INTO banks (name, email_alias, access_token) VALUES (?, ?, ?)',
    args: [name, emailAlias.toLowerCase().trim(), token],
  })
  return Number(result.lastInsertRowid)
}

export async function getBanks(): Promise<Bank[]> {
  const db = getDb()
  const result = await db.execute('SELECT * FROM banks ORDER BY name')
  return result.rows as unknown as Bank[]
}

export async function getBankByToken(token: string): Promise<Bank | null> {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM banks WHERE access_token = ? LIMIT 1',
    args: [token],
  })
  return result.rows.length > 0 ? (result.rows[0] as unknown as Bank) : null
}

export async function getBankByAlias(alias: string): Promise<Bank | null> {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM banks WHERE email_alias = ? LIMIT 1',
    args: [alias.toLowerCase().trim()],
  })
  return result.rows.length > 0 ? (result.rows[0] as unknown as Bank) : null
}

export async function regenerateBankToken(id: number): Promise<string> {
  const db = getDb()
  const token = crypto.randomUUID()
  await db.execute({
    sql: 'UPDATE banks SET access_token = ? WHERE id = ?',
    args: [token, id],
  })
  return token
}

export async function updateBank(id: number, name: string, emailAlias: string): Promise<void> {
  const db = getDb()
  await db.execute({
    sql: 'UPDATE banks SET name = ?, email_alias = ? WHERE id = ?',
    args: [name, emailAlias.toLowerCase().trim(), id],
  })
}

export async function deleteBank(id: number): Promise<void> {
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM banks WHERE id = ?', args: [id] })
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function insertProduct(vendor: string, name: string, category: string): Promise<number> {
  const db = getDb()
  const result = await db.execute({
    sql: 'INSERT INTO products (vendor, name, category) VALUES (?, ?, ?)',
    args: [vendor, name, category],
  })
  return Number(result.lastInsertRowid)
}

export async function getProducts(): Promise<Product[]> {
  const db = getDb()
  const result = await db.execute('SELECT * FROM products ORDER BY vendor, name')
  return result.rows as unknown as Product[]
}

export async function getProductsByVendor(vendor: string): Promise<Product[]> {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM products WHERE vendor = ? ORDER BY name',
    args: [vendor],
  })
  return result.rows as unknown as Product[]
}

export async function deleteProduct(id: number): Promise<void> {
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [id] })
}

// ── Email Accounts ────────────────────────────────────────────────────────────

export async function insertEmailAccount(
  label: string, host: string, port: number, tls: boolean,
  username: string, password: string, mailbox: string
): Promise<number> {
  const db = getDb()
  const encryptedPassword = encrypt(password)
  const result = await db.execute({
    sql: `INSERT INTO email_accounts (label, host, port, tls, username, password, mailbox)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [label, host, port, tls ? 1 : 0, username, encryptedPassword, mailbox],
  })
  return Number(result.lastInsertRowid)
}

function decryptAccount(row: EmailAccount & { password: string }): EmailAccount & { password: string } {
  try {
    const pwd = isEncrypted(row.password) ? decrypt(row.password) : row.password
    return { ...row, password: pwd }
  } catch {
    return row
  }
}

export async function getEmailAccounts(): Promise<(EmailAccount & { password: string })[]> {
  const db = getDb()
  const result = await db.execute('SELECT * FROM email_accounts ORDER BY label')
  return (result.rows as unknown as (EmailAccount & { password: string })[]).map(decryptAccount)
}

export async function getEmailAccountById(id: number): Promise<(EmailAccount & { password: string }) | null> {
  const db = getDb()
  const result = await db.execute({ sql: 'SELECT * FROM email_accounts WHERE id = ?', args: [id] })
  if (result.rows.length === 0) return null
  return decryptAccount(result.rows[0] as unknown as EmailAccount & { password: string })
}

export async function updateEmailAccountLastUid(id: number, lastUid: number): Promise<void> {
  const db = getDb()
  await db.execute({ sql: 'UPDATE email_accounts SET last_uid = ? WHERE id = ?', args: [lastUid, id] })
}

export async function deleteEmailAccount(id: number): Promise<void> {
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM email_accounts WHERE id = ?', args: [id] })
}

// ── Poll Log ──────────────────────────────────────────────────────────────────

export async function insertPollLog(entry: {
  accountId: number
  messageUid?: number | null
  subject?: string | null
  sender?: string | null
  matchedVendor?: string | null
  status: 'processed' | 'skipped' | 'error' | 'duplicate'
  errorMsg?: string | null
  eventId?: number | null
}): Promise<void> {
  const db = getDb()
  await db.execute({
    sql: `INSERT INTO email_poll_log
          (account_id, message_uid, subject, sender, matched_vendor, status, error_msg, event_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.accountId,
      entry.messageUid ?? null,
      entry.subject ?? null,
      entry.sender ?? null,
      entry.matchedVendor ?? null,
      entry.status,
      entry.errorMsg ?? null,
      entry.eventId ?? null,
    ],
  })
}

export async function getPollLog(limit = 50, status?: string): Promise<PollLogEntry[]> {
  const db = getDb()
  if (status) {
    const result = await db.execute({
      sql: 'SELECT * FROM email_poll_log WHERE status = ? ORDER BY processed_at DESC LIMIT ?',
      args: [status, limit],
    })
    return result.rows as unknown as PollLogEntry[]
  }
  const result = await db.execute({
    sql: 'SELECT * FROM email_poll_log ORDER BY processed_at DESC LIMIT ?',
    args: [limit],
  })
  return result.rows as unknown as PollLogEntry[]
}
