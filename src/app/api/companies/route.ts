import { NextResponse } from 'next/server'

// Redirected — use /api/banks instead
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.redirect(new URL('/api/banks', 'http://localhost'))
}

export async function POST() {
  return NextResponse.json({ error: 'This endpoint has moved to /api/banks' }, { status: 410 })
}
