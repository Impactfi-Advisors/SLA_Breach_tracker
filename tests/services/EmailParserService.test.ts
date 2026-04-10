import { EmailParserService } from '../../src/services/EmailParserService'
import { getClaudeClient } from '../../src/lib/claude'

jest.mock('../../src/lib/claude')

describe('EmailParserService.parse', () => {
  const mockCreate = jest.fn()

  beforeEach(() => {
    jest.mocked(getClaudeClient).mockReturnValue({
      messages: { create: mockCreate },
    } as any)
  })

  afterEach(() => jest.clearAllMocks())

  it('returns ParsedEvent on successful extraction', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor: 'Acme Bank',
          product: 'Core Banking',
          event_type: 'down',
          timestamp: '2026-04-01T10:00:00Z',
        }),
      }],
    })

    const result = await EmailParserService.parse('Core Banking is down.')
    expect(result.vendor).toBe('Acme Bank')
    expect(result.product).toBe('Core Banking')
    expect(result.event_type).toBe('down')
    expect(result.timestamp).toBe('2026-04-01T10:00:00Z')
  })

  it('throws when Claude returns an error field', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ error: 'Cannot determine event type' }) }],
    })

    await expect(EmailParserService.parse('Hello world')).rejects.toThrow(
      'Email parse failed: Cannot determine event type'
    )
  })

  it('throws when Claude returns non-JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot help with that.' }],
    })

    await expect(EmailParserService.parse('junk')).rejects.toThrow()
  })

  it('calls Claude with the raw email as user message', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({ vendor: 'X', product: 'Y', event_type: 'up', timestamp: '2026-04-01T00:00:00Z' }),
      }],
    })

    await EmailParserService.parse('Service is back up.')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Service is back up.' }],
      })
    )
  })
})
