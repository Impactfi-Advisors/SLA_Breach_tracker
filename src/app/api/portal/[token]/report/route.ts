import { NextRequest, NextResponse } from 'next/server'
import { getBankByToken, getBreachedOutagesByVendorMonth } from '@/lib/db'
import { ReportGenerator } from '@/services/ReportGenerator'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const bank = await getBankByToken(token)
  if (!bank) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { vendor, month, year } = body as Record<string, unknown>
  if (!vendor || typeof vendor !== 'string') return NextResponse.json({ error: 'vendor is required' }, { status: 400 })
  if (!month || !year) return NextResponse.json({ error: 'month and year are required' }, { status: 400 })

  const m = Number(month), y = Number(year)
  const outages = await getBreachedOutagesByVendorMonth(bank.id, vendor, m, y)

  if (outages.length === 0) {
    return NextResponse.json({ error: `No breached outages found for ${vendor} in this period` }, { status: 404 })
  }

  const totalPenalty = outages.reduce((sum, o) => sum + (o.penalty_usd ?? 0), 0)
  const letter = await ReportGenerator.generate({ bankName: bank.name, vendor, month: m, year: y, outages, totalPenalty })

  return NextResponse.json({ letter, totalPenalty, outageCount: outages.length })
}
