import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-20250514': 'gemini-1.5-flash',
  'claude-haiku-4-5-20251001': 'gemini-1.5-flash',
}

function resolveModel(model: string): string {
  return MODEL_MAP[model] ?? 'gemini-1.5-flash'
}

let _genai: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!_genai) {
    _genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  }
  return _genai
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
    const genai = getGenAI()
    const geminiModel = genai.getGenerativeModel({
      model: resolveModel(params.model),
      ...(params.system ? { systemInstruction: params.system } : {}),
      generationConfig: { maxOutputTokens: params.max_tokens },
    })
    const userMsg = params.messages.find(m => m.role === 'user')?.content ?? ''
    const result = await geminiModel.generateContent(userMsg)
    const text = result.response.text()
    return { content: [{ type: 'text', text }] }
  },
}

export function getClaudeClient() {
  return { messages }
}
