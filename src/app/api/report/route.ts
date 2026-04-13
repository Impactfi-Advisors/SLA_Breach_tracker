import { NextRequest, NextResponse } from 'next/server'
import { getBreachedOutagesByVendorMonth } from '@/lib/db'
import { ReportGenerator } from '@/services/ReportGenerator'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { vendor, month, year } = body as Record<string, unknown>

  if (!vendor || !month || !year) {
    return NextResponse.json({ error: 'vendor, month, and year are required' }, { status: 400 })
  }
  if (typeof vendor !== 'string') {
    return NextResponse.json({ error: 'vendor must be a string' }, { status: 400 })
  }
  if (typeof month !== 'number' || month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 })
  }
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 2000) {
    return NextResponse.json({ error: 'year must be an integer >= 2000' }, { status: 400 })
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
