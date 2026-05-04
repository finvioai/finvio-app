import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getMRRTrend, getMRR, getARR, getActiveCustomers, getChurnRate, getRevenueByType,
  inferBusinessModel, getTotalRevenue, getAvgMonthlyRevenue, getGrossProfit,
} from '@/lib/metrics'

function isoMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

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
  const monthStr = isoMonthStr(now)

  // Build last 12 months for revenue trend (non-SaaS)
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - (11 - i))
    return isoMonthStr(d)
  })

  const [
    mrrTrend, { mrr }, { arr }, activeCustomers, { churnRate },
    sourceRows, customers, revenueByType,
    { model: businessModel }, { revenue: totalRevenue }, { avg: avgMonthlyRevenue },
    { profit: grossProfit }, revenueTrendRaw,
  ] = await Promise.all([
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
    getRevenueByType(orgId, monthStr),
    inferBusinessModel(orgId),
    getTotalRevenue(orgId, monthStr),
    getAvgMonthlyRevenue(orgId, 3),
    getGrossProfit(orgId, monthStr),
    Promise.all(last12.map(async (m) => ({ month: m, revenue: (await getTotalRevenue(orgId, m)).revenue }))),
  ])

  const bySource: Record<string, number> = {}
  for (const t of sourceRows.data ?? []) {
    const src = t.source ?? 'manual'
    bySource[src] = (bySource[src] ?? 0) + (t.amount ?? 0)
  }

  return NextResponse.json(
    {
      mrrTrend, mrr, arr, activeCustomers, churnRate, bySource, revenueByType,
      customers: customers.data ?? [],
      businessModel, totalRevenue, avgMonthlyRevenue, grossProfit,
      revenueTrend: revenueTrendRaw,
    },
    { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } }
  )
}
