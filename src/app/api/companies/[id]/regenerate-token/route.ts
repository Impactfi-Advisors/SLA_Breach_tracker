import { NextRequest, NextResponse } from 'next/server'
import { regenerateCompanyToken } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (isNaN(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const token = await regenerateCompanyToken(id)
  return NextResponse.json({ access_token: token })
}
