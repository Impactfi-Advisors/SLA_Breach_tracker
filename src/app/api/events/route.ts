import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import {
  insertEvent,
  getEvents,
  insertOutage,
  getOpenOutage,
  resolveOutage,
  getSLARuleForProduct,
  getResolvedOutageMinsForMonth,
} from '@/lib/db'
import { SLAEngine } from '@/services/SLAEngine'

export async function GET() {
  const events = await getEvents()
  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { vendor, product, event_type, timestamp, rawEmail } = body as Record<string, unknown>

  if (!vendor || !product || !event_type || !timestamp || !rawEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof vendor !== 'string' || typeof product !== 'string' ||
      typeof timestamp !== 'string' || typeof rawEmail !== 'string') {
    return NextResponse.json({ error: 'vendor, product, timestamp, and rawEmail must be strings' }, { status: 400 })
  }
  if (event_type !== 'down' && event_type !== 'up') {
    return NextResponse.json({ error: 'event_type must be down or up' }, { status: 400 })
  }
  // Issue 3: validate timestamp is a parseable ISO date
  if (isNaN(new Date(timestamp).getTime())) {
    return NextResponse.json({ error: 'timestamp must be a valid ISO 8601 date string' }, { status: 400 })
  }

  const eventId = await insertEvent({ vendor, product, event_type, timestamp, raw_email: rawEmail })

  if (event_type === 'down') {
    // Issue 2: check for existing open outage before creating a new one
    const existingOutage = await getOpenOutage(vendor, product)
    if (existingOutage) {
      return NextResponse.json({
        eventId,
        outageId: existingOutage.id,
        warning: 'An open outage already exists for this product; duplicate down event ignored',
      })
    }
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
    const month = dt.getUTCMonth() + 1
    const year = dt.getUTCFullYear()
    // Issue 1: sum prior resolved outage durations for this vendor+product in the same month
    const priorMins = await getResolvedOutageMinsForMonth(vendor, product, month, year)
    const result = SLAEngine.computeBreachStatus({
      totalOutageMins: priorMins + durationMins,
      uptimePct: rule.uptime_pct,
      penaltyPerHr: rule.penalty_per_hr,
      month,
      year,
    })
    breachStatus = result.status
    penaltyUsd = result.status === 'breached' ? result.penalty : 0
  }

  await resolveOutage(openOutage.id, timestamp, durationMins, breachStatus, penaltyUsd)
  return NextResponse.json({ eventId, outageId: openOutage.id, breachStatus, penaltyUsd })
}
