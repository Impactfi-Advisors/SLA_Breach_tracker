import { NextRequest, NextResponse } from 'next/server'
import { getBreachedOutagesByVendorAllBanks, getSLARules } from '@/lib/db'
import { getClaudeClient } from '@/lib/claude'

export const dynamic = 'force-dynamic'

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { vendor, month, year } = body as Record<string, unknown>
  if (!vendor || typeof vendor !== 'string') return NextResponse.json({ error: 'vendor is required' }, { status: 400 })
  if (!month || !year) return NextResponse.json({ error: 'month and year are required' }, { status: 400 })

  const m = Number(month), y = Number(year)
  const outages = await getBreachedOutagesByVendorAllBanks(vendor, m, y)
  const allRules = await getSLARules()

  if (outages.length === 0) {
    return NextResponse.json({ error: `No breached outages found for ${vendor} in ${MONTHS[m]} ${y}` }, { status: 404 })
  }

  const totalPenalty = outages.reduce((sum, o) => sum + (o.penalty_usd ?? 0), 0)

  const outageLines = outages.map(o => {
    const rule = allRules.find(r => r.bank_id === o.bank_id && r.vendor === o.vendor && r.product === o.product)
    const sla = rule ? `${rule.uptime_pct}% uptime SLA` : 'SLA on file'
    return `- ${o.bank_name} / ${o.product}: ${o.duration_mins} min downtime (${sla}) — Penalty: $${(o.penalty_usd ?? 0).toFixed(2)}`
  }).join('\n')

  const prompt = `You are drafting a formal SLA breach notice on behalf of Impact FI Advisors, a financial technology consulting firm, addressed to ${vendor}.

Month: ${MONTHS[m]} ${y}
Total penalty owed: $${totalPenalty.toFixed(2)}
Affected clients and incidents:
${outageLines}

Write a professional, firm but respectful email:
- Subject line first (format: "Subject: ...")
- Then a blank line
- Then the email body
- From: Impact FI Advisors SLA Compliance Team
- To: ${vendor} SLA / Compliance Team
- Reference the specific outages and penalty amounts per client
- Request payment or credit within 30 days
- Mention that supporting documentation is available upon request
- Close professionally`

  const client = getClaudeClient()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const email = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ email, totalPenalty, outageCount: outages.length })
}
