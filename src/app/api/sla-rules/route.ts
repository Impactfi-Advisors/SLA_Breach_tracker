import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getSLARules, insertSLARule } from '@/lib/db'

export async function GET() {
  const rules = await getSLARules()
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { vendor, product, uptime_pct, penalty_per_hr } = body as Record<string, unknown>

  if (!vendor || !product || uptime_pct == null || penalty_per_hr == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof vendor !== 'string' || typeof product !== 'string') {
    return NextResponse.json({ error: 'vendor and product must be strings' }, { status: 400 })
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
