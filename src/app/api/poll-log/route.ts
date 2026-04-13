import { NextRequest, NextResponse } from 'next/server'
import { getPollLog } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50')
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const entries = await getPollLog(limit, status)
  return NextResponse.json(entries)
}
