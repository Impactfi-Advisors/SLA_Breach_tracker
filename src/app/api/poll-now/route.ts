import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { pollEmails } from '@/lib/pollEmails'

export const dynamic = 'force-dynamic'

export async function POST() {
  const cookieStore = await cookies()
  if (!cookieStore.get('admin_session')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await pollEmails()
  return NextResponse.json(result)
}
