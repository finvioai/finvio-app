import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Stable UUIDs ─────────────────────────────────────────────────────────────
const TXN_ID  = '6ba7b812-0234-41a8-92df-9e0b4e9b14c9'
const ORG_ID  = 'a1b2c3d4-e5f6-4789-8abc-def012345678'
const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

// ─── Hoisted mock ─────────────────────────────────────────────────────────────

const { dbState, mockSupabase } = vi.hoisted(() => {
  const dbState: Record<string, unknown[]> = {
    org_members: [],
    transactions: [],
    category_overrides: [],
    category_rules: [],
    audit_log: [],
  }

  function chainBuilder(rows: unknown[]) {
    let filtered = [...rows]
    const b: Record<string, unknown> = {}

    b.eq = (_col: string, val: unknown) => {
      filtered = filtered.filter((r) => Object.values(r as Record<string, unknown>).includes(val))
      return b
    }
    ;['select','order','range','gte','lte','lt','gt','neq','like','ilike','in','is'].forEach((m) => {
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

vi.mock('@/lib/categorization/rules', () => ({
  categorize: vi.fn().mockResolvedValue({ category: 'Software', confidence: 'high', method: 'rule' }),
  saveOverride: vi.fn().mockResolvedValue(undefined),
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { GET, POST, PATCH } from '@/app/api/transactions/route'

dbState.org_members = [{ id: 'om-1', org_id: ORG_ID, role: 'owner', user_id: USER_ID }]

function makeRequest(method: string, body?: unknown) {
  const url = new URL('http://localhost/api/transactions')
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : {},
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/transactions', () => {
  beforeEach(() => {
    dbState.transactions = [
      { id: TXN_ID, org_id: ORG_ID, type: 'income',  amount: 500,  date: '2026-04-01', category: 'Revenue' },
    ]
  })

  it('returns 200 with transaction list', async () => {
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.transactions).toBeDefined()
  })
})

describe('POST /api/transactions', () => {
  beforeEach(() => { dbState.transactions = [] })

  it('creates an expense transaction and returns 201', async () => {
    const res = await POST(makeRequest('POST', {
      type: 'expense', amount: 150, description: 'AWS monthly bill',
      date: '2026-04-01', source: 'manual',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.transaction.type).toBe('expense')
  })

  it('creates an income transaction and returns 201', async () => {
    const res = await POST(makeRequest('POST', {
      type: 'income', amount: 2000, description: 'Client payment',
      date: '2026-04-10', source: 'manual',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.transaction.type).toBe('income')
  })

  it('rejects invalid transaction type', async () => {
    const res = await POST(makeRequest('POST', {
      type: 'other', amount: 100, description: 'test', date: '2026-04-01',
    }))
    expect(res.status).toBe(400)
  })

  it('rejects missing amount', async () => {
    const res = await POST(makeRequest('POST', {
      type: 'expense', description: 'no amount', date: '2026-04-01',
    }))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/transactions', () => {
  beforeEach(() => {
    dbState.transactions = [
      { id: TXN_ID, org_id: ORG_ID, type: 'expense', amount: 100, category: 'Unknown', is_reviewed: false },
    ]
    dbState.audit_log = []
  })

  it('updates category and returns 200', async () => {
    const res = await PATCH(makeRequest('PATCH', { id: TXN_ID, category: 'Software', is_reviewed: true }))
    expect(res.status).toBe(200)
  })

  it('rejects PATCH without id', async () => {
    const res = await PATCH(makeRequest('PATCH', { category: 'Software' }))
    expect(res.status).toBe(400)
  })
})
