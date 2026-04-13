import { NextRequest, NextResponse } from 'next/server'
import { getEmailAccounts, updateEmailAccountLastUid } from '@/lib/db'
import { fetchNewMessages } from '@/lib/imap'
import { EmailIngestionService } from '@/services/EmailIngestionService'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 16) {
    console.error('[email-poll] CRON_SECRET is not configured or too short')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const secret = req.headers.get('x-cron-secret')
  if (secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await getEmailAccounts()
  const activeAccounts = accounts.filter(a => a.active === 1)

  let processed = 0
  let skipped = 0
  let errors = 0

  for (const account of activeAccounts) {
    let messages
    try {
      messages = await fetchNewMessages(account)
    } catch (err) {
      errors++
      console.error(`[email-poll] IMAP fetch failed for account ${account.id}:`, err)
      continue
    }

    let maxUid = account.last_uid

    for (const msg of messages) {
      const result = await EmailIngestionService.ingest({
        rawEmail: msg.body,
        senderEmail: msg.from,
        uid: msg.uid,
        accountId: account.id,
        subject: msg.subject,
      })

      if (result.status === 'processed') processed++
      else if (result.status === 'skipped') skipped++
      else if (result.status === 'error') errors++
      // duplicate counts as skipped for summary

      if (msg.uid > maxUid) maxUid = msg.uid
    }

    if (maxUid > account.last_uid) {
      await updateEmailAccountLastUid(account.id, maxUid)
    }
  }

  return NextResponse.json({ processed, skipped, errors, accounts: activeAccounts.length })
}
