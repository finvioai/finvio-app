import type { WorkflowDefinition, WorkflowContext, WorkflowStepResult } from '../engine'

function getPrevMonthDefault(): string {
  const now = new Date()
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const m = now.getMonth() === 0 ? 12 : now.getMonth()
  return `${y}-${String(m).padStart(2, '0')}`
}

function parseMonthBounds(parameters: Record<string, unknown>) {
  const raw = ((parameters.month as string) || getPrevMonthDefault()).trim()
  const [yearStr, monthStr] = raw.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextDate = new Date(year, month, 1)
  const nextMonthStart = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`
  const prevDate = new Date(year, month - 2, 1)
  const prevMonthStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`
  const displayMonth = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  return { monthStart, nextMonthStart, prevMonthStart, displayMonth }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// Expense categories that are typically prepaid or subject to amortization
const PREPAID_CATEGORIES = new Set([
  'insurance', 'rent', 'prepaid', 'prepaid expense', 'software', 'saas',
  'subscriptions', 'annual subscription', 'license',
])

function isPrepaidCategory(category: string | null): boolean {
  if (!category) return false
  return PREPAID_CATEGORIES.has(category.toLowerCase())
}

async function detectMissingAccruals(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { monthStart, nextMonthStart, prevMonthStart, displayMonth } = parseMonthBounds(ctx.parameters)

  // Fetch recurring expenses from the prior month
  const { data: priorMonthExpenses, error: priorErr } = await ctx.supabase
    .from('transactions')
    .select('vendor, description, amount, category, type')
    .eq('org_id', ctx.orgId)
    .eq('type', 'expense')
    .not('recurrence', 'is', null)
    .gte('date', prevMonthStart)
    .lt('date', monthStart)
    .is('deleted_at', null)

  if (priorErr) return { status: 'failed', message: `Could not query prior-month transactions: ${priorErr.message}` }

  if (!priorMonthExpenses?.length) {
    return { status: 'success', message: `No recurring expenses found in the prior month to check against.` }
  }

  // Fetch expenses that DID appear in the target month for comparison
  const { data: thisMonthExpenses, error: thisErr } = await ctx.supabase
    .from('transactions')
    .select('vendor, description, amount, category')
    .eq('org_id', ctx.orgId)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', nextMonthStart)
    .is('deleted_at', null)

  if (thisErr) return { status: 'failed', message: `Could not query ${displayMonth} transactions: ${thisErr.message}` }

  const thisMonthVendors = new Set(
    (thisMonthExpenses ?? []).map(t => (t.vendor ?? t.description ?? '').toLowerCase())
  )

  // Flag prior-month recurring expenses with no match in the target month
  const missing: Array<{ vendor: string; amount: number; category: string | null }> = []
  for (const exp of priorMonthExpenses) {
    const key = (exp.vendor ?? exp.description ?? '').toLowerCase()
    if (key && !thisMonthVendors.has(key)) {
      missing.push({ vendor: exp.vendor ?? exp.description ?? 'Unknown', amount: exp.amount, category: exp.category })
    }
  }

  if (missing.length === 0) {
    return { status: 'success', message: `All prior-month recurring expenses appear accounted for in ${displayMonth}.` }
  }

  const totalMissing = missing.reduce((sum, m) => sum + m.amount, 0)
  const warnings = missing.map(
    m => `${m.vendor}${m.category ? ` (${m.category})` : ''} — ${fmt(m.amount)} — appears to be missing from ${displayMonth}. Consider accruing this expense.`
  )

  return {
    status: 'approval_required',
    message: `${missing.length} recurring expense${missing.length !== 1 ? 's' : ''} (${fmt(totalMissing)} total) may need accruals in ${displayMonth}.`,
    warnings,
    data: { missingCount: missing.length, missingTotal: totalMissing },
  }
}

async function checkPrepaidAmortization(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { monthStart, nextMonthStart, displayMonth } = parseMonthBounds(ctx.parameters)

  // Find large lump-sum expenses in the target month that are typically prepaid
  const { data: expenses, error } = await ctx.supabase
    .from('transactions')
    .select('id, description, vendor, amount, category')
    .eq('org_id', ctx.orgId)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', nextMonthStart)
    .is('deleted_at', null)
    .gt('amount', 500) // Only flag meaningful amounts

  if (error) return { status: 'failed', message: `Could not query expenses: ${error.message}` }

  const prepaidCandidates = (expenses ?? []).filter(
    exp => isPrepaidCategory(exp.category)
  )

  // Also flag large expenses (>$2,000) in prepaid-prone categories
  const largePrepaid = (expenses ?? []).filter(
    exp => exp.amount > 2000 && isPrepaidCategory(exp.category)
  )

  if (prepaidCandidates.length === 0) {
    return { status: 'success', message: `No prepaid expenses detected in ${displayMonth}.` }
  }

  const totalPrepaid = prepaidCandidates.reduce((sum, e) => sum + e.amount, 0)

  const warnings = largePrepaid.map(
    exp => `${exp.vendor ?? exp.description ?? 'Expense'} — ${fmt(exp.amount)} in "${exp.category ?? 'uncategorized'}". If this covers multiple months, amortize into monthly prepaid entries.`
  )

  return {
    status: largePrepaid.length > 0 ? 'approval_required' : 'warning',
    message: `${prepaidCandidates.length} potential prepaid expense${prepaidCandidates.length !== 1 ? 's' : ''} found in ${displayMonth} totalling ${fmt(totalPrepaid)}.`,
    warnings: warnings.length > 0
      ? warnings
      : [`${prepaidCandidates.length} expense${prepaidCandidates.length !== 1 ? 's' : ''} in prepaid categories (${fmt(totalPrepaid)}) — review for amortization.`],
    data: { prepaidCount: prepaidCandidates.length, prepaidTotal: totalPrepaid },
  }
}

async function checkDeferredRevenue(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { monthStart, nextMonthStart, displayMonth } = parseMonthBounds(ctx.parameters)

  // Invoices paid in the target month but with a future invoice date (advance payments)
  const { data: advancePayments, error: advErr } = await ctx.supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, amount, invoice_date, paid_at')
    .eq('org_id', ctx.orgId)
    .eq('status', 'paid')
    .gte('paid_at', monthStart)
    .lt('paid_at', nextMonthStart)
    .not('invoice_date', 'is', null)

  if (advErr) return { status: 'failed', message: `Could not query invoices: ${advErr.message}` }

  // Invoices where paid_at is in our target month but invoice_date is in a later month
  const deferred = (advancePayments ?? []).filter(inv => {
    if (!inv.invoice_date || !inv.paid_at) return false
    return new Date(inv.invoice_date) > new Date(nextMonthStart)
  })

  if (deferred.length === 0) {
    return { status: 'success', message: `No deferred revenue scenarios detected for ${displayMonth}.` }
  }

  const totalDeferred = deferred.reduce((sum, inv) => sum + inv.amount, 0)
  const warnings = deferred.map(
    inv => `Invoice ${inv.invoice_number} (${inv.customer_name ?? 'Unknown'}) — ${fmt(inv.amount)} paid in ${displayMonth} but service date is ${inv.invoice_date}. Record as deferred revenue until service period begins.`
  )

  return {
    status: 'approval_required',
    message: `${deferred.length} advance payment${deferred.length !== 1 ? 's' : ''} totalling ${fmt(totalDeferred)} should be deferred into future periods.`,
    warnings,
    data: { deferredCount: deferred.length, deferredTotal: totalDeferred },
  }
}

async function adjustingEntriesSummary(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { displayMonth } = parseMonthBounds(ctx.parameters)

  // This step is a human checkpoint — it always returns approval_required
  // so the human knows they need to action the findings before closing the month.
  return {
    status: 'approval_required',
    message: `Review complete for ${displayMonth}. Book any flagged adjusting entries before running Month-End Close.`,
    warnings: [
      'Adjusting entries identified above must be booked manually. Once done, run the Month-End Close workflow.',
    ],
  }
}

export const adjustingEntriesWorkflow: WorkflowDefinition = {
  id: 'adjusting-entries',
  name: 'Adjusting Entries Review',
  description:
    'Detect missing accruals, prepaid amortizations, and deferred revenue for a complete accounting close.',
  category: 'accounting',
  estimatedDuration: '~15 seconds',
  parameters: [
    {
      key: 'month',
      label: 'Month',
      type: 'month',
      required: false,
      default: '',
    },
  ],
  steps: [
    { id: 'detect-missing-accruals',   name: 'Detect missing accruals',          run: detectMissingAccruals },
    { id: 'check-prepaid-amortization', name: 'Check prepaid amortization',       run: checkPrepaidAmortization },
    { id: 'check-deferred-revenue',    name: 'Check deferred revenue',            run: checkDeferredRevenue },
    { id: 'adjusting-entries-summary', name: 'Adjusting entries summary',         run: adjustingEntriesSummary },
  ],
}
