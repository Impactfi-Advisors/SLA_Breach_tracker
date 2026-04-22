import { NextRequest, NextResponse } from 'next/server'
import { updateBank, deleteBank } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, email_alias } = body as Record<string, unknown>
  if (!name || typeof name !== 'string') return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!email_alias || typeof email_alias !== 'string') return NextResponse.json({ error: 'email_alias is required' }, { status: 400 })

  await updateBank(id, name.trim(), email_alias.trim())
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  await deleteBank(id)
  return NextResponse.json({ ok: true })
}
