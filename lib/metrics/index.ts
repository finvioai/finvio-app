import { createClient } from '@/lib/supabase/server'
import type {
  MRRTrend,
  PnLReport,
  PnLLineItem,
  ForecastMonth,
  DataCompletenessResult,
  DashboardMetrics,
} from '@/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function startOfMonth(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .split('T')[0]
}

function monthsAgo(n: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  return d
}

function isoMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── MRR ────────────────────────────────────────────────────────────────────

export async function getMRR(
  orgId: string,
  month?: string // ISO "YYYY-MM-DD", defaults to current month
): Promise<{ mrr: number; warnings: string[] }> {
  const supabase = await createClient()
  const warnings: string[] = []
  const targetMonth = month ?? startOfMonth(new Date())
  const nextMonth = new Date(targetMonth)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  // Primary: sum active subscriptions at that point in time
  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select('amount, interval')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .lte('current_period_start', nextMonth.toISOString().split('T')[0])

  if (!subErr && subs && subs.length > 0) {
    const mrr = subs.reduce((sum, s) => {
      const monthly =
        s.interval === 'year' || s.interval === 'yearly' ? (s.amount ?? 0) / 12 : (s.amount ?? 0)
      return sum + monthly
    }, 0)
    return { mrr, warnings }
  }

  // Fallback: income transactions in the month
  const { data: txns } = await supabase
    .from('transactions')
    .select('amount')
    .eq('org_id', orgId)
    .eq('type', 'income')
    .gte('date', targetMonth)
    .lt('date', nextMonth.toISOString().split('T')[0])

  if (!txns || txns.length === 0) {
    warnings.push('No revenue data found for this period.')
    return { mrr: 0, warnings }
  }

  warnings.push('MRR estimated from transactions — connect Stripe for accuracy.')
  const mrr = txns.reduce((sum, t) => sum + (t.amount ?? 0), 0)
  return { mrr, warnings }
}

export async function getARR(orgId: string): Promise<{ arr: number; warnings: string[] }> {
  const { mrr, warnings } = await getMRR(orgId)
  return { arr: mrr * 12, warnings }
}

// ─── Burn & Cash ─────────────────────────────────────────────────────────────

export async function getBurnRate(
  orgId: string,
  months = 3
): Promise<{ burnRate: number; warnings: string[] }> {
  const supabase = await createClient()
  const warnings: string[] = []
  const since = monthsAgo(months).toISOString().split('T')[0]

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, date')
    .eq('org_id', orgId)
    .eq('type', 'expense')
    .gte('date', since)

  if (!txns || txns.length === 0) {
    warnings.push('No expense data found. Add expenses or connect a bank account.')
    return { burnRate: 0, warnings }
  }

  const total = txns.reduce((sum, t) => sum + (t.amount ?? 0), 0)
  return { burnRate: total / months, warnings }
}

export async function getCashBalance(orgId: string): Promise<{ cash: number; warnings: string[] }> {
  const supabase = await createClient()
  const warnings: string[] = []

  // Primary: Plaid balance metadata
  const { data: conn } = await supabase
    .from('connections')
    .select('metadata')
    .eq('org_id', orgId)
    .eq('provider', 'plaid')
    .eq('status', 'connected')
    .maybeSingle()

  if (conn?.metadata) {
    const meta = conn.metadata as Record<string, unknown>
    if (typeof meta.balance === 'number') {
      return { cash: meta.balance, warnings }
    }
  }

  // Fallback: all-time income minus expenses
  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('org_id', orgId)

  if (!txns || txns.length === 0) {
    warnings.push('No transaction data found. Cash balance cannot be calculated.')
    return { cash: 0, warnings }
  }

  warnings.push('Cash balance estimated from transactions — connect a bank for accuracy.')
  const cash = txns.reduce((sum, t) => {
    return t.type === 'income' ? sum + (t.amount ?? 0) : sum - (t.amount ?? 0)
  }, 0)
  return { cash, warnings }
}

export async function getNetBurn(orgId: string): Promise<{ netBurn: number; warnings: string[] }> {
  const [{ mrr, warnings: w1 }, { burnRate, warnings: w2 }] = await Promise.all([
    getMRR(orgId),
    getBurnRate(orgId),
  ])
  return { netBurn: burnRate - mrr, warnings: [...w1, ...w2] }
}

