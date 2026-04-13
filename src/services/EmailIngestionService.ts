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
  senderEmail: string
  uid: number
  accountId: number
  subject?: string
}

export class EmailIngestionService {
  static async ingest(input: IngestInput): Promise<IngestionResult> {
    const { rawEmail, senderEmail, uid, accountId, subject } = input

    // Step 1: match sender domain to a known vendor
    const vendor = await DomainMatcherService.matchVendor(senderEmail)
    if (!vendor) {
      await insertPollLog({
        accountId,
        messageUid: uid,
        subject: subject ?? null,
        sender: senderEmail,
        matchedVendor: null,
        status: 'skipped',
        errorMsg: `No vendor match for domain: ${senderEmail.split('@')[1] ?? senderEmail}`,
      })
      return { status: 'skipped' }
    }

    // Step 2: parse email with Claude (hint vendor so it matches our registry exactly)
    let parsed
    try {
      parsed = await EmailParserService.parse(rawEmail, vendor)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await insertPollLog({
        accountId,
        messageUid: uid,
        subject: subject ?? null,
        sender: senderEmail,
        matchedVendor: vendor,
        status: 'error',
        errorMsg: msg,
      })
      return { status: 'error', errorMsg: msg, vendor }
    }

    // Prompt injection defense: enforce vendor match strictly
    if (parsed.vendor !== vendor) {
      const msg = `Vendor mismatch after parse: expected "${vendor}", got "${parsed.vendor}"`
      await insertPollLog({
        accountId, messageUid: uid, subject: subject ?? null, sender: senderEmail,
        matchedVendor: vendor, status: 'error', errorMsg: msg,
      })
      return { status: 'error', errorMsg: msg, vendor }
    }

    // Validate event_type in case of prompt injection
    if (parsed.event_type !== 'down' && parsed.event_type !== 'up') {
      const msg = `Invalid event_type after parse: "${parsed.event_type}"`
      await insertPollLog({
        accountId, messageUid: uid, subject: subject ?? null, sender: senderEmail,
        matchedVendor: vendor, status: 'error', errorMsg: msg,
      })
      return { status: 'error', errorMsg: msg, vendor }
    }

    // Step 3: check for duplicate open outage (down events only)
    if (parsed.event_type === 'down') {
      const existing = await getOpenOutage(parsed.vendor, parsed.product)
      if (existing) {
        await insertPollLog({
          accountId,
          messageUid: uid,
          subject: subject ?? null,
          sender: senderEmail,
          matchedVendor: vendor,
          status: 'duplicate',
          errorMsg: `Open outage already exists (id=${existing.id})`,
        })
        return { status: 'duplicate', vendor }
      }
    }

    // Step 4: insert event
    const eventId = await insertEvent({
      vendor: parsed.vendor,
      product: parsed.product,
      event_type: parsed.event_type,
      timestamp: parsed.timestamp,
      raw_email: rawEmail,
    })

    // Step 5: outage lifecycle
    if (parsed.event_type === 'down') {
      await insertOutage(parsed.vendor, parsed.product, parsed.timestamp)
    } else {
      const openOutage = await getOpenOutage(parsed.vendor, parsed.product)
      if (openOutage) {
        const durationMins = SLAEngine.durationMins(openOutage.started_at, parsed.timestamp)
        const rule = await getSLARuleForProduct(parsed.vendor, parsed.product)

        let breachStatus = 'pending'
        let penaltyUsd: number | null = null

        if (rule) {
          const dt = new Date(openOutage.started_at)
          const month = dt.getUTCMonth() + 1
          const year = dt.getUTCFullYear()
          const priorMins = await getResolvedOutageMinsForMonth(parsed.vendor, parsed.product, month, year)
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
      matchedVendor: vendor,
      status: 'processed',
      eventId,
    })

    return { status: 'processed', eventId, vendor }
  }
}
