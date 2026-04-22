import { neon } from '@neondatabase/serverless'
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption'
import type { RawEvent, Outage, SLARule, Bank, Product, EmailAccount, PollLogEntry } from '@/types'

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

export async function migrate(): Promise<void> {
  const sql = getDb()

  await sql`
    CREATE TABLE IF NOT EXISTS banks (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE,
      email_alias  TEXT NOT NULL UNIQUE,
      access_token TEXT UNIQUE,
      created_at   TEXT NOT NULL DEFAULT (NOW()::text)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id          SERIAL PRIMARY KEY,
      bank_id     INTEGER REFERENCES banks(id),
      vendor      TEXT NOT NULL,
      product     TEXT NOT NULL,
      event_type  TEXT NOT NULL CHECK(event_type IN ('down', 'up')),
      timestamp   TEXT NOT NULL,
      raw_email   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (NOW()::text)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS outages (
      id            SERIAL PRIMARY KEY,
      bank_id       INTEGER REFERENCES banks(id),
      vendor        TEXT NOT NULL,
      product       TEXT NOT NULL,
      started_at    TEXT NOT NULL,
      resolved_at   TEXT,
      duration_mins INTEGER,
      breach_status TEXT DEFAULT 'pending' CHECK(breach_status IN ('within', 'breached', 'pending')),
      penalty_usd   FLOAT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sla_rules (
      id             SERIAL PRIMARY KEY,
      bank_id        INTEGER REFERENCES banks(id),
      vendor         TEXT NOT NULL,
      product        TEXT NOT NULL,
      uptime_pct     FLOAT NOT NULL,
      penalty_per_hr FLOAT NOT NULL,
      UNIQUE(bank_id, vendor, product)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE,
      domains      TEXT NOT NULL,
      access_token TEXT UNIQUE,
      created_at   TEXT NOT NULL DEFAULT (NOW()::text)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id         SERIAL PRIMARY KEY,
      vendor     TEXT NOT NULL,
      name       TEXT NOT NULL,
      category   TEXT NOT NULL DEFAULT 'core' CHECK(category IN ('core','mobile','web','api','other')),
      created_at TEXT NOT NULL DEFAULT (NOW()::text),
      UNIQUE(vendor, name)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS email_accounts (
      id         SERIAL PRIMARY KEY,
      label      TEXT NOT NULL,
      host       TEXT NOT NULL,
      port       INTEGER NOT NULL DEFAULT 993,
      tls        BOOLEAN NOT NULL DEFAULT true,
      username   TEXT NOT NULL,
      password   TEXT NOT NULL,
      mailbox    TEXT NOT NULL DEFAULT 'INBOX',
      last_uid   INTEGER NOT NULL DEFAULT 0,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS email_poll_log (
      id             SERIAL PRIMARY KEY,
      account_id     INTEGER NOT NULL,
      message_uid    INTEGER,
      subject        TEXT,
      sender         TEXT,
      matched_vendor TEXT,
      status         TEXT NOT NULL CHECK(status IN ('processed','skipped','error','duplicate')),
      error_msg      TEXT,
      event_id       INTEGER,
      processed_at   TEXT NOT NULL DEFAULT (NOW()::text)
    )
  `
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
  const sql = getDb()
  const rows = await sql`
    INSERT INTO events (bank_id, vendor, product, event_type, timestamp, raw_email)
    VALUES (${event.bank_id}, ${event.vendor}, ${event.product}, ${event.event_type}, ${event.timestamp}, ${event.raw_email})
    RETURNING id
  `
  return rows[0].id as number
}

export async function getEvents(): Promise<RawEvent[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM events ORDER BY created_at DESC`
  return rows as unknown as RawEvent[]
}

// ── Outages ───────────────────────────────────────────────────────────────────

export async function insertOutage(
  bankId: number,
  vendor: string,
  product: string,
  startedAt: string
): Promise<number> {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO outages (bank_id, vendor, product, started_at, breach_status)
    VALUES (${bankId}, ${vendor}, ${product}, ${startedAt}, 'pending')
    RETURNING id
  `
  return rows[0].id as number
}

