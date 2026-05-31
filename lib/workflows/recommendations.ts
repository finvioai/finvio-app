import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkflowRecommendation } from '@/types'

export type { WorkflowRecommendation }

function prevMonthStart(): string {
  const now = new Date()
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const m = now.getMonth() === 0 ? 12 : now.getMonth()
  return `${y}-${String(m).padStart(2, '0')}-01`
}

export async function getWorkflowRecommendations(
  orgId: string,
  supabase: SupabaseClient
): Promise<WorkflowRecommendation[]> {
  const today = new Date().toISOString().split('T')[0]
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const prevMonth = prevMonthStart()

  const [
    uncategorized,
    overdue,
    failedSyncs,
    unreconciled,
    snapshot,
    highRiskAR,
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_reviewed', false)
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['sent', 'overdue'])
      .lt('due_date', today),
    supabase
      .from('sync_logs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .not('error_message', 'is', null)
      .gte('started_at', since24h),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_reconciled', false)
      .is('deleted_at', null),
    supabase
      .from('monthly_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('month', prevMonth),
    // AR invoices 60+ days overdue
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['sent', 'overdue'])
      .lt('due_date', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
  ])

  const recommendations: WorkflowRecommendation[] = []

  // Categorize transactions — most important, always surface if backlog exists
  if ((uncategorized.count ?? 0) > 0) {
    recommendations.push({
      workflowId: 'categorize-transactions',
      workflowName: 'Categorize Transactions',
      reason: `${uncategorized.count} transaction${(uncategorized.count ?? 0) !== 1 ? 's' : ''} need categorization.`,
      priority: (uncategorized.count ?? 0) > 20 ? 'high' : 'medium',
    })
  }

  // Daily accounting triggers
  const dailyReasons: string[] = []
  if ((overdue.count ?? 0) > 0) {
    dailyReasons.push(`${overdue.count} overdue invoice${(overdue.count ?? 0) !== 1 ? 's' : ''}`)
  }
  if ((failedSyncs.count ?? 0) > 0) {
    dailyReasons.push('sync errors in the last 24 hours')
  }

  if (dailyReasons.length > 0) {
    recommendations.push({
      workflowId: 'daily-accounting',
      workflowName: 'Daily Accounting Review',
      reason: dailyReasons.join(', ') + '.',
      priority: (overdue.count ?? 0) > 0 ? 'high' : 'medium',
    })
  }

  // AR aging — recommend if any invoices are 60+ days overdue
  if ((highRiskAR.count ?? 0) > 0) {
    recommendations.push({
      workflowId: 'ar-aging',
      workflowName: 'AR Aging Report',
      reason: `${highRiskAR.count} invoice${(highRiskAR.count ?? 0) !== 1 ? 's' : ''} are 60+ days overdue.`,
      priority: 'high',
    })
  } else if ((overdue.count ?? 0) > 3) {
    recommendations.push({
      workflowId: 'ar-aging',
      workflowName: 'AR Aging Report',
      reason: `${overdue.count} open invoices — review AR aging to prioritise collections.`,
      priority: 'medium',
    })
  }

  // Bank reconciliation trigger
  if ((unreconciled.count ?? 0) > 10) {
    recommendations.push({
      workflowId: 'bank-reconciliation',
      workflowName: 'Bank Reconciliation',
      reason: `${unreconciled.count} transactions are unreconciled.`,
      priority: 'medium',
    })
  }

  // Month-end close trigger — also recommend adjusting entries first
  if ((snapshot.count ?? 0) === 0) {
    const [y, m] = prevMonth.split('-')
    const displayMonth = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    recommendations.push({
      workflowId: 'adjusting-entries',
      workflowName: 'Adjusting Entries Review',
      reason: `Run before closing ${displayMonth} — accruals, prepaids, and deferred revenue need review.`,
      priority: 'high',
    })
    recommendations.push({
      workflowId: 'month-end',
      workflowName: 'Month-End Close',
      reason: `No snapshot found for ${displayMonth}.`,
      priority: 'high',
    })
  }

  // Sort high → medium → low
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
  return recommendations.sort((a, b) => order[a.priority] - order[b.priority])
}
