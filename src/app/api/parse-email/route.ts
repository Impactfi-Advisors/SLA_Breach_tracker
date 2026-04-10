import { NextRequest, NextResponse } from 'next/server'
import { EmailParserService } from '@/services/EmailParserService'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const rawEmail: unknown = body.rawEmail

  if (!rawEmail || typeof rawEmail !== 'string') {
    return NextResponse.json({ error: 'rawEmail is required' }, { status: 400 })
  }

  try {
    const event = await EmailParserService.parse(rawEmail)
    return NextResponse.json(event)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 422 }
    )
  }
}
