import { NextRequest, NextResponse } from 'next/server'

// Admin auth middleware.
// Browser UI:   sends HttpOnly cookie `admin_session` (set by /api/auth/login)
// Programmatic: sends `Authorization: Bearer <ADMIN_API_SECRET>` header (cron, scripts)

export function proxy(req: NextRequest) {
  const secret = process.env.ADMIN_API_SECRET
  if (!secret || secret.length < 16) {
    console.error('[middleware] ADMIN_API_SECRET is not set or too short')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Check HttpOnly cookie (browser sessions)
  const cookie = req.cookies.get('admin_session')?.value
  if (cookie === secret) return NextResponse.next()

  // Check Bearer token (programmatic / cron)
  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return NextResponse.next()

  // Browser navigating to a UI page → redirect to login
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')
  if (!isApiRoute) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export const config = {
  matcher: [
    // Admin API routes
    '/api/companies/:path*',
    '/api/sla-rules/:path*',
    '/api/events/:path*',
    '/api/report/:path*',
    '/api/email-accounts/:path*',
    '/api/cron/:path*',
    '/api/products/:path*',
    '/api/poll-log/:path*',
    '/api/outages/:path*',
    // Admin UI pages (redirect to login if no cookie)
    '/companies/:path*',
    '/products/:path*',
    '/sla-config/:path*',
    '/breach-log/:path*',
    '/report/:path*',
    '/inbox/:path*',
    '/email-config/:path*',
  ],
}
