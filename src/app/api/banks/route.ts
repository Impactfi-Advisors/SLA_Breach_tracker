import { NextRequest, NextResponse } from 'next/server'
import { getBanks, insertBank } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const banks = await getBanks()
  return NextResponse.json(banks)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, email_alias } = body as Record<string, unknown>

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!email_alias || typeof email_alias !== 'string' || !email_alias.trim()) {
    return NextResponse.json({ error: 'email_alias is required' }, { status: 400 })
  }
  if (!/^[a-z0-9_-]+$/i.test(email_alias.trim())) {
    return NextResponse.json({ error: 'email_alias must contain only letters, numbers, hyphens, and underscores' }, { status: 400 })
  }

  try {
    const id = await insertBank(name.trim(), email_alias.trim())
    return NextResponse.json({ id, name: name.trim(), email_alias: email_alias.trim().toLowerCase() }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: `Bank "${name}" or alias "${email_alias}" already exists` }, { status: 409 })
    }
    console.error('[banks] insert failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
