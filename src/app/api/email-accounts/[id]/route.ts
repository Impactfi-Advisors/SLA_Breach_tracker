import { NextRequest, NextResponse } from 'next/server'
import { getEmailAccountById, deleteEmailAccount } from '@/lib/db'

export const dynamic = 'force-dynamic'

function parseId(raw: string) {
  const id = parseInt(raw, 10)
  return isNaN(id) || id <= 0 ? null : id
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const account = await getEmailAccountById(id)
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...account, password: '••••••••' })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  await deleteEmailAccount(id)
  return NextResponse.json({ success: true })
}
