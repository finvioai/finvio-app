import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMRRTrend, getMRR, getARR, getActiveCustomers, getChurnRate } from '@/lib/metrics'

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
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [mrrTrend, { mrr }, { arr }, activeCustomers, { churnRate }, sourceRows, customers] =
    await Promise.all([
      getMRRTrend(orgId, 12),
      getMRR(orgId),
      getARR(orgId),
      getActiveCustomers(orgId),
      getChurnRate(orgId, monthStr),
      supabase
        .from('transactions')
        .select('source, amount')
        .eq('org_id', orgId)
        .eq('type', 'income')
        .gte('date', monthStr),
      supabase
        .from('customers')
        .select('id, name, email, status, created_at, external_id')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  const bySource: Record<string, number> = {}
  for (const t of sourceRows.data ?? []) {
    const src = t.source ?? 'manual'
    bySource[src] = (bySource[src] ?? 0) + (t.amount ?? 0)
  }

  return NextResponse.json({
    mrrTrend,
    mrr,
    arr,
    activeCustomers,
    churnRate,
    bySource,
    customers: customers.data ?? [],
  })
}
