import { getClaudeClient } from '@/lib/claude'
import type { Outage } from '@/types'

export class ReportGenerator {
  static async generate(params: {
    bankName: string
    vendor: string
    month: number
    year: number
    outages: Outage[]
    totalPenalty: number
  }): Promise<string> {
    const client = getClaudeClient()
    const monthName = new Date(params.year, params.month - 1, 1)
      .toLocaleString('en-US', { month: 'long' })

    const breachLines = params.outages
      .map(
        o =>
          `- Product: ${o.product}, Duration: ${o.duration_mins} min, Penalty: $${o.penalty_usd?.toFixed(2) ?? '0.00'}`
      )
      .join('\n')

    const prompt = `Write a formal chargeback letter from ${params.bankName} to ${params.vendor} for SLA breaches in ${monthName} ${params.year}.

SLA Breaches:
${breachLines}

Total penalty owed: $${params.totalPenalty.toFixed(2)}

Requirements:
- Professional business letter format
- Include [Your Company] and [Address] placeholders for sender details
- Today's date: ${new Date().toISOString().split('T')[0]}
- Itemize each breach with product name, duration, and penalty
- State total amount owed
- Payment terms: Net 30 days
- Formal closing`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  }
}
