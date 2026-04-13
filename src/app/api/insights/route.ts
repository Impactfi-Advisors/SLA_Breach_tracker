import { NextResponse } from 'next/server'
import { getClaudeClient } from '@/lib/claude'
import { getOutages, getSLARules } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [outages, rules] = await Promise.all([getOutages(), getSLARules()])

  const now = new Date()
  const currentMonth = now.getUTCMonth() + 1
  const currentYear = now.getUTCFullYear()

  const thisMonthOutages = outages.filter(o => {
    const d = new Date(o.started_at)
    return d.getUTCMonth() + 1 === currentMonth && d.getUTCFullYear() === currentYear
  })

  const activeOutages = outages.filter(o => !o.resolved_at)
  const totalPenalty = thisMonthOutages.reduce((sum, o) => sum + (o.penalty_usd ?? 0), 0)
  const breachCount = thisMonthOutages.filter(o => o.breach_status === 'breached').length

  const vendorMap: Record<string, { outages: number; breaches: number; penalty: number }> = {}
  thisMonthOutages.forEach(o => {
    if (!vendorMap[o.vendor]) vendorMap[o.vendor] = { outages: 0, breaches: 0, penalty: 0 }
    vendorMap[o.vendor].outages++
    vendorMap[o.vendor].penalty += o.penalty_usd ?? 0
    if (o.breach_status === 'breached') vendorMap[o.vendor].breaches++
  })

  const vendorSummary = Object.entries(vendorMap)
    .map(([v, d]) => `- ${v}: ${d.outages} outage(s), ${d.breaches} breach(es), $${d.penalty.toFixed(2)} in penalties`)
    .join('\n') || '- No outages this month'

  const prompt = `You are an SLA compliance analyst. Analyze this vendor outage data and provide 3-4 specific, actionable insights.

Period: ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
Active outages right now: ${activeOutages.length}
Total outages this month: ${thisMonthOutages.length}
SLA breaches this month: ${breachCount}
Total penalties accrued: $${totalPenalty.toFixed(2)}
SLA contracts on file: ${rules.length}

Vendor breakdown:
${vendorSummary}

Return ONLY valid JSON — no markdown, no other text:
{"insights":[{"type":"warning"|"info"|"success"|"danger","title":"short title","body":"1-2 sentence actionable detail with specific numbers"}]}`

  const client = getClaudeClient()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : { insights: [] }
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ insights: [] })
  }
}
