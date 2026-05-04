import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getForecast, getHistoricalForecast, getMRR, getAvgMonthlyRevenue,
  getBurnRate, getCashBalance, inferBusinessModel,
} from '@/lib/metrics'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const growthRate = Math.max(0, Math.min(0.5, parseFloat(searchParams.get('growthRate') ?? '0.05')))
  const months = Math.max(1, Math.min(24, parseInt(searchParams.get('months') ?? '12')))

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

  const [{ model: businessModel }, { mrr }, { avg: avgMonthlyRevenue }, { burnRate }, { cash }] =
    await Promise.all([
      inferBusinessModel(orgId),
      getMRR(orgId),
      getAvgMonthlyRevenue(orgId, 3),
      getBurnRate(orgId),
      getCashBalance(orgId),
    ])

  // SaaS uses MRR-based projection; SMB/project use historical-average projection
  const forecastData = businessModel === 'saas'
    ? await getForecast(orgId, growthRate, months)
    : await getHistoricalForecast(orgId, months)

  return NextResponse.json(
    {
      forecast: forecastData,
      businessModel,
      currentMRR: mrr,
      avgMonthlyRevenue,
      currentBurnRate: burnRate,
      currentCash: cash,
    },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } }
  )
}
