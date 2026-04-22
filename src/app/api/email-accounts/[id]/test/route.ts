import { NextRequest, NextResponse } from 'next/server'
import { getEmailAccountById } from '@/lib/db'
import { testConnection } from '@/lib/imap'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const account = await getEmailAccountById(id)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  try {
    await testConnection(account)
    return NextResponse.json({ success: true, message: 'Connection successful' })
  } catch (err) {
    // Surface connection errors to UI since this is a diagnostic endpoint
    const msg = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }
}
