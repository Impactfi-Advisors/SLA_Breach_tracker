import { getCompanyByDomain } from '@/lib/db'

export class DomainMatcherService {
  /**
   * Given a sender email address, returns the matching vendor name from the
   * companies registry, or null if no match found.
   *
   * Matches exact domain and parent-domain:
   *   "alerts@status.acme.com" matches company with domain "acme.com"
   */
  static async matchVendor(senderEmail: string): Promise<string | null> {
    const company = await getCompanyByDomain(senderEmail)
    return company ? company.name : null
  }
}
