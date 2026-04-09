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
