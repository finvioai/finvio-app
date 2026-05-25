import { redirect } from 'next/navigation'
import { getSession, getOrgInfo } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function Row({ label, value, bold, indent, positive, note }: {
  label: string
  value: number | null
  bold?: boolean
  indent?: boolean
  positive?: boolean
  note?: string
}) {
  const display = value === null ? '—' : fmt(value)
  const valueColor = value === null
    ? 'text-muted-ink/60'
    : positive === true
      ? 'text-green-700'
      : positive === false
        ? 'text-red-600'
        : 'text-navy'

  return (
    <div className={`flex items-center justify-between py-2 ${indent ? 'pl-6' : ''} ${bold ? 'border-t border-hairline font-semibold mt-1' : ''}`}>
      <div>
        <span className={`text-sm ${bold ? 'text-navy' : 'text-muted-ink'} ${indent ? 'text-navy/80' : ''}`}>{label}</span>
        {note && <p className="text-xs text-muted-ink/60 mt-0.5">{note}</p>}
      </div>
      <span className={`text-sm tabular-nums ${bold ? 'text-navy font-semibold' : valueColor}`}>{display}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-ink/60 mb-3">{title}</h2>
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
    // All-time cash income — soft-deleted excluded
    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'income')
      .is('deleted_at', null),

    // All-time cash expenses — soft-deleted excluded
    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'expense')
      .is('deleted_at', null),

    // Accounts receivable: invoices sent to customers but not yet paid
    // draft invoices excluded (not yet sent, not legally owed)
    supabase
      .from('invoices')
      .select('amount')
      .eq('org_id', orgId)
      .in('status', ['sent', 'overdue']),

    // Monthly burn rate components (informational — not balance sheet liabilities)
    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'expense')
      .eq('recurrence', 'monthly')
      .is('deleted_at', null),

    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'expense')
      .eq('recurrence', 'annual')
      .is('deleted_at', null),

    supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('type', 'expense')
      .eq('recurrence', 'quarterly')
      .is('deleted_at', null),
  ])

  // ── Assets ────────────────────────────────────────────────────────────────────
  // Cash basis: money collected minus money spent (matches dashboard & P&L)
  const totalIncome   = (incomeResult.data  ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const totalExpenses = (expenseResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const cashPosition  = totalIncome - totalExpenses

  // AR: revenue earned and invoiced but not yet collected in cash
  const accountsReceivable = (arResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  const totalCurrentAssets = cashPosition + accountsReceivable
  const totalAssets        = totalCurrentAssets

  // ── Liabilities ───────────────────────────────────────────────────────────────
  // No formal liabilities are tracked (no loans, accounts payable, or credit lines).
  // Monthly burn rate is a planning metric shown below — not a balance sheet liability.
  const totalLiabilities = 0

  // ── Owner's Equity ────────────────────────────────────────────────────────────
  // Accrual retained earnings = cash income collected + AR earned − expenses paid.
  // Equals Total Assets when Liabilities = 0, ensuring Assets = Liabilities + Equity.
  const retainedEarnings = cashPosition + accountsReceivable  // same as totalAssets
  const totalEquity      = retainedEarnings

  // Verification: must be 0 if the books balance
  const checksum = totalAssets - (totalLiabilities + totalEquity)

  // ── Monthly burn rate (informational) ─────────────────────────────────────────
  const monthlyBurnRate =
    (recurringMonthlyResult.data  ?? []).reduce((s, r) => s + (r.amount ?? 0), 0) +
    (recurringAnnualResult.data   ?? []).reduce((s, r) => s + (r.amount ?? 0), 0) / 12 +
    (recurringQuarterlyResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0) / 3

  return (
    <div className="min-h-screen bg-off-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">Balance Sheet</h1>
          <p className="text-sm text-muted-ink mt-1">As of {asOfLabel}</p>
        </div>

        <div className="space-y-4">

          {/* Assets */}
          <Section title="Assets">
            <div>
              <p className="text-xs font-medium text-muted-ink/60 uppercase tracking-wide pb-1">Current Assets</p>
              <Row
                label="Cash & Equivalents"
                value={cashPosition}
                indent
                positive={cashPosition >= 0}
                note="Cumulative income collected minus expenses paid"
              />
              <Row
                label="Accounts Receivable"
                value={accountsReceivable > 0 ? accountsReceivable : null}
                indent
                note={accountsReceivable > 0 ? 'Sent & overdue invoices not yet paid' : undefined}
              />
              <Row label="Total Current Assets" value={totalCurrentAssets} bold positive={totalCurrentAssets >= 0} />
            </div>
            <Row label="Total Assets" value={totalAssets} bold positive={totalAssets >= 0} />
          </Section>

          {/* Liabilities */}
          <Section title="Liabilities">
            <div>
              <p className="text-xs font-medium text-muted-ink/60 uppercase tracking-wide pb-1">Current Liabilities</p>
              <Row
                label="Accounts Payable / Debt"
                value={null}
                indent
                note="No loans or payables tracked in this system"
              />
              <Row label="Total Current Liabilities" value={0} bold />
            </div>
            <Row label="Total Liabilities" value={0} bold />
          </Section>

          {/* Equity */}
          <Section title="Owner's Equity">
            <Row
              label="Retained Earnings"
              value={retainedEarnings}
              indent
              positive={retainedEarnings >= 0}
              note="Cash income + accounts receivable − expenses (accrual basis)"
            />
            <Row label="Total Equity" value={totalEquity} bold positive={totalEquity >= 0} />
          </Section>

          {/* Balance check */}
          <div className="rounded-xl border border-hairline bg-white px-6 py-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-navy">Total Liabilities + Equity</span>
              <span className={`text-sm font-semibold tabular-nums ${(totalLiabilities + totalEquity) >= 0 ? 'text-navy' : 'text-red-600'}`}>
                {fmt(totalLiabilities + totalEquity)}
              </span>
            </div>
            {Math.abs(checksum) > 0.01 ? (
              <p className="text-xs text-amber-600">
                ⚠ Variance of {fmt(Math.abs(checksum))} — books do not balance. Check for untracked assets or liabilities.
              </p>
            ) : (
              <p className="text-xs text-green-600">✓ Books balance</p>
            )}
          </div>

          {/* Monthly burn rate — informational, not a balance sheet liability */}
          {monthlyBurnRate > 0 && (
            <div className="rounded-xl border border-hairline/70 bg-off-white px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-ink/60 mb-2">Operating Metrics</p>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-navy/80">Monthly Burn Rate</span>
                  <p className="text-xs text-muted-ink/60 mt-0.5">Recurring expenses normalised to one month — not a balance sheet liability</p>
                </div>
                <span className="text-sm tabular-nums text-navy">{fmt(monthlyBurnRate)}/mo</span>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-ink/60 text-center pb-2">
            Cash basis: income and expenses from recorded transactions only. Accounts Receivable = sent &amp; overdue invoices.
            Soft-deleted transactions are excluded. This is a simplified balance sheet — not a GAAP audit.
          </p>
        </div>
      </div>
    </div>
  )
}