export async function getRunway(
  orgId: string
): Promise<{ runway: number | 'infinite'; warnings: string[] }> {
  const [{ cash, warnings: w1 }, { netBurn, warnings: w2 }] = await Promise.all([
    getCashBalance(orgId),
    getNetBurn(orgId),
  ])
  const warnings = [...w1, ...w2]

  if (netBurn <= 0) return { runway: 'infinite', warnings }
  if (cash <= 0) {
    warnings.push('Cash balance is zero or negative.')
    return { runway: 0, warnings }
  }
  return { runway: Math.floor(cash / netBurn), warnings }
}

// ─── MRR Trend ───────────────────────────────────────────────────────────────

export async function getMRRTrend(
  orgId: string,
  months = 6
): Promise<MRRTrend[]> {
  const results: MRRTrend[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = monthsAgo(i)
    const month = isoMonth(d)
    const { mrr } = await getMRR(orgId, month)
    results.push({ month, mrr, arr: mrr * 12 })
  }

  return results
}

// ─── P&L ─────────────────────────────────────────────────────────────────────

export async function getPnL(
  orgId: string,
  month: string // ISO "YYYY-MM-DD"
): Promise<PnLReport> {
  const supabase = await createClient()
  const nextMonth = new Date(month)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const nextMonthStr = nextMonth.toISOString().split('T')[0]

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, type, category')
    .eq('org_id', orgId)
    .gte('date', month)
    .lt('date', nextMonthStr)

  const dataWarnings: string[] = []
  if (!txns || txns.length === 0) {
    dataWarnings.push('No transactions found for this period.')
  }

  const revenueMap = new Map<string, { amount: number; count: number }>()
  const expenseMap = new Map<string, { amount: number; count: number }>()

  for (const t of txns ?? []) {
    const cat = t.category ?? 'Uncategorized'
    const map = t.type === 'income' ? revenueMap : expenseMap
    const existing = map.get(cat) ?? { amount: 0, count: 0 }
    map.set(cat, { amount: existing.amount + (t.amount ?? 0), count: existing.count + 1 })
  }

  const toLineItems = (map: Map<string, { amount: number; count: number }>): PnLLineItem[] =>
    Array.from(map.entries())
      .map(([category, { amount, count }]) => ({ category, amount, transactionCount: count }))
      .sort((a, b) => b.amount - a.amount)

  const revenue = toLineItems(revenueMap)
  const expenses = toLineItems(expenseMap)
  const totalRevenue = revenue.reduce((s, l) => s + l.amount, 0)
  const totalExpenses = expenses.reduce((s, l) => s + l.amount, 0)

  return {
    month,
    revenue,
    totalRevenue,
    expenses,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    dataWarnings,
  }
}

// ─── Customers & Churn ───────────────────────────────────────────────────────

export async function getActiveCustomers(orgId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active')
  return count ?? 0
}

export async function getChurnRate(
  orgId: string,
  month: string
): Promise<{ churnRate: number; warnings: string[] }> {
  const supabase = await createClient()
  const warnings: string[] = []
  const nextMonth = new Date(month)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const nextStr = nextMonth.toISOString().split('T')[0]

  // Customers active at start of month
  const { count: startCount } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active')
    .lte('started_at', month)

  // Customers who churned during the month
  const { count: churnCount } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'cancelled')
    .gte('cancelled_at', month)
    .lt('cancelled_at', nextStr)

  if (!startCount || startCount === 0) {
    warnings.push('No subscription data available to calculate churn.')
    return { churnRate: 0, warnings }
  }

  return { churnRate: (churnCount ?? 0) / startCount, warnings }
}

// ─── Forecast ────────────────────────────────────────────────────────────────

