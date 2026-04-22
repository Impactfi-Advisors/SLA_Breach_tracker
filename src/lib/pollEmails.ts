import { getEmailAccounts, updateEmailAccountLastUid } from '@/lib/db'
import { fetchNewMessages } from '@/lib/imap'
import { EmailIngestionService } from '@/services/EmailIngestionService'

export async function pollEmails(): Promise<{ processed: number; skipped: number; errors: number; accounts: number }> {
  const accounts = await getEmailAccounts()
  const activeAccounts = accounts.filter(a => a.active)

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
        toEmail: msg.to,
        senderEmail: msg.from,
        uid: msg.uid,
        accountId: account.id,
        subject: msg.subject,
      })

      if (result.status === 'processed') processed++
      else if (result.status === 'skipped') skipped++
      else if (result.status === 'error') errors++

      if (msg.uid > maxUid) maxUid = msg.uid
    }

    if (maxUid > account.last_uid) {
      await updateEmailAccountLastUid(account.id, maxUid)
    }
  }

  return { processed, skipped, errors, accounts: activeAccounts.length }
}
