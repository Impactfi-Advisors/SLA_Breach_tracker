import { SLAEngine } from '../../src/services/SLAEngine'

describe('SLAEngine', () => {
  describe('daysInMonth', () => {
    it('returns 30 for April 2026', () => {
      expect(SLAEngine.daysInMonth(4, 2026)).toBe(30)
    })
    it('returns 31 for January 2026', () => {
      expect(SLAEngine.daysInMonth(1, 2026)).toBe(31)
    })
    it('returns 28 for February 2026 (non-leap year)', () => {
      expect(SLAEngine.daysInMonth(2, 2026)).toBe(28)
    })
  })

  describe('allowedDowntimeMins', () => {
    it('computes allowed downtime for 99.9% uptime in April 2026', () => {
      // 30 days * 24 * 60 = 43200 total mins; 43200 * 0.001 = 43.2
      expect(SLAEngine.allowedDowntimeMins(99.9, 4, 2026)).toBeCloseTo(43.2, 1)
    })
    it('computes allowed downtime for 99.5% uptime in January 2026', () => {
      // 31 * 24 * 60 = 44640; 44640 * 0.005 = 223.2
      expect(SLAEngine.allowedDowntimeMins(99.5, 1, 2026)).toBeCloseTo(223.2, 1)
    })
  })

  describe('computeBreachStatus', () => {
    it('returns within when outage is under allowed downtime', () => {
      const result = SLAEngine.computeBreachStatus({
        totalOutageMins: 30,
        uptimePct: 99.9,
        penaltyPerHr: 500,
        month: 4,
        year: 2026,
      })
      expect(result.status).toBe('within')
      expect(result.penalty).toBe(0)
      expect(result.excessMins).toBe(0)
    })

    it('returns breached when outage exceeds allowed downtime', () => {
      // allowed = 43.2 mins; outage = 104 mins; excess = 60.8 mins
      const result = SLAEngine.computeBreachStatus({
        totalOutageMins: 104,
        uptimePct: 99.9,
        penaltyPerHr: 500,
        month: 4,
        year: 2026,
      })
      expect(result.status).toBe('breached')
      expect(result.penalty).toBeGreaterThan(0)
      expect(result.excessMins).toBeCloseTo(60.8, 0)
    })

    it('computes penalty as (excessMins / 60) * penaltyPerHr', () => {
      const result = SLAEngine.computeBreachStatus({
        totalOutageMins: 104,
        uptimePct: 99.9,
        penaltyPerHr: 600,
        month: 4,
        year: 2026,
      })
      const expected = (result.excessMins / 60) * 600
      expect(result.penalty).toBeCloseTo(expected, 2)
    })

    it('rounds penalty to 2 decimal places', () => {
      const result = SLAEngine.computeBreachStatus({
        totalOutageMins: 104,
        uptimePct: 99.9,
        penaltyPerHr: 500,
        month: 4,
        year: 2026,
      })
      expect(result.penalty).toBe(Math.round(result.penalty * 100) / 100)
    })
  })

  describe('durationMins', () => {
    it('computes duration between two ISO timestamps', () => {
      expect(SLAEngine.durationMins(
        '2026-04-01T10:00:00Z',
        '2026-04-01T11:30:00Z'
      )).toBe(90)
    })
    it('returns 0 for same start and end', () => {
      expect(SLAEngine.durationMins(
        '2026-04-01T10:00:00Z',
        '2026-04-01T10:00:00Z'
      )).toBe(0)
    })
  })
})