export async function getForecast(
  orgId: string,
  growthRate: number,  // monthly growth rate, e.g. 0.10 = 10%
  forecastMonths: number
): Promise<ForecastMonth[]> {
  const [{ mrr: currentMRR }, { burnRate }, { cash: currentCash }] = await Promise.all([
    getMRR(orgId),
    getBurnRate(orgId),
    getCashBalance(orgId),
  ])

  const results: ForecastMonth[] = []
  let cash = currentCash

  for (let i = 1; i <= forecastMonths; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    const month = isoMonth(d)
    const projectedMRR = currentMRR * Math.pow(1 + growthRate, i)
    const projectedExpenses = burnRate
    const netCashFlow = projectedMRR - projectedExpenses
    cash += netCashFlow

    const netBurn = projectedExpenses - projectedMRR
    const projectedRunway: number | 'infinite' =
      netBurn <= 0 ? 'infinite' : Math.max(0, Math.floor(cash / netBurn))

    results.push({
      month,
      projectedMRR,
      projectedExpenses,
      projectedCash: cash,
      projectedRunway,
    })
  }

  return results
}

// ─── Data Completeness ───────────────────────────────────────────────────────

export async function getDataCompleteness(orgId: string): Promise<DataCompletenessResult> {
  const supabase = await createClient()
  const warnings: string[] = []

  const { data: connections } = await supabase
    .from('connections')
    .select('provider, status')
    .eq('org_id', orgId)

  const connMap = new Map((connections ?? []).map((c) => [c.provider, c.status]))

  const stripeConnected = connMap.get('stripe') === 'connected'
  const bankConnected = connMap.get('plaid') === 'connected'
  const shopifyConnected = connMap.get('shopify') === 'connected'
  const paypalConnected = connMap.get('paypal') === 'connected'

  const { count: manualCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('source', 'manual')

  const { count: csvCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('source', 'csv')

  const hasManualEntries = (manualCount ?? 0) > 0
  const hasCsvImports = (csvCount ?? 0) > 0

  const hasRevenue = stripeConnected || shopifyConnected || paypalConnected || hasManualEntries || hasCsvImports
  const hasExpenses = bankConnected || hasManualEntries || hasCsvImports

  let revenueCompleteness: 'high' | 'medium' | 'low' = 'low'
  if (stripeConnected) revenueCompleteness = 'high'
  else if (shopifyConnected || paypalConnected) revenueCompleteness = 'medium'
  else if (hasRevenue) revenueCompleteness = 'low'

  let expenseCompleteness: 'high' | 'medium' | 'low' = 'low'
  if (bankConnected) expenseCompleteness = 'high'
  else if (hasExpenses) expenseCompleteness = 'medium'

  if (!stripeConnected) warnings.push('Connect Stripe for accurate revenue tracking.')
  if (!bankConnected) warnings.push('Connect a bank account via Plaid for expense tracking.')
  if (!hasRevenue) warnings.push('No revenue data found. Add income manually or connect an integration.')

  const score =
    (stripeConnected ? 30 : 0) +
    (bankConnected ? 30 : 0) +
    (shopifyConnected ? 10 : 0) +
    (paypalConnected ? 10 : 0) +
    (hasManualEntries ? 10 : 0) +
    (hasCsvImports ? 10 : 0)

  return {
    stripeConnected,
    bankConnected,
    shopifyConnected,
    paypalConnected,
    hasManualEntries,
    hasCsvImports,
    revenueCompleteness,
    expenseCompleteness,
    overallScore: score,
    warnings,
  }
}

// ─── Dashboard aggregate ─────────────────────────────────────────────────────

export async function getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
  const [
    { mrr, warnings: w1 },
    { arr, warnings: w2 },
    { cash: cashBalance, warnings: w3 },
    { burnRate, warnings: w4 },
    { netBurn, warnings: w5 },
    { runway, warnings: w6 },
    activeCustomers,
    mrrTrend,
    dataCompleteness,
  ] = await Promise.all([
    getMRR(orgId),
    getARR(orgId),
    getCashBalance(orgId),
    getBurnRate(orgId),
    getNetBurn(orgId),
    getRunway(orgId),
    getActiveCustomers(orgId),
    getMRRTrend(orgId, 6),
    getDataCompleteness(orgId),
  ])

  const { churnRate } = await getChurnRate(orgId, startOfMonth(new Date()))

  const allWarnings = [...new Set([...w1, ...w2, ...w3, ...w4, ...w5, ...w6])]

  return {
    mrr,
    arr,
    cashBalance,
    runway,
    activeCustomers,
    burnRate,
    netBurn,
    churnRate,
    mrrTrend,
    dataCompleteness,
    dataWarnings: allWarnings,
  }
}
