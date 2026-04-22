import { NextRequest, NextResponse } from 'next/server'
import { getBankByToken, getOutagesByBank, getSLARulesByBank } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const bank = await getBankByToken(token)
  if (!bank) {
    return NextResponse.json({ error: 'Invalid or expired portal link' }, { status: 404 })
  }

  const [allOutages, slaRules] = await Promise.all([
    getOutagesByBank(bank.id),
    getSLARulesByBank(bank.id),
  ])

  // Limit to last 12 months
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 12)
  const outages = allOutages.filter(o => new Date(o.started_at) >= cutoff)

  const now = new Date()
  const month = now.getUTCMonth() + 1
  const year = now.getUTCFullYear()

  const thisMonthOutages = outages.filter(o => {
    const d = new Date(o.started_at)
    return d.getUTCMonth() + 1 === month && d.getUTCFullYear() === year
  })

  const penaltyThisMonth = thisMonthOutages
    .filter(o => o.breach_status === 'breached' && o.penalty_usd != null)
    .reduce((sum, o) => sum + (o.penalty_usd ?? 0), 0)

  const activeOutages = outages.filter(o => !o.resolved_at)
  const breachedCount = thisMonthOutages.filter(o => o.breach_status === 'breached').length
  const resolvedCount = thisMonthOutages.filter(o => o.resolved_at).length
  const withinCount = thisMonthOutages.filter(o => o.breach_status === 'within').length

  return NextResponse.json({
    bank: { id: bank.id, name: bank.name },
    stats: {
      activeOutages: activeOutages.length,
      penaltyThisMonth,
      breachedThisMonth: breachedCount,
      resolvedThisMonth: resolvedCount,
      withinThisMonth: withinCount,
      month,
      year,
    },
    slaRules,
    outages,
  })
}
