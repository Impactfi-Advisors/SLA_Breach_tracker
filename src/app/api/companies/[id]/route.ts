import { NextRequest, NextResponse } from 'next/server'
import { getCompanies, updateCompany, deleteCompany } from '@/lib/db'

export const dynamic = 'force-dynamic'

function parseId(raw: string) {
  const id = parseInt(raw, 10)
  return isNaN(id) || id <= 0 ? null : id
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const all = await getCompanies()
  const company = all.find(c => c.id === id)
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(company)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { name, domains } = body as Record<string, unknown>
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  if (!domains || !Array.isArray(domains)) {
    return NextResponse.json({ error: 'domains must be array' }, { status: 400 })
  }
  await updateCompany(id, name.trim(), (domains as unknown[]).map(String))
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  await deleteCompany(id)
  return NextResponse.json({ success: true })
}
