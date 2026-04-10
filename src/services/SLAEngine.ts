import type { BreachResult } from '@/types'

export class SLAEngine {
  /** Number of days in a given month (month is 1-based). */
  static daysInMonth(month: number, year: number): number {
    return new Date(year, month, 0).getDate()
  }

  /** Maximum allowed downtime in minutes for a given SLA and month. */
  static allowedDowntimeMins(uptimePct: number, month: number, year: number): number {
    const totalMins = SLAEngine.daysInMonth(month, year) * 24 * 60
    return totalMins * (1 - uptimePct / 100)
  }

  /**
   * Given total outage minutes for a product in a month, compute breach status.
   * Note: totalOutageMins is for this single outage. For cumulative monthly SLA,
   * sum all outage durations before calling.
   */
  static computeBreachStatus(params: {
    totalOutageMins: number
    uptimePct: number
    penaltyPerHr: number
    month: number
    year: number
  }): BreachResult {
    const allowed = SLAEngine.allowedDowntimeMins(params.uptimePct, params.month, params.year)
    const excess = params.totalOutageMins - allowed
    if (excess <= 0) {
      return { status: 'within', penalty: 0, excessMins: 0 }
    }
    const rawPenalty = (excess / 60) * params.penaltyPerHr
    return {
      status: 'breached',
      penalty: Math.round(rawPenalty * 100) / 100,
      excessMins: excess,
    }
  }

  /** Duration in minutes between two ISO 8601 timestamps. */
  static durationMins(startedAt: string, resolvedAt: string): number {
    return Math.floor(
      (new Date(resolvedAt).getTime() - new Date(startedAt).getTime()) / 60000
    )
  }
}
