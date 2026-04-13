import { NextRequest, NextResponse } from 'next/server'
import { getCompanies, insertCompany } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const companies = await getCompanies()
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, domains } = body as Record<string, unknown>

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return NextResponse.json({ error: 'domains must be a non-empty array' }, { status: 400 })
  }
  const domainList = (domains as unknown[]).map(String).map(d => d.toLowerCase().trim()).filter(Boolean)
  if (domainList.length === 0) {
    return NextResponse.json({ error: 'No valid domains provided' }, { status: 400 })
  }

  try {
    const id = await insertCompany(name.trim(), domainList)
    return NextResponse.json({ id, name: name.trim(), domains: domainList }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: `Company "${name}" already exists` }, { status: 409 })
    }
    console.error('[companies] insert failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
