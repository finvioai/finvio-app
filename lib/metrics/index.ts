import { createClient } from '@/lib/supabase/server'
import type {
  MRRTrend,
  PnLReport,
  PnLLineItem,
  ForecastMonth,
  DataCompletenessResult,
  DashboardMetrics,
  BusinessModel,
  BusinessModelResult,
  RevenueByTypeResult,
  ProjectSummary,
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

  // Fallback: income transactions in the month.
  // one_time income is excluded — it isn't recurring and shouldn't inflate MRR.
  // annual income is normalised to monthly (÷12); quarterly to monthly (÷3).
  // Untagged (null) income is included at full amount for backward compatibility.
  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, recurrence')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('type', 'income')
    .neq('recurrence', 'one_time')
    .gte('date', targetMonth)
    .lt('date', nextMonth.toISOString().split('T')[0])

  if (!txns || txns.length === 0) {
    warnings.push('No revenue data found for this period.')
    return { mrr: 0, warnings }
  }

  warnings.push('MRR estimated from transactions — connect Stripe for accuracy.')
  const mrr = txns.reduce((sum, t) => {
    const amount = t.amount ?? 0
    if (t.recurrence === 'annual') return sum + amount / 12
    if (t.recurrence === 'quarterly') return sum + amount / 3
    return sum + amount // monthly or null → full amount
  }, 0)
  return { mrr, warnings }
}

export async function getARR(orgId: string): Promise<{ arr: number; warnings: string[] }> {
  const { mrr, warnings } = await getMRR(orgId)
  return { arr: mrr * 12, warnings }
}

// ─── Burn & Cash ─────────────────────────────────────────────────────────────

