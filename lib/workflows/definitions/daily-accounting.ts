import type { WorkflowDefinition, WorkflowContext, WorkflowStepResult } from '../engine'

async function reviewSyncLogs(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: logs, error } = await ctx.supabase
    .from('sync_logs')
    .select('provider, sync_type, records_synced, records_skipped, error_message, started_at')
    .eq('org_id', ctx.orgId)
    .gte('started_at', since)

  if (error) return { status: 'failed', message: `Could not read sync logs: ${error.message}` }

  if (!logs || logs.length === 0) {
    return {
      status: 'warning',
      message: 'No sync activity in the last 24 hours.',
      warnings: ['No data was synced recently — check your connections.'],
    }
  }

  const totalRecords = logs.reduce((sum, l) => sum + (l.records_synced ?? 0), 0)
  const failedLogs = logs.filter(l => l.error_message)
  const providers = [...new Set(logs.map(l => l.provider))]
  const warnings = failedLogs.map(l => `${l.provider} sync error: ${l.error_message}`)

  return {
    status: failedLogs.length > 0 ? 'warning' : 'success',
    message: `${providers.length} provider${providers.length !== 1 ? 's' : ''} synced (${providers.join(', ')}). ${totalRecords} record${totalRecords !== 1 ? 's' : ''} imported.`,
    warnings: warnings.length > 0 ? warnings : undefined,
    data: { providers, totalRecords, failedCount: failedLogs.length },
  }
}

async function checkUncategorized(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { count, error } = await ctx.supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_reviewed', false)
    .is('deleted_at', null)

  if (error) return { status: 'failed', message: `Could not query transactions: ${error.message}` }

  const n = count ?? 0
  if (n === 0) return { status: 'success', message: 'No uncategorized transactions.' }

  return {
    status: 'warning',
    message: `${n} transaction${n !== 1 ? 's' : ''} need review.`,
    warnings: [`${n} unreviewed transaction${n !== 1 ? 's' : ''} — visit Transactions to categorize them.`],
  }
}

async function checkOverdueInvoices(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { data: overdue, error } = await ctx.supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, amount, due_date')
    .eq('org_id', ctx.orgId)
    .in('status', ['sent', 'overdue'])
    .lt('due_date', ctx.today)

  if (error) return { status: 'failed', message: `Could not query invoices: ${error.message}` }

  const n = overdue?.length ?? 0
  if (n === 0) return { status: 'success', message: 'No overdue invoices.' }

  const fmtCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount)

  const total = overdue!.reduce((sum, inv) => sum + inv.amount, 0)
  const names = overdue!
    .slice(0, 3)
    .map(inv => inv.customer_name)
    .join(', ')
  const moreText = n > 3 ? ` +${n - 3} more` : ''

  return {
    status: 'warning',
    message: `${n} overdue invoice${n !== 1 ? 's' : ''} totalling ${fmtCurrency(total)} (${names}${moreText}).`,
    warnings: [`${n} overdue invoice${n !== 1 ? 's' : ''} — follow up with customers or mark as paid.`],
    data: { overdueCount: n, totalAmount: total },
  }
}

async function generateDailySummary(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  return {
    status: 'success',
    message: `Daily accounting review complete for ${ctx.today}.`,
  }
}

export const dailyAccountingWorkflow: WorkflowDefinition = {
  id: 'daily-accounting',
  name: 'Daily Accounting Review',
  description:
    'Review recent sync activity, flag uncategorized transactions, and surface overdue invoices.',
  category: 'accounting',
  estimatedDuration: '~10 seconds',
  steps: [
    { id: 'review-sync-logs', name: 'Review recent sync activity', run: reviewSyncLogs },
    { id: 'check-uncategorized', name: 'Check uncategorized transactions', run: checkUncategorized },
    { id: 'check-overdue-invoices', name: 'Check overdue invoices', run: checkOverdueInvoices },
    { id: 'daily-summary', name: 'Generate daily summary', run: generateDailySummary },
  ],
}
