import { POST } from '../../src/app/api/sla-rules/route'
import * as db from '../../src/lib/db'

jest.mock('../../src/lib/db')

describe('POST /api/sla-rules', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns 400 when fields are missing', async () => {
    const req = new Request('http://localhost/api/sla-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'Acme' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when uptime_pct is out of range', async () => {
    const req = new Request('http://localhost/api/sla-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'Acme', product: 'Core', uptime_pct: 101, penalty_per_hr: 500 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when penalty_per_hr is zero', async () => {
    const req = new Request('http://localhost/api/sla-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'Acme', product: 'Core', uptime_pct: 99.9, penalty_per_hr: 0 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 with the created rule on success', async () => {
    jest.mocked(db.insertSLARule).mockResolvedValue(42)

    const req = new Request('http://localhost/api/sla-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'Acme', product: 'Core', uptime_pct: 99.9, penalty_per_hr: 500 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe(42)
    expect(data.vendor).toBe('Acme')
  })
})
