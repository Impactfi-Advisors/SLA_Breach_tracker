import { NextRequest, NextResponse } from 'next/server'
import { getCompanyByToken, getOutagesByVendor, getSLARules } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const company = await getCompanyByToken(params.token)
  if (!company) {
    return NextResponse.json({ error: 'Invalid or expired portal link' }, { status: 404 })
  }

  const [allOutages, allRules] = await Promise.all([
    getOutagesByVendor(company.name),
    getSLARules(),
  ])

  // Limit to last 12 months of data for the portal
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 12)
  const outages = allOutages.filter(o => new Date(o.started_at) >= cutoff)

  const slaRules = allRules.filter(r => r.vendor === company.name)

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
    company: { id: company.id, name: company.name },
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
