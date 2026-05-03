import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Stable UUIDs ─────────────────────────────────────────────────────────────
const INV_ID  = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const ORG_ID  = 'a1b2c3d4-e5f6-4789-8abc-def012345678'
const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

// ─── Hoisted mock ─────────────────────────────────────────────────────────────

const { dbState, mockSupabase } = vi.hoisted(() => {
  const dbState: Record<string, unknown[]> = {
    org_members: [],
    invoices: [],
    transactions: [],
    audit_log: [],
  }

  function chainBuilder(rows: unknown[]) {
    let filtered = [...rows]
    const b: Record<string, unknown> = {}

    b.eq = (_col: string, val: unknown) => {
      filtered = filtered.filter((r) => Object.values(r as Record<string, unknown>).includes(val))
      return b
    }
    ;['select','order','range','gte','lte','lt','gt','neq','like','in'].forEach((m) => {
      b[m] = () => b
    })
    b.single    = () => Promise.resolve({ data: filtered[0] ?? null, error: null })
    b.maybeSingle = () => Promise.resolve({ data: filtered[0] ?? null, error: null })
    b.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: filtered, error: null }).then(resolve)
    return b
  }

  const mockSupabase = {
    from: (table: string) => {
      const rows = dbState[table] ?? []
      const b = chainBuilder(rows)

      b.insert = (data: Record<string, unknown> | Record<string, unknown>[]) => {
        const items = Array.isArray(data) ? data : [data]
        const inserted = items.map((item) => ({ id: `id-${Math.random()}`, ...item }))
        dbState[table] = [...(dbState[table] ?? []), ...inserted]
        const b2: Record<string, unknown> = {}
        b2.select = () => b2
        b2.single = () => Promise.resolve({ data: inserted[0], error: null })
        b2.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: inserted, error: null }).then(resolve)
        return b2
      }

      b.update = (data: Record<string, unknown>) => {
        const b2: Record<string, unknown> = {}
        b2.eq = (_col: string, val: unknown) => {
          dbState[table] = (dbState[table] ?? []).map((r) => {
            const row = r as Record<string, unknown>
            return Object.values(row).includes(val) ? { ...row, ...data } : row
          })
          return b2
        }
        b2.select = () => b2
        b2.single = () => {
          const updated = dbState[table] ?? []
          return Promise.resolve({ data: updated[0] ?? null, error: null })
        }
        b2.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: dbState[table], error: null }).then(resolve)
        return b2
      }

      return b
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }),
    },
  }

  return { dbState, mockSupabase }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { GET, POST, PATCH } from '@/app/api/invoices/route'

// Seed org_members with stable UUIDs (after hoisting resolves)
dbState.org_members = [{ id: 'om-1', org_id: ORG_ID, role: 'owner', user_id: USER_ID }]

function makeRequest(method: string, body?: unknown) {
  const url = new URL('http://localhost/api/invoices')
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : {},
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/invoices', () => {
  beforeEach(() => {
    dbState.invoices = [
      { id: INV_ID, org_id: ORG_ID, status: 'draft', amount: 1000, invoice_number: 'INV-AAA' },
    ]
  })

  it('returns 200 with invoice list', async () => {
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.invoices).toBeDefined()
  })
})

describe('POST /api/invoices', () => {
  beforeEach(() => { dbState.invoices = [] })

  it('creates a draft invoice and returns 201', async () => {
    const res = await POST(makeRequest('POST', {
      customer_name: 'Acme Corp',
      amount: 2500,
      due_date: '2026-06-01',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.invoice).toBeDefined()
    expect(json.invoice.customer_name).toBe('Acme Corp')
  })

  it('rejects missing required fields', async () => {
    const res = await POST(makeRequest('POST', { notes: 'no amount or name' }))
    expect(res.status).toBe(400)
  })

  it('rejects negative amount', async () => {
    const res = await POST(makeRequest('POST', { customer_name: 'X', amount: -100 }))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/invoices', () => {
  beforeEach(() => {
    dbState.invoices = [
      {
        id: INV_ID, org_id: ORG_ID, status: 'sent', amount: 1500,
        invoice_number: 'INV-BBB', customer_name: 'Beta LLC',
      },
    ]
    dbState.transactions = []
    dbState.audit_log = []
  })

  it('updates invoice status to paid and returns 200', async () => {
    const res = await PATCH(makeRequest('PATCH', { id: INV_ID, status: 'paid' }))
    expect(res.status).toBe(200)
  })

  it('rejects invalid status value', async () => {
    const res = await PATCH(makeRequest('PATCH', { id: INV_ID, status: 'bogus' }))
    expect(res.status).toBe(400)
  })
})
