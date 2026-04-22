export interface ParsedEvent {
  vendor: string
  product: string
  event_type: 'down' | 'up'
  timestamp: string // ISO 8601 UTC
}

export interface RawEvent extends ParsedEvent {
  id: number
  bank_id: number | null
  raw_email: string
  created_at: string
}

export interface Outage {
  id: number
  bank_id: number | null
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
  bank_id: number | null
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

export interface Bank {
  id: number
  name: string
  email_alias: string    // e.g. "firstnational" → sla+firstnational@impactfiadvisors.com
  access_token: string | null
  created_at: string
}

export interface Product {
  id: number
  vendor: string
  name: string
  category: 'core' | 'mobile' | 'web' | 'api' | 'other'
  created_at: string
}

export interface EmailAccount {
  id: number
  label: string
  host: string
  port: number
  tls: number
  username: string
  // password intentionally omitted from UI type
  mailbox: string
  last_uid: number
  active: number
  created_at: string
}

export interface PollLogEntry {
  id: number
  account_id: number
  message_uid: number | null
  subject: string | null
  sender: string | null
  matched_vendor: string | null
  status: 'processed' | 'skipped' | 'error' | 'duplicate'
  error_msg: string | null
  event_id: number | null
  processed_at: string
}

export interface IngestionResult {
  status: 'processed' | 'skipped' | 'error' | 'duplicate'
  eventId?: number
  errorMsg?: string
  vendor?: string
}
