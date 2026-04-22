import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _client
}

interface CreateParams {
  model: string
  max_tokens: number
  system?: string
  messages: { role: string; content: string }[]
}

interface CreateResponse {
  content: [{ type: 'text'; text: string }]
}

const messages = {
  async create(params: CreateParams): Promise<CreateResponse> {
    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: params.max_tokens,
      ...(params.system ? { system: params.system } : {}),
      messages: params.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })
    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    return { content: [{ type: 'text', text }] }
  },
}

export function getClaudeClient() {
  return { messages }
}
