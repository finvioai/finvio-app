import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardMetrics } from '@/lib/metrics'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const orgId = member.org_id
  const today = new Date().toISOString().split('T')[0]

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

  return NextResponse.json(
    {
      ...metrics,
      recentTransactions: recentTxns.data ?? [],
      uncategorizedCount: uncategorized.count ?? 0,
      overdueInvoices: overdueInvoices.data ?? [],
    },
    { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } }
  )
}
