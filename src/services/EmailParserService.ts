import { getClaudeClient } from '@/lib/claude'
import type { ParsedEvent } from '@/types'

export class EmailParserService {
  static async parse(rawEmail: string): Promise<ParsedEvent> {
    const client = getClaudeClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: `You are an email parser that extracts vendor downtime information.
Return ONLY valid JSON with this exact schema — no other text:
{
  "vendor": "<company name>",
  "product": "<product or service name>",
  "event_type": "down" | "up",
  "timestamp": "<ISO 8601 UTC string>"
}
If you cannot extract the required fields, return: {"error": "<reason>"}`,
      messages: [{ role: 'user', content: rawEmail }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text)

    if ('error' in parsed) {
      throw new Error(`Email parse failed: ${parsed.error}`)
    }

    return parsed as ParsedEvent
  }
}
