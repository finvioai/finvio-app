import type { WorkflowDefinition, WorkflowContext, WorkflowStepResult } from '../engine'
import { reconcileOrgTransactions } from '@/lib/sync/reconciliation'
import {
  getPnL,
  getMRR,
  getCashBalance,
  getBurnRate,
  getActiveCustomers,
} from '@/lib/metrics'

function getPrevMonthDefault(): string {
  const now = new Date()
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const m = now.getMonth() === 0 ? 12 : now.getMonth() // getMonth() is 0-indexed
  return `${y}-${String(m).padStart(2, '0')}`
}

function parseMonthBounds(parameters: Record<string, unknown>): {
  monthStart: string
  nextMonthStart: string
  displayMonth: string
} {
  const raw = ((parameters.month as string) || getPrevMonthDefault()).trim()
  // raw is "YYYY-MM"
  const [yearStr, monthStr] = raw.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) // 1-indexed
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

  // JS Date: new Date(year, month, 1) → month is 0-indexed in Date constructor,
  // but our 'month' is 1-indexed, so this naturally gives us first of next month
  const nextDate = new Date(year, month, 1)
  const nextYear = nextDate.getFullYear()
  const nextMonth = nextDate.getMonth() + 1
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  const displayMonth = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return { monthStart, nextMonthStart, displayMonth }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

async function checkUncategorized(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { monthStart, nextMonthStart, displayMonth } = parseMonthBounds(ctx.parameters)

  const { count, error } = await ctx.supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_reviewed', false)
    .is('deleted_at', null)
    .gte('date', monthStart)
    .lt('date', nextMonthStart)

  if (error) return { status: 'failed', message: `Could not query transactions: ${error.message}` }

  const n = count ?? 0
  if (n === 0) return { status: 'success', message: `All transactions reviewed for ${displayMonth}.` }

  return {
    status: 'warning',
    message: `${n} unreviewed transaction${n !== 1 ? 's' : ''} found in ${displayMonth}.`,
    warnings: [`${n} transaction${n !== 1 ? 's' : ''} need review — visit Transactions to categorize them before closing.`],
  }
}

async function runReconciliation(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const result = await reconcileOrgTransactions(ctx.orgId, ctx.supabase)

  if (result.error) return { status: 'failed', message: `Reconciliation error: ${result.error}` }

  return {
    status: 'success',
    message: `Matched ${result.matched} payout${result.matched !== 1 ? 's' : ''}, ${result.invoicesMatched} invoice${result.invoicesMatched !== 1 ? 's' : ''}. Flagged ${result.duplicatesFlagged} duplicate${result.duplicatesFlagged !== 1 ? 's' : ''}.`,
    data: {
      matched: result.matched,
      invoicesMatched: result.invoicesMatched,
      duplicatesFlagged: result.duplicatesFlagged,
    },
  }
}

async function generateSnapshot(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { monthStart, displayMonth } = parseMonthBounds(ctx.parameters)
  const warnings: string[] = []

  const [pnl, mrrResult, cashResult, burnResult, activeCustomers] = await Promise.all([
    getPnL(ctx.orgId, monthStart),
    getMRR(ctx.orgId, monthStart),
    getCashBalance(ctx.orgId),
    getBurnRate(ctx.orgId),
    getActiveCustomers(ctx.orgId),
  ])

  warnings.push(
    ...pnl.dataWarnings,
    ...mrrResult.warnings,
    ...cashResult.warnings,
    ...burnResult.warnings,
  )

  const snapshotData = {
    org_id: ctx.orgId,
    month: monthStart,
    mrr: mrrResult.mrr,
    arr: mrrResult.mrr * 12,
    cash_balance: cashResult.cash,
    burn_rate: burnResult.burnRate,
    total_revenue: pnl.totalRevenue,
    total_expenses: pnl.totalExpenses,
    net_income: pnl.netIncome,
    active_customers: activeCustomers,
    computed_at: new Date().toISOString(),
  }

  // Check existence first (avoids needing a unique constraint)
  const { data: existing } = await ctx.supabase
    .from('monthly_snapshots')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('month', monthStart)
    .maybeSingle()

  const { error } = existing
    ? await ctx.supabase.from('monthly_snapshots').update(snapshotData).eq('id', existing.id)
    : await ctx.supabase.from('monthly_snapshots').insert(snapshotData)

  if (error) return { status: 'failed', message: `Could not save snapshot: ${error.message}` }

  return {
    status: warnings.length > 0 ? 'warning' : 'success',
    message: `${displayMonth} snapshot saved — Revenue ${fmt(pnl.totalRevenue)}, Expenses ${fmt(pnl.totalExpenses)}, Net ${fmt(pnl.netIncome)}.`,
    warnings: warnings.length > 0 ? warnings : undefined,
    data: {
      totalRevenue: pnl.totalRevenue,
      totalExpenses: pnl.totalExpenses,
      netIncome: pnl.netIncome,
    },
  }
}

async function generatePnLSummary(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { monthStart, displayMonth } = parseMonthBounds(ctx.parameters)

  const pnl = await getPnL(ctx.orgId, monthStart)

  const topRevenue = pnl.revenue
    .slice(0, 3)
    .map(r => r.category)
    .join(', ') || 'None'

  const topExpenses = pnl.expenses
    .slice(0, 3)
    .map(e => e.category)
    .join(', ') || 'None'

  return {
    status: 'success',
    message: `${displayMonth} — Top revenue: ${topRevenue}. Top expenses: ${topExpenses}.`,
    data: {
      revenue: pnl.revenue,
      expenses: pnl.expenses,
      totalRevenue: pnl.totalRevenue,
      totalExpenses: pnl.totalExpenses,
    },
  }
}

export const monthEndWorkflow: WorkflowDefinition = {
  id: 'month-end',
  name: 'Month-End Close',
  description:
    'Check uncategorized transactions, run reconciliation, generate monthly snapshot, and summarize the P&L.',
  category: 'accounting',
  estimatedDuration: '~30 seconds',
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
    { id: 'check-uncategorized', name: 'Check uncategorized transactions', run: checkUncategorized },
    { id: 'run-reconciliation', name: 'Run reconciliation engine', run: runReconciliation },
    { id: 'generate-snapshot', name: 'Generate monthly snapshot', run: generateSnapshot },
    { id: 'pnl-summary', name: 'Generate P&L summary', run: generatePnLSummary },
  ],
}
