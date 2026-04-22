import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({ error: 'This endpoint has moved to /api/banks/{id}/regenerate-token' }, { status: 410 })
}
