import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock setup ────────────────────────────────────────────────────────
// vi.mock factories are hoisted to top of file — variables used inside must be
// declared with vi.hoisted() so they're initialized before the factory runs.

const { tableData, mockSupabase } = vi.hoisted(() => {
  type TableRow = Record<string, unknown>
  const tableData: Record<string, TableRow[] | { count: number } | null> = {}

  function chainBuilder(result: unknown) {
    const b: Record<string, unknown> = {}
    const terminal = () => Promise.resolve(result)
    const chain = () => b
    ;[
      'select','eq','neq','gte','lte','gt','lt','like','ilike','in',
      'order','range','limit','not','is','filter',
    ].forEach((m) => { b[m] = chain })
    b.maybeSingle = terminal
    b.single = terminal
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
    return b
  }

  const mockSupabase = {
    from: (table: string) => {
      const raw = tableData[table]
      if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'count' in raw) {
        return chainBuilder({ data: null, count: (raw as { count: number }).count, error: null })
      }
      return chainBuilder({ data: raw ?? null, error: null })
    },
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
  }

  return { tableData, mockSupabase }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
  createServiceClient: vi.fn().mockReturnValue(mockSupabase),
}))

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  getMRR,
  getARR,
  getBurnRate,
  getCashBalance,
  getRunway,
  getPnL,
  getForecast,
  getDataCompleteness,
} from '@/lib/metrics/index'

const ORG = 'org-test-123'

beforeEach(() => {
  Object.keys(tableData).forEach((k) => delete tableData[k])
})

// ─── getMRR ───────────────────────────────────────────────────────────────────

describe('getMRR', () => {
  it('sums active monthly subscriptions', async () => {
    tableData.subscriptions = [
      { amount: 500, interval: 'month', status: 'active' },
      { amount: 1200, interval: 'month', status: 'active' },
    ]
    const { mrr, warnings } = await getMRR(ORG)
    expect(mrr).toBe(1700)
    expect(warnings).toHaveLength(0)
  })

  it('converts yearly subscriptions to monthly', async () => {
    tableData.subscriptions = [{ amount: 12000, interval: 'year', status: 'active' }]
    const { mrr } = await getMRR(ORG)
    expect(mrr).toBeCloseTo(1000)
  })

  it('falls back to income transactions when no subscriptions', async () => {
    tableData.subscriptions = []
    tableData.transactions = [
      { amount: 800, type: 'income' },
      { amount: 200, type: 'income' },
    ]
    const { mrr, warnings } = await getMRR(ORG)
    expect(mrr).toBe(1000)
    expect(warnings.some((w) => w.includes('transactions'))).toBe(true)
  })

  it('returns 0 with warning when no data at all', async () => {
    tableData.subscriptions = []
    tableData.transactions = []
    const { mrr, warnings } = await getMRR(ORG)
    expect(mrr).toBe(0)
    expect(warnings.length).toBeGreaterThan(0)
  })
})

// ─── getARR ───────────────────────────────────────────────────────────────────

describe('getARR', () => {
  it('returns MRR × 12', async () => {
    tableData.subscriptions = [{ amount: 1000, interval: 'month', status: 'active' }]
    const { arr } = await getARR(ORG)
    expect(arr).toBe(12000)
  })
})

// ─── getBurnRate ──────────────────────────────────────────────────────────────

describe('getBurnRate', () => {
  it('averages expenses over distinct months that had data', async () => {
    tableData.transactions = [
      { amount: 3000, type: 'expense', date: '2026-02-15' },
      { amount: 6000, type: 'expense', date: '2026-03-10' },
    ]
    const { burnRate } = await getBurnRate(ORG)
    // 2 distinct months with expenses → 9000 / 2 = 4500
    expect(burnRate).toBeCloseTo(4500)
  })

  it('counts a new subscription at full value when it appears in only one month', async () => {
    tableData.transactions = [
      { amount: 20, type: 'expense', date: '2026-05-01', recurrence: 'monthly' },
    ]
    const { burnRate } = await getBurnRate(ORG)
    // 1 distinct month → 20 / 1 = 20, not 20 / 3
    expect(burnRate).toBeCloseTo(20)
  })

  it('returns 0 with warning when no expenses', async () => {
    tableData.transactions = []
    const { burnRate, warnings } = await getBurnRate(ORG)
    expect(burnRate).toBe(0)
    expect(warnings.length).toBeGreaterThan(0)
  })
})

// ─── getCashBalance ───────────────────────────────────────────────────────────

