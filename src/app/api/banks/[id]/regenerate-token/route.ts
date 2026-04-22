import { NextRequest, NextResponse } from 'next/server'
import { regenerateBankToken } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const token = await regenerateBankToken(id)
  return NextResponse.json({ token })
}
