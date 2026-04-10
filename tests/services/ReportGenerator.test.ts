import { ReportGenerator } from '../../src/services/ReportGenerator'
import { getClaudeClient } from '../../src/lib/claude'
import type { Outage } from '../../src/types'

jest.mock('../../src/lib/claude')

const sampleOutage: Outage = {
  id: 1,
  vendor: 'Acme Bank',
  product: 'Core Banking',
  started_at: '2026-04-01T10:00:00Z',
  resolved_at: '2026-04-01T11:00:00Z',
  duration_mins: 60,
  breach_status: 'breached',
  penalty_usd: 500,
}

describe('ReportGenerator.generate', () => {
  const mockCreate = jest.fn()

  beforeEach(() => {
    jest.mocked(getClaudeClient).mockReturnValue({
      messages: { create: mockCreate },
    } as any)
  })

  afterEach(() => jest.clearAllMocks())

  it('returns the letter string from Claude', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Dear Acme Bank, you owe $500.00...' }],
    })

    const result = await ReportGenerator.generate({
      vendor: 'Acme Bank',
      month: 4,
      year: 2026,
      outages: [sampleOutage],
      totalPenalty: 500,
    })

    expect(result).toBe('Dear Acme Bank, you owe $500.00...')
  })

  it('calls Claude exactly once', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Letter content.' }],
    })

    await ReportGenerator.generate({
      vendor: 'Acme Bank',
      month: 4,
      year: 2026,
      outages: [sampleOutage],
      totalPenalty: 500,
    })

    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('includes vendor, month, and total in the prompt', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Letter.' }],
    })

    await ReportGenerator.generate({
      vendor: 'Acme Bank',
      month: 4,
      year: 2026,
      outages: [sampleOutage],
      totalPenalty: 500,
    })

    const callArg = mockCreate.mock.calls[0][0]
    const promptText = callArg.messages[0].content as string
    expect(promptText).toContain('Acme Bank')
    expect(promptText).toContain('April 2026')
    expect(promptText).toContain('500.00')
  })
})
