import {
  insertEvent,
  getOpenOutage,
  insertOutage,
  resolveOutage,
  getSLARuleForProduct,
  getResolvedOutageMinsForMonth,
  insertPollLog,
} from '@/lib/db'
import { EmailParserService } from './EmailParserService'
import { DomainMatcherService } from './DomainMatcherService'
import { SLAEngine } from './SLAEngine'
import type { IngestionResult } from '@/types'

interface IngestInput {
  rawEmail: string
  toEmail: string      // recipient: sla+{alias}@impactfiadvisors.com
  senderEmail: string  // kept for logging
  uid: number
  accountId: number
  subject?: string
}

export class EmailIngestionService {
  static async ingest(input: IngestInput): Promise<IngestionResult> {
    const { rawEmail, toEmail, senderEmail, uid, accountId, subject } = input

    // Step 1: match recipient alias to a registered bank
    const bank = await DomainMatcherService.matchBank(toEmail)
    if (!bank) {
      await insertPollLog({
        accountId,
        messageUid: uid,
        subject: subject ?? null,
        sender: senderEmail,
        matchedVendor: null,
        status: 'skipped',
        errorMsg: `No bank match for alias in TO: ${toEmail}`,
      })
      return { status: 'skipped' }
    }

    // Step 2: parse email with Claude to extract vendor/product/event_type/timestamp
    let parsed
    try {
      parsed = await EmailParserService.parse(rawEmail)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await insertPollLog({
        accountId,
        messageUid: uid,
        subject: subject ?? null,
        sender: senderEmail,
        matchedVendor: null,
        status: 'error',
        errorMsg: msg,
      })
      return { status: 'error', errorMsg: msg }
    }

    // Validate event_type against prompt injection
    if (parsed.event_type !== 'down' && parsed.event_type !== 'up') {
      const msg = `Invalid event_type after parse: "${parsed.event_type}"`
      await insertPollLog({
        accountId, messageUid: uid, subject: subject ?? null, sender: senderEmail,
        matchedVendor: parsed.vendor, status: 'error', errorMsg: msg,
      })
      return { status: 'error', errorMsg: msg }
    }

    // Step 3: check for duplicate open outage
    if (parsed.event_type === 'down') {
      const existing = await getOpenOutage(bank.id, parsed.vendor, parsed.product)
      if (existing) {
        await insertPollLog({
          accountId,
          messageUid: uid,
          subject: subject ?? null,
          sender: senderEmail,
          matchedVendor: parsed.vendor,
          status: 'duplicate',
          errorMsg: `Open outage already exists (id=${existing.id})`,
        })
        return { status: 'duplicate', vendor: parsed.vendor }
      }
    }

    // Step 4: insert event
    const eventId = await insertEvent({
      bank_id: bank.id,
      vendor: parsed.vendor,
      product: parsed.product,
      event_type: parsed.event_type,
      timestamp: parsed.timestamp,
      raw_email: rawEmail,
    })

    // Step 5: outage lifecycle
    if (parsed.event_type === 'down') {
      await insertOutage(bank.id, parsed.vendor, parsed.product, parsed.timestamp)
    } else {
      const openOutage = await getOpenOutage(bank.id, parsed.vendor, parsed.product)
      if (openOutage) {
        const durationMins = SLAEngine.durationMins(openOutage.started_at, parsed.timestamp)
        const rule = await getSLARuleForProduct(bank.id, parsed.vendor, parsed.product)

        let breachStatus = 'pending'
        let penaltyUsd: number | null = null

        if (rule) {
          const dt = new Date(openOutage.started_at)
          const month = dt.getUTCMonth() + 1
          const year = dt.getUTCFullYear()
          const priorMins = await getResolvedOutageMinsForMonth(bank.id, parsed.vendor, parsed.product, month, year)
          const result = SLAEngine.computeBreachStatus({
            totalOutageMins: priorMins + durationMins,
            uptimePct: rule.uptime_pct,
            penaltyPerHr: rule.penalty_per_hr,
            month,
            year,
          })
          breachStatus = result.status
          penaltyUsd = result.status === 'breached' ? result.penalty : 0
        }

        await resolveOutage(openOutage.id, parsed.timestamp, durationMins, breachStatus, penaltyUsd)
      }
    }

    await insertPollLog({
      accountId,
      messageUid: uid,
      subject: subject ?? null,
      sender: senderEmail,
      matchedVendor: parsed.vendor,
      status: 'processed',
      eventId,
    })

    return { status: 'processed', eventId, vendor: parsed.vendor }
  }
}
