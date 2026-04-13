import { NextRequest, NextResponse } from 'next/server'
import { getEmailAccounts, insertEmailAccount } from '@/lib/db'

export const dynamic = 'force-dynamic'

function redact(accounts: ReturnType<typeof getEmailAccounts> extends Promise<infer T> ? T : never) {
  return accounts.map(a => ({ ...a, password: '••••••••' }))
}

export async function GET() {
  const accounts = await getEmailAccounts()
  return NextResponse.json(redact(accounts))
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { label, host, port, tls, username, password, mailbox } = body as Record<string, unknown>

  if (!label || typeof label !== 'string') return NextResponse.json({ error: 'label required' }, { status: 400 })
  if (!host || typeof host !== 'string') return NextResponse.json({ error: 'host required' }, { status: 400 })
  if (!username || typeof username !== 'string') return NextResponse.json({ error: 'username required' }, { status: 400 })
  if (!password || typeof password !== 'string') return NextResponse.json({ error: 'password required' }, { status: 400 })

  const portNum = typeof port === 'number' ? port : parseInt(String(port ?? 993), 10)
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return NextResponse.json({ error: 'port must be between 1 and 65535' }, { status: 400 })
  }
  const tlsBool = tls !== false && tls !== 0 && tls !== '0'
  const mailboxStr = typeof mailbox === 'string' ? mailbox : 'INBOX'

  const id = await insertEmailAccount(label, host, portNum, tlsBool, username, password, mailboxStr)
  return NextResponse.json({ id, label, host, port: portNum, tls: tlsBool ? 1 : 0, username, mailbox: mailboxStr, password: '••••••••' }, { status: 201 })
}
