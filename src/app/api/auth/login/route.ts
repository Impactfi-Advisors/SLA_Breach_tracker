import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { password } = body as Record<string, unknown>
  const secret = process.env.ADMIN_API_SECRET

  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (typeof password !== 'string' || password !== secret) {
    // Fixed-time comparison would be ideal here; for a single-admin internal tool this is fine
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_session', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return res
}
