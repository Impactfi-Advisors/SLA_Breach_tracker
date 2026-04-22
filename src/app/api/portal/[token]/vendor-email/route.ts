import { NextRequest, NextResponse } from 'next/server'
import { getBankByToken, getBreachedOutagesByVendorMonth } from '@/lib/db'
import { getClaudeClient } from '@/lib/claude'

export const dynamic = 'force-dynamic'

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

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
    return NextResponse.json({ error: `No breached outages for ${vendor} in ${MONTHS[m]} ${y}` }, { status: 404 })
  }

  const totalPenalty = outages.reduce((sum, o) => sum + (o.penalty_usd ?? 0), 0)
  const lines = outages.map(o =>
    `- ${o.product}: ${o.duration_mins} min downtime — Penalty: $${(o.penalty_usd ?? 0).toFixed(2)}`
  ).join('\n')

  const prompt = `Draft a formal SLA breach notification email from ${bank.name} to ${vendor} for ${MONTHS[m]} ${y}.

Breaches:
${lines}

Total penalty owed: $${totalPenalty.toFixed(2)}

Requirements:
- Subject line first (format "Subject: ...")
- Blank line then email body
- Written from ${bank.name} to ${vendor} SLA/Compliance Team
- Professional and firm but respectful tone
- Itemize each breach with product and penalty
- Request resolution or credit within 30 days
- Mention Impact FI Advisors as the SLA monitoring partner
- Professional closing from ${bank.name} management`

  const client = getClaudeClient()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const email = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ email, totalPenalty, outageCount: outages.length })
}
