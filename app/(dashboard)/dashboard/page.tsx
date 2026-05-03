import { redirect } from 'next/navigation'
import { getSession, getOrgInfo } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getDashboardMetrics } from '@/lib/metrics'
import { DashboardView } from './DashboardView'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  // Reuses the same cached result as the layout — zero extra DB calls
  const { orgId } = await getOrgInfo()
  if (!orgId) redirect('/login')

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // All fetches run in parallel — metrics engine itself also runs in parallel internally
  const [metrics, recentTxns, uncategorized, overdueInvoices] = await Promise.all([
    getDashboardMetrics(orgId),
    supabase
      .from('transactions')
      .select('id, type, amount, description, category, date, source')
      .eq('org_id', orgId)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_reviewed', false),
    supabase
      .from('invoices')
      .select('id, invoice_number, amount, due_date, customer_name')
      .eq('org_id', orgId)
      .in('status', ['sent', 'overdue'])
      .lt('due_date', today),
  ])

  return (
    <DashboardView
      data={{
        ...metrics,
        recentTransactions: recentTxns.data ?? [],
        uncategorizedCount: uncategorized.count ?? 0,
        overdueInvoices: overdueInvoices.data ?? [],
      }}
    />
  )
}