export async function getBurnRate(
  orgId: string
): Promise<{ burnRate: number; warnings: string[] }> {
  const supabase = await createClient()
  const warnings: string[] = []

  // Fetch last 12 months so annual/quarterly expenses are always captured
  const since12 = monthsAgo(12).toISOString().split('T')[0]
  const since3  = monthsAgo(3).toISOString().split('T')[0]

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, date, recurrence')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('type', 'expense')
    .gte('date', since12)

  if (!txns || txns.length === 0) {
    warnings.push('No expense data found. Add expenses or connect a bank account.')
    return { burnRate: 0, warnings }
  }

  let burnRate = 0

  // monthly → average over distinct months that had expenses.
  // Untagged (null) expenses are excluded and surfaced as a warning: the system
  // has no basis to assume they recur monthly, quarterly, annually, or at all.
  const monthlyExpenses = txns.filter(
    (t) => t.recurrence === 'monthly'
  ).filter((t) => t.date >= since3)
  const monthsWithMonthly = new Set(
    monthlyExpenses.map((t) => (t.date as string).slice(0, 7))
  )
  const monthDivisor = Math.max(monthsWithMonthly.size, 1)
  burnRate += monthlyExpenses.reduce((s, t) => s + (t.amount ?? 0), 0) / monthDivisor

  // untagged → excluded from burn rate, warn so the user can tag them
  const untaggedExpenses = txns.filter((t) => !t.recurrence).filter((t) => t.date >= since3)
  if (untaggedExpenses.length > 0) {
    warnings.push(
      `${untaggedExpenses.length} expense${untaggedExpenses.length !== 1 ? 's' : ''} have no recurrence tag and were excluded from burn rate. Tag them on the Transactions or Expenses page to include them.`
    )
  }

  // quarterly → normalize per quarter (÷3), averaged across distinct quarters.
  // A new quarterly sub that appears in only 1 quarter contributes amount÷3, not amount÷12.
  const quarterly = txns.filter((t) => t.recurrence === 'quarterly')
  if (quarterly.length > 0) {
    const toQuarter = (d: string) => {
      const [yr, mo] = d.split('-')
      return `${yr}-Q${Math.ceil(parseInt(mo) / 3)}`
    }
    const byQuarter = new Map<string, number>()
    for (const t of quarterly) {
      const q = toQuarter(t.date as string)
      byQuarter.set(q, (byQuarter.get(q) ?? 0) + (t.amount ?? 0))
    }
    const avgPerQuarter =
      [...byQuarter.values()].reduce((s, v) => s + v, 0) / byQuarter.size
    burnRate += avgPerQuarter / 3
  }

  // annual → normalize per year (÷12), averaged across distinct years.
  const annual = txns.filter((t) => t.recurrence === 'annual')
  if (annual.length > 0) {
    const byYear = new Map<string, number>()
    for (const t of annual) {
      const yr = (t.date as string).slice(0, 4)
      byYear.set(yr, (byYear.get(yr) ?? 0) + (t.amount ?? 0))
    }
    const avgPerYear =
      [...byYear.values()].reduce((s, v) => s + v, 0) / byYear.size
    burnRate += avgPerYear / 12
  }

  // one_time → excluded from burn rate (capital/non-recurring spend)
  const oneTimeTotal = txns
    .filter((t) => t.recurrence === 'one_time')
    .reduce((s, t) => s + (t.amount ?? 0), 0)
  if (oneTimeTotal > 0) {
    warnings.push(
      `$${oneTimeTotal.toLocaleString()} in one-time expenses excluded from burn rate.`
    )
  }

  return { burnRate: Math.round(burnRate * 100) / 100, warnings }
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
    .eq('status', 'active')
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
    .is('deleted_at', null)

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
  // Build month strings oldest-first, then fetch all in parallel
  const monthStrings = Array.from({ length: months }, (_, i) =>
    isoMonth(monthsAgo(months - 1 - i))
  )
  return Promise.all(
    monthStrings.map(async (month) => {
      const { mrr } = await getMRR(orgId, month)
      return { month, mrr, arr: mrr * 12 }
    })
  )
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
    .is('deleted_at', null)
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
      projectedRevenue: projectedMRR,
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

  const stripeConnected = connMap.get('stripe') === 'active'
  const bankConnected = connMap.get('plaid') === 'active'
  const shopifyConnected = connMap.get('shopify') === 'active'
  const paypalConnected = connMap.get('paypal') === 'active'

  const { count: manualCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('source', 'manual')

  const { count: csvCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('deleted_at', null)
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

// ─── Business Model Inference ────────────────────────────────────────────────

export async function inferBusinessModel(orgId: string): Promise<BusinessModelResult> {
  const supabase = await createClient()

  // Signal 1: active subscriptions → strong SaaS signal
  const { count: activeSubs } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active')

  // Signal 2: revenue_type distribution over last 90 days
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const sinceDate = ninetyDaysAgo.toISOString().split('T')[0]

  const { data: income } = await supabase
    .from('transactions')
    .select('revenue_type, category')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('type', 'income')
    .gte('date', sinceDate)

  const total = income?.length ?? 0
  const recurringCount = income?.filter(
    (t) => t.revenue_type === 'recurring' || t.category === 'Subscription Revenue'
  ).length ?? 0
  const projectCount = income?.filter(
    (t) => t.revenue_type === 'project' || t.revenue_type === 'milestone'
  ).length ?? 0

  const recurringRatio = total > 0 ? recurringCount / total : 0
  const projectRatio   = total > 0 ? projectCount / total : 0

  const hasRecurring = (activeSubs ?? 0) > 0 || recurringRatio > 0.3
  const hasProject   = projectRatio > 0.25
  const hasOneTime   = !hasRecurring && !hasProject && total > 0

  let model: BusinessModel = 'saas'
  if (hasRecurring && hasProject) model = 'mixed'
  else if (hasRecurring)          model = 'saas'
  else if (hasProject)            model = 'project_based'
  else if (hasOneTime)            model = 'smb'

  return { model, hasRecurring, hasProject, hasOneTime }
}

// ─── Total Revenue (no subscription assumption) ───────────────────────────────

export async function getTotalRevenue(
  orgId: string,
  month?: string
): Promise<{ revenue: number; warnings: string[] }> {
  const supabase = await createClient()
  const warnings: string[] = []
  const targetMonth = month ?? startOfMonth(new Date())
  const nextMonth = new Date(targetMonth)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('type', 'income')
    .gte('date', targetMonth)
    .lt('date', nextMonth.toISOString().split('T')[0])

  if (!txns || txns.length === 0) {
    warnings.push('No revenue data found for this period.')
    return { revenue: 0, warnings }
  }

  const revenue = txns.reduce((sum, t) => sum + (t.amount ?? 0), 0)
  return { revenue, warnings }
}

// ─── Gross Profit ─────────────────────────────────────────────────────────────

export async function getGrossProfit(
  orgId: string,
  month?: string
): Promise<{ profit: number; warnings: string[] }> {
  const supabase = await createClient()
  const warnings: string[] = []
  const targetMonth = month ?? startOfMonth(new Date())
  const nextMonth = new Date(targetMonth)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const nextMonthStr = nextMonth.toISOString().split('T')[0]

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .gte('date', targetMonth)
    .lt('date', nextMonthStr)

  if (!txns || txns.length === 0) {
    warnings.push('No transaction data found for this period.')
    return { profit: 0, warnings }
  }

  const revenue  = txns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount ?? 0), 0)
  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0)
  return { profit: revenue - expenses, warnings }
}

// ─── Average Monthly Revenue ──────────────────────────────────────────────────

export async function getAvgMonthlyRevenue(
  orgId: string,
  months = 3
): Promise<{ avg: number; warnings: string[] }> {
  const monthStrings = Array.from({ length: months }, (_, i) =>
    isoMonth(monthsAgo(months - 1 - i))
  )
  const results = await Promise.all(monthStrings.map((m) => getTotalRevenue(orgId, m)))
  const total = results.reduce((s, r) => s + r.revenue, 0)
  // Divide only by months that actually had revenue — a brand-new business
  // shouldn't have its first month's revenue diluted by two zero-revenue months.
  const activeMonths = results.filter(r => r.revenue > 0).length
  const divisor = Math.max(activeMonths, 1)
  const warnings = results.flatMap((r) => r.warnings)
  return { avg: total / divisor, warnings: [...new Set(warnings)] }
}

// ─── Revenue By Type ──────────────────────────────────────────────────────────

