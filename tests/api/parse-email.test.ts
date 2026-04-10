import { POST } from '../../src/app/api/parse-email/route'
import { EmailParserService } from '../../src/services/EmailParserService'

jest.mock('../../src/services/EmailParserService')

describe('POST /api/parse-email', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns 400 when rawEmail is missing', async () => {
    const req = new Request('http://localhost/api/parse-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('returns parsed event on success', async () => {
    jest.mocked(EmailParserService.parse).mockResolvedValue({
      vendor: 'Acme',
      product: 'Core Banking',
      event_type: 'down',
      timestamp: '2026-04-01T10:00:00Z',
    })

    const req = new Request('http://localhost/api/parse-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawEmail: 'Core Banking is down.' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.vendor).toBe('Acme')
    expect(data.event_type).toBe('down')
  })

  it('returns 422 when EmailParserService throws', async () => {
    jest.mocked(EmailParserService.parse).mockRejectedValue(
      new Error('Email parse failed: insufficient info')
    )

    const req = new Request('http://localhost/api/parse-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawEmail: 'Hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error).toContain('Email parse failed')
  })
})
