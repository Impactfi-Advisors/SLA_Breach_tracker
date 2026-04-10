import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
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