export async function getOpenOutage(
  bankId: number,
  vendor: string,
  product: string
): Promise<Outage | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM outages
    WHERE bank_id = ${bankId} AND vendor = ${vendor} AND product = ${product} AND resolved_at IS NULL
    ORDER BY started_at DESC LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as unknown as Outage) : null
}

export async function resolveOutage(
  id: number,
  resolvedAt: string,
  durationMins: number,
  breachStatus: string,
  penaltyUsd: number | null
): Promise<void> {
  const sql = getDb()
  await sql`
    UPDATE outages
    SET resolved_at = ${resolvedAt}, duration_mins = ${durationMins},
        breach_status = ${breachStatus}, penalty_usd = ${penaltyUsd}
    WHERE id = ${id}
  `
}

export async function getOutages(): Promise<Outage[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM outages ORDER BY started_at DESC`
  return rows as unknown as Outage[]
}

export async function getOutagesByBank(bankId: number): Promise<Outage[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM outages WHERE bank_id = ${bankId} ORDER BY started_at DESC
  `
  return rows as unknown as Outage[]
}

export async function getResolvedOutageMinsForMonth(
  bankId: number,
  vendor: string,
  product: string,
  month: number,
  year: number
): Promise<number> {
  const sql = getDb()
  const rows = await sql`
    SELECT COALESCE(SUM(duration_mins), 0) AS total
    FROM outages
    WHERE bank_id = ${bankId}
      AND vendor = ${vendor}
      AND product = ${product}
      AND resolved_at IS NOT NULL
      AND EXTRACT(MONTH FROM started_at::timestamp) = ${month}
      AND EXTRACT(YEAR FROM started_at::timestamp) = ${year}
  `
  return Number((rows[0] as { total: string | number }).total)
}

export async function getBreachedOutagesByVendorMonth(
  bankId: number,
  vendor: string,
  month: number,
  year: number
): Promise<Outage[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM outages
    WHERE bank_id = ${bankId}
      AND vendor = ${vendor}
      AND breach_status = 'breached'
      AND EXTRACT(MONTH FROM started_at::timestamp) = ${month}
      AND EXTRACT(YEAR FROM started_at::timestamp) = ${year}
  `
  return rows as unknown as Outage[]
}

// ── SLA Rules ─────────────────────────────────────────────────────────────────

export async function insertSLARule(rule: {
  bank_id: number
  vendor: string
  product: string
  uptime_pct: number
  penalty_per_hr: number
}): Promise<number> {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO sla_rules (bank_id, vendor, product, uptime_pct, penalty_per_hr)
    VALUES (${rule.bank_id}, ${rule.vendor}, ${rule.product}, ${rule.uptime_pct}, ${rule.penalty_per_hr})
    RETURNING id
  `
  return rows[0].id as number
}

export async function getSLARules(): Promise<SLARule[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM sla_rules ORDER BY vendor, product`
  return rows as unknown as SLARule[]
}

export async function getSLARulesByBank(bankId: number): Promise<SLARule[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM sla_rules WHERE bank_id = ${bankId} ORDER BY vendor, product
  `
  return rows as unknown as SLARule[]
}

export async function getSLARuleForProduct(
  bankId: number,
  vendor: string,
  product: string
): Promise<SLARule | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM sla_rules
    WHERE bank_id = ${bankId} AND vendor = ${vendor} AND product = ${product}
    LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as unknown as SLARule) : null
}

export async function deleteSLARule(id: number): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM sla_rules WHERE id = ${id}`
}

// ── Banks ─────────────────────────────────────────────────────────────────────

export async function insertBank(name: string, emailAlias: string): Promise<number> {
  const sql = getDb()
  const token = crypto.randomUUID()
  const rows = await sql`
    INSERT INTO banks (name, email_alias, access_token)
    VALUES (${name}, ${emailAlias.toLowerCase().trim()}, ${token})
    RETURNING id
  `
  return rows[0].id as number
}

export async function getBanks(): Promise<Bank[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM banks ORDER BY name`
  return rows as unknown as Bank[]
}

