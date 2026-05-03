import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPnL } from '@/lib/metrics'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const rawMonth = searchParams.get('month') ?? defaultMonth
  // Normalise to first-of-month ISO date
  const month = rawMonth.length === 7 ? `${rawMonth}-01` : rawMonth

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  // Also fetch previous month for comparison
  const prevDate = new Date(month)
  prevDate.setMonth(prevDate.getMonth() - 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`

  const [current, previous] = await Promise.all([
    getPnL(member.org_id, month),
    getPnL(member.org_id, prevMonth),
  ])

  return NextResponse.json(
    { current, previous },
    { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } }
  )
}
