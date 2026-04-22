import { getBankByAlias } from '@/lib/db'
import type { Bank } from '@/types'

export class DomainMatcherService {
  static extractAlias(toAddress: string): string | null {
    const match = toAddress.match(/\+([^@]+)@/)
    return match ? match[1].toLowerCase() : null
  }

  static async matchBank(toAddress: string): Promise<Bank | null> {
    const alias = DomainMatcherService.extractAlias(toAddress)
    if (!alias) return null
    return getBankByAlias(alias)
  }
}
