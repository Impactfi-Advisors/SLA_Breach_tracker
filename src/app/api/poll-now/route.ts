import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  if (!cookieStore.get('admin_session')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const res = await fetch(`${base}/api/cron/email-poll`, {
    headers: { 'x-cron-secret': secret },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
