import type { WorkflowDefinition, WorkflowContext, WorkflowStepResult } from '../engine'
import { reconcileOrgTransactions } from '@/lib/sync/reconciliation'

async function findUnreconciled(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { count, error } = await ctx.supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_reconciled', false)
    .is('deleted_at', null)

  if (error) return { status: 'failed', message: `Could not query transactions: ${error.message}` }

  const n = count ?? 0
  if (n === 0) {
    return { status: 'success', message: 'All transactions are already reconciled.' }
  }

  return {
    status: 'warning',
    message: `${n} unreconciled transaction${n !== 1 ? 's' : ''} found.`,
    warnings:
      n > 20
        ? [`${n} transactions unreconciled — consider reviewing your bank connections.`]
        : undefined,
    data: { unreconciledBefore: n },
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

async function reconciliationSummary(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { count, error } = await ctx.supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_reconciled', false)
    .is('deleted_at', null)

  if (error) return { status: 'failed', message: `Could not query remaining unreconciled: ${error.message}` }

  const remaining = count ?? 0

  if (remaining === 0) {
    return { status: 'success', message: 'All transactions are now reconciled.' }
  }

  return {
    status: 'warning',
    message: `${remaining} transaction${remaining !== 1 ? 's' : ''} still unreconciled after auto-matching.`,
    warnings: [
      `${remaining} transaction${remaining !== 1 ? 's' : ''} could not be automatically matched. Review your bank connections or manually match them in Transactions.`,
    ],
    data: { unreconciledAfter: remaining },
  }
}

export const bankReconciliationWorkflow: WorkflowDefinition = {
  id: 'bank-reconciliation',
  name: 'Bank Reconciliation',
  description:
    'Find unreconciled transactions, run the matching engine, and report remaining gaps.',
  category: 'reconciliation',
  estimatedDuration: '~15 seconds',
  steps: [
    { id: 'find-unreconciled', name: 'Find unreconciled transactions', run: findUnreconciled },
    { id: 'run-reconciliation', name: 'Run reconciliation engine', run: runReconciliation },
    { id: 'reconciliation-summary', name: 'Generate reconciliation summary', run: reconciliationSummary },
  ],
}