export async function getBankByToken(token: string): Promise<Bank | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM banks WHERE access_token = ${token} LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as unknown as Bank) : null
}

export async function getBankByAlias(alias: string): Promise<Bank | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM banks WHERE email_alias = ${alias.toLowerCase().trim()} LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as unknown as Bank) : null
}

export async function regenerateBankToken(id: number): Promise<string> {
  const sql = getDb()
  const token = crypto.randomUUID()
  await sql`UPDATE banks SET access_token = ${token} WHERE id = ${id}`
  return token
}

export async function updateBank(id: number, name: string, emailAlias: string): Promise<void> {
  const sql = getDb()
  await sql`
    UPDATE banks SET name = ${name}, email_alias = ${emailAlias.toLowerCase().trim()}
    WHERE id = ${id}
  `
}

export async function deleteBank(id: number): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM banks WHERE id = ${id}`
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function insertProduct(vendor: string, name: string, category: string): Promise<number> {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO products (vendor, name, category) VALUES (${vendor}, ${name}, ${category})
    RETURNING id
  `
  return rows[0].id as number
}

export async function getProducts(): Promise<Product[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM products ORDER BY vendor, name`
  return rows as unknown as Product[]
}

export async function getProductsByVendor(vendor: string): Promise<Product[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM products WHERE vendor = ${vendor} ORDER BY name
  `
  return rows as unknown as Product[]
}

export async function deleteProduct(id: number): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM products WHERE id = ${id}`
}

// ── Email Accounts ────────────────────────────────────────────────────────────

export async function insertEmailAccount(
  label: string, host: string, port: number, tls: boolean,
  username: string, password: string, mailbox: string
): Promise<number> {
  const sql = getDb()
  const encryptedPassword = encrypt(password)
  const rows = await sql`
    INSERT INTO email_accounts (label, host, port, tls, username, password, mailbox)
    VALUES (${label}, ${host}, ${port}, ${tls}, ${username}, ${encryptedPassword}, ${mailbox})
    RETURNING id
  `
  return rows[0].id as number
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
  const sql = getDb()
  const rows = await sql`SELECT * FROM email_accounts ORDER BY label`
  return (rows as unknown as (EmailAccount & { password: string })[]).map(decryptAccount)
}

export async function getEmailAccountById(id: number): Promise<(EmailAccount & { password: string }) | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM email_accounts WHERE id = ${id}`
  if (rows.length === 0) return null
  return decryptAccount(rows[0] as unknown as EmailAccount & { password: string })
}

export async function updateEmailAccountLastUid(id: number, lastUid: number): Promise<void> {
  const sql = getDb()
  await sql`UPDATE email_accounts SET last_uid = ${lastUid} WHERE id = ${id}`
}

export async function deleteEmailAccount(id: number): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM email_accounts WHERE id = ${id}`
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
  const sql = getDb()
  await sql`
    INSERT INTO email_poll_log
      (account_id, message_uid, subject, sender, matched_vendor, status, error_msg, event_id)
    VALUES (
      ${entry.accountId}, ${entry.messageUid ?? null}, ${entry.subject ?? null},
      ${entry.sender ?? null}, ${entry.matchedVendor ?? null}, ${entry.status},
      ${entry.errorMsg ?? null}, ${entry.eventId ?? null}
    )
  `
}

export async function getPollLog(limit = 50, status?: string): Promise<PollLogEntry[]> {
  const sql = getDb()
  if (status) {
    const rows = await sql`
      SELECT * FROM email_poll_log WHERE status = ${status}
      ORDER BY processed_at DESC LIMIT ${limit}
    `
    return rows as unknown as PollLogEntry[]
  }
  const rows = await sql`
    SELECT * FROM email_poll_log ORDER BY processed_at DESC LIMIT ${limit}
  `
  return rows as unknown as PollLogEntry[]
}