describe('getCashBalance', () => {
  it('derives cash from income minus expenses when no Plaid', async () => {
    tableData.connections = null
    tableData.transactions = [
      { amount: 5000, type: 'income' },
      { amount: 2000, type: 'expense' },
    ]
    const { cash, warnings } = await getCashBalance(ORG)
    expect(cash).toBe(3000)
    expect(warnings.some((w) => w.includes('estimated'))).toBe(true)
  })

  it('returns 0 with warning when no transactions', async () => {
    tableData.connections = null
    tableData.transactions = []
    const { cash, warnings } = await getCashBalance(ORG)
    expect(cash).toBe(0)
    expect(warnings.length).toBeGreaterThan(0)
  })
})

// ─── getRunway ────────────────────────────────────────────────────────────────

describe('getRunway', () => {
  it('returns infinite when MRR exceeds burn (profitable)', async () => {
    tableData.subscriptions = [{ amount: 10000, interval: 'month', status: 'active' }]
    tableData.transactions = [{ amount: 3000, type: 'expense', date: '2026-04-01' }]
    tableData.connections = null
    const { runway } = await getRunway(ORG)
    expect(runway).toBe('infinite')
  })

  it('returns 0 when cash is exhausted', async () => {
    // Use subscriptions so MRR comes from subs (not transaction fallback)
    tableData.subscriptions = [{ amount: 200, interval: 'month', status: 'active' }]
    // Only expenses → cash = 0 - 3000 = -3000 → runway = 0
    tableData.transactions = [{ amount: 3000, type: 'expense', date: '2026-04-01' }]
    tableData.connections = null
    const { runway } = await getRunway(ORG)
    expect(runway).toBe(0)
  })
})

// ─── getPnL ───────────────────────────────────────────────────────────────────

describe('getPnL', () => {
  it('groups income and expenses by category', async () => {
    tableData.transactions = [
      { amount: 3000, type: 'income',  category: 'SaaS Revenue' },
      { amount: 2000, type: 'income',  category: 'SaaS Revenue' },
      { amount: 500,  type: 'expense', category: 'Software' },
      { amount: 1000, type: 'expense', category: 'Payroll' },
    ]
    const report = await getPnL(ORG, '2026-04-01')
    expect(report.totalRevenue).toBe(5000)
    expect(report.totalExpenses).toBe(1500)
    expect(report.netIncome).toBe(3500)
    expect(report.revenue).toHaveLength(1)
    expect(report.expenses).toHaveLength(2)
  })

  it('returns empty report with warning when no data', async () => {
    tableData.transactions = []
    const report = await getPnL(ORG, '2026-04-01')
    expect(report.totalRevenue).toBe(0)
    expect(report.netIncome).toBe(0)
    expect(report.dataWarnings.length).toBeGreaterThan(0)
  })
})

// ─── getForecast ──────────────────────────────────────────────────────────────

describe('getForecast', () => {
  it('grows MRR by the specified rate each month', async () => {
    tableData.subscriptions = [{ amount: 1000, interval: 'month', status: 'active' }]
    tableData.transactions = [{ amount: 500, type: 'expense', date: '2026-04-01' }]
    tableData.connections = null

    const months = await getForecast(ORG, 0.10, 3)
    expect(months).toHaveLength(3)
    expect(months[0].projectedMRR).toBeCloseTo(1100)
    expect(months[1].projectedMRR).toBeCloseTo(1210)
    expect(months[2].projectedMRR).toBeCloseTo(1331)
  })

  it('returns flat forecast at 0% growth', async () => {
    tableData.subscriptions = [{ amount: 2000, interval: 'month', status: 'active' }]
    tableData.transactions = [{ amount: 1000, type: 'expense', date: '2026-04-01' }]
    tableData.connections = null

    const months = await getForecast(ORG, 0, 2)
    expect(months[0].projectedMRR).toBeCloseTo(2000)
    expect(months[1].projectedMRR).toBeCloseTo(2000)
  })
})

// ─── getDataCompleteness ──────────────────────────────────────────────────────

describe('getDataCompleteness', () => {
  it('scores 0 with all warnings when no data', async () => {
    tableData.connections = []
    tableData.transactions = { count: 0 }
    const result = await getDataCompleteness(ORG)
    expect(result.overallScore).toBe(0)
    expect(result.stripeConnected).toBe(false)
    expect(result.bankConnected).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('scores ≥60 when Stripe + Plaid are both connected', async () => {
    tableData.connections = [
      { provider: 'stripe', status: 'connected' },
      { provider: 'plaid',  status: 'connected' },
    ]
    tableData.transactions = { count: 0 }
    const result = await getDataCompleteness(ORG)
    expect(result.stripeConnected).toBe(true)
    expect(result.bankConnected).toBe(true)
    expect(result.overallScore).toBeGreaterThanOrEqual(60)
  })

  it('adds points for manual entries', async () => {
    tableData.connections = []
    tableData.transactions = { count: 5 }
    const result = await getDataCompleteness(ORG)
    expect(result.hasManualEntries).toBe(true)
    expect(result.overallScore).toBeGreaterThanOrEqual(10)
  })
})
