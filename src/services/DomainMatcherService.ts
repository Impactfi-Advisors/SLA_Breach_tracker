import { getBankByAlias } from '@/lib/db'
import type { Bank } from '@/types'

export class DomainMatcherService {
  /**
   * Extract the bank alias from a recipient address like sla+firstnational@impactfiadvisors.com
   * and return the matching Bank record, or null if not found.
   */
  static extractAlias(toAddress: string): string | null {
    const match = toAddress.match(/sla\+([^@]+)@/i)
    return match ? match[1].toLowerCase() : null
  }

  static async matchBank(toAddress: string): Promise<Bank | null> {
    const alias = DomainMatcherService.extractAlias(toAddress)
    if (!alias) return null
    return getBankByAlias(alias)
  }
}
