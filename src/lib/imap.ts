import { ImapFlow } from 'imapflow'
import type { EmailAccount } from '@/types'

export interface ImapMessage {
  uid: number
  subject: string
  from: string
  to: string
  body: string
}

export async function fetchNewMessages(
  account: EmailAccount & { password: string }
): Promise<ImapMessage[]> {
  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.tls === 1,
    auth: {
      user: account.username,
      pass: account.password,
    },
    logger: false,
  })

  await client.connect()
  const messages: ImapMessage[] = []

  try {
    await client.mailboxOpen(account.mailbox)

    // Fetch messages with UID > last_uid
    const searchCriteria = account.last_uid > 0
      ? { uid: `${account.last_uid + 1}:*` }
      : { all: true }

    for await (const msg of client.fetch(searchCriteria, {
      uid: true,
      envelope: true,
      bodyStructure: true,
      source: true,
    })) {
      // Skip if UID <= last_uid (can happen when uid range returns nothing new)
      if (msg.uid <= account.last_uid) continue

      const subject = msg.envelope?.subject ?? '(no subject)'
      const fromAddr = msg.envelope?.from?.[0]
      const from = fromAddr?.address ?? fromAddr?.name ?? ''
      const toAddr = msg.envelope?.to?.[0]
      const to = toAddr?.address ?? ''
      const body = msg.source ? msg.source.toString('utf8') : ''

      messages.push({ uid: msg.uid, subject, from, to, body })
    }
  } finally {
    await client.logout()
  }

  return messages
}

export async function testConnection(
  account: Omit<EmailAccount, 'id' | 'last_uid' | 'active' | 'created_at'> & { password: string }
): Promise<void> {
  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.tls === 1,
    auth: {
      user: account.username,
      pass: account.password,
    },
    logger: false,
  })
  await client.connect()
  await client.logout()
}
