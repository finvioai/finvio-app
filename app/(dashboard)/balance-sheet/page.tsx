import { redirect } from 'next/navigation'
import { getSession, getOrgInfo } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function Row({ label, value, bold, indent, positive }: {
  label: string
  value: number | null
  bold?: boolean
  indent?: boolean
  positive?: boolean
}) {
  const display = value === null ? '—' : fmt(value)
  const valueColor = value === null
    ? 'text-gray-400'
    : positive === true
      ? 'text-green-700'
      : positive === false
        ? 'text-red-600'
        : 'text-gray-900'

  return (
    <div className={`flex items-center justify-between py-2 ${indent ? 'pl-6' : ''} ${bold ? 'border-t border-gray-200 font-semibold mt-1' : ''}`}>
      <span className={`text-sm ${bold ? 'text-gray-900' : 'text-gray-600'} ${indent ? 'text-gray-700' : ''}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'text-gray-900 font-semibold' : valueColor}`}>{display}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{title}</h2>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  )
}

export default async function BalanceSheetPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const { orgId } = await getOrgInfo()
  if (!orgId) redirect('/login')

  const supabase = await createClient()

  const today = new Date()
  const asOfLabel = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const [
    incomeResult,
    expenseResult,
    arResult,
    recurringMonthlyResult,
    recurringAnnualResult,
    recurringQuarterlyResult,
  ] = await Promise.all([
    // Total income (all-time)
    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'income'),

    // Total expenses (all-time)
    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'expense'),

    // Accounts receivable = unpaid invoices
    supabase
      .from('invoices')
      .select('amount')
      .eq('org_id', orgId)
      .in('status', ['draft', 'sent']),

    // Monthly recurring expenses
    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'expense')
      .eq('recurrence', 'monthly'),

    // Annual recurring expenses (normalized to monthly)
    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'expense')
      .eq('recurrence', 'annual'),

    // Quarterly recurring expenses (normalized to monthly)
    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'expense')
      .eq('recurrence', 'quarterly'),
  ])

  const totalIncome = (incomeResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const totalExpenses = (expenseResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const cashPosition = totalIncome - totalExpenses

  const accountsReceivable = (arResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  const totalCurrentAssets = cashPosition + accountsReceivable
  const totalAssets = totalCurrentAssets

  // Monthly obligations: sum of recurring costs normalized to a single month
  const monthlyRecurring = (recurringMonthlyResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const annualNormalized = (recurringAnnualResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0) / 12
  const quarterlyNormalized = (recurringQuarterlyResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0) / 3
  const monthlyObligations = monthlyRecurring + annualNormalized + quarterlyNormalized

  const totalLiabilities = monthlyObligations
  const retainedEarnings = totalAssets - totalLiabilities
  const totalEquity = retainedEarnings

  const checksum = totalAssets - (totalLiabilities + totalEquity)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>
          <p className="text-sm text-gray-500 mt-1">As of {asOfLabel}</p>
        </div>

        <div className="space-y-4">
          {/* Assets */}
          <Section title="Assets">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pb-1">Current Assets</p>
              <Row label="Cash & Equivalents" value={cashPosition} indent positive={cashPosition >= 0} />
              <Row label="Accounts Receivable" value={accountsReceivable} indent />
              <Row label="Total Current Assets" value={totalCurrentAssets} bold positive={totalCurrentAssets >= 0} />
            </div>
            <Row label="Total Assets" value={totalAssets} bold positive={totalAssets >= 0} />
          </Section>

          {/* Liabilities */}
          <Section title="Liabilities">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pb-1">Current Liabilities</p>
              <Row label="Monthly Recurring Obligations" value={monthlyObligations > 0 ? monthlyObligations : null} indent />
              <Row label="Total Current Liabilities" value={monthlyObligations} bold />
            </div>
            <Row label="Total Liabilities" value={totalLiabilities} bold />
          </Section>

          {/* Equity */}
          <Section title="Owner's Equity">
            <Row label="Retained Earnings" value={retainedEarnings} indent positive={retainedEarnings >= 0} />
            <Row label="Total Equity" value={totalEquity} bold positive={totalEquity >= 0} />
          </Section>

          {/* Totals check */}
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Total Liabilities + Equity</span>
              <span className={`text-sm font-semibold tabular-nums ${(totalLiabilities + totalEquity) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {fmt(totalLiabilities + totalEquity)}
              </span>
            </div>
            {Math.abs(checksum) > 0.01 && (
              <p className="text-xs text-amber-600 mt-1">
                Note: Variance of {fmt(Math.abs(checksum))} — some assets or liabilities may not be tracked.
              </p>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 text-center pb-2">
            Cash & Equivalents = cumulative income minus cumulative expenses. Accounts Receivable = open invoices.
            Monthly Recurring Obligations = recurring expenses normalized to one month.
            This is a simplified balance sheet based on tracked transactions.
          </p>
        </div>
      </div>
    </div>
  )
}
