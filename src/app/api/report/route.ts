import { NextRequest, NextResponse } from 'next/server'
import { getBreachedOutagesByVendorMonth, getBanks } from '@/lib/db'
import { ReportGenerator } from '@/services/ReportGenerator'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { bank_id, vendor, month, year } = body as Record<string, unknown>

  if (!bank_id || !vendor || !month || !year) {
    return NextResponse.json({ error: 'bank_id, vendor, month, and year are required' }, { status: 400 })
  }
  if (typeof bank_id !== 'number') {
    return NextResponse.json({ error: 'bank_id must be a number' }, { status: 400 })
  }
  if (typeof vendor !== 'string') {
    return NextResponse.json({ error: 'vendor must be a string' }, { status: 400 })
  }
  if (typeof month !== 'number' || month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 })
  }
  const currentYear = new Date().getFullYear()
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
    return NextResponse.json({ error: `year must be between 2000 and ${currentYear + 1}` }, { status: 400 })
  }

  const banks = await getBanks()
  const bank = banks.find(b => b.id === bank_id)
  if (!bank) {
    return NextResponse.json({ error: 'Bank not found' }, { status: 400 })
  }

  const outages = await getBreachedOutagesByVendorMonth(bank_id, vendor, month, year)
  if (outages.length === 0) {
    return NextResponse.json(
      { error: 'No breached outages found for this bank, vendor, and month' },
      { status: 404 }
    )
  }

  const totalPenalty = outages.reduce((sum, o) => sum + (o.penalty_usd ?? 0), 0)
  const letter = await ReportGenerator.generate({ bankName: bank.name, vendor, month, year, outages, totalPenalty })
  return NextResponse.json({ letter })
}