export async function getRevenueByType(
  orgId: string,
  month?: string
): Promise<RevenueByTypeResult> {
  const supabase = await createClient()
  const targetMonth = month ?? startOfMonth(new Date())
  const nextMonth = new Date(targetMonth)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, revenue_type')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('type', 'income')
    .gte('date', targetMonth)
    .lt('date', nextMonth.toISOString().split('T')[0])

  const result: RevenueByTypeResult = { recurring: 0, one_time: 0, project: 0, milestone: 0, unclassified: 0 }

  for (const t of txns ?? []) {
    const amt = t.amount ?? 0
    const rt = t.revenue_type as keyof RevenueByTypeResult | null
    if (rt && rt in result) {
      result[rt] += amt
    } else {
      result.unclassified += amt
    }
  }

  return result
}

// ─── Historical Forecast (for SMB / project-based businesses) ─────────────────

export async function getHistoricalForecast(
  orgId: string,
  forecastMonths: number
): Promise<ForecastMonth[]> {
  // Compute average monthly revenue and growth rate from last 6 months
  const histMonths = 6
  const monthStrings = Array.from({ length: histMonths }, (_, i) =>
    isoMonth(monthsAgo(histMonths - 1 - i))
  )
  const revenueByMonth = await Promise.all(monthStrings.map((m) => getTotalRevenue(orgId, m)))
  const revenues = revenueByMonth.map((r) => r.revenue)

  // Calculate average monthly growth rate
  const growthRates: number[] = []
  for (let i = 1; i < revenues.length; i++) {
    if (revenues[i - 1] > 0) {
      growthRates.push((revenues[i] - revenues[i - 1]) / revenues[i - 1])
    }
  }
  const avgGrowthRate = growthRates.length > 0
    ? growthRates.reduce((s, r) => s + r, 0) / growthRates.length
    : 0

  // Use the most recent month that actually had revenue as the baseline.
  // Without this a single zero-revenue month at the end (e.g. month just started)
  // would make the forecast project forward from $0.
  const baseRevenue = [...revenues].reverse().find(r => r > 0) ?? 0
  const [{ burnRate }, { cash: currentCash }] = await Promise.all([
    getBurnRate(orgId),
    getCashBalance(orgId),
  ])

  const results: ForecastMonth[] = []
  let cash = currentCash

  for (let i = 1; i <= forecastMonths; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    const month = isoMonth(d)
    const projectedRevenue = baseRevenue * Math.pow(1 + avgGrowthRate, i)
    const projectedExpenses = burnRate
    cash += projectedRevenue - projectedExpenses
    const netBurn = projectedExpenses - projectedRevenue
    const projectedRunway: number | 'infinite' =
      netBurn <= 0 ? 'infinite' : Math.max(0, Math.floor(cash / netBurn))

    results.push({
      month,
      projectedMRR: projectedRevenue,
      projectedRevenue,
      projectedExpenses,
      projectedCash: cash,
      projectedRunway,
    })
  }

  return results
}

// ─── Project Summary ──────────────────────────────────────────────────────────

export async function getProjectSummary(orgId: string): Promise<ProjectSummary[]> {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (!projects || projects.length === 0) return []

  return Promise.all(projects.map(async (project) => {
    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('project_id', project.id)
      .is('deleted_at', null)

    const collected = txns?.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount ?? 0), 0) ?? 0
    const expenses  = txns?.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0) ?? 0
    const outstanding = project.budget != null ? project.budget - collected : 0

    return {
      ...project,
      collected,
      expenses,
      outstanding,
    } as ProjectSummary
  }))
}

// ─── Dashboard aggregate ─────────────────────────────────────────────────────

export async function getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
  const currentMonth = startOfMonth(new Date())

  const [
    { mrr, warnings: w1 },
    { cash: cashBalance, warnings: w3 },
    { burnRate, warnings: w4 },
    activeCustomers,
    mrrTrend,
    dataCompleteness,
    { churnRate },
    businessModelResult,
    { revenue: totalRevenue },
    { profit: grossProfit },
    { avg: avgMonthlyRevenue },
    revenueByType,
  ] = await Promise.all([
    getMRR(orgId),
    getCashBalance(orgId),
    getBurnRate(orgId),
    getActiveCustomers(orgId),
    getMRRTrend(orgId, 6),
    getDataCompleteness(orgId),
    getChurnRate(orgId, currentMonth),
    inferBusinessModel(orgId),
    getTotalRevenue(orgId, currentMonth),
    getGrossProfit(orgId, currentMonth),
    getAvgMonthlyRevenue(orgId, 3),
    getRevenueByType(orgId, currentMonth),
  ])

  const arr = mrr * 12
  const netBurn = burnRate - mrr
  const runway: number | 'infinite' =
    netBurn <= 0 ? 'infinite' : cashBalance <= 0 ? 0 : Math.floor(cashBalance / netBurn)

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
    dataWarnings: [...new Set([...w1, ...w3, ...w4])],
    businessModel: businessModelResult.model,
    totalRevenue,
    grossProfit,
    avgMonthlyRevenue,
    revenueByType,
  }
}
