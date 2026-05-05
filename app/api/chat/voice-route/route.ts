import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dailyQuota = parseInt(process.env.VOICE_DAILY_QUOTA_SECONDS ?? '300')
  const monthlyQuota = parseInt(process.env.VOICE_MONTHLY_QUOTA_SECONDS ?? '3600')
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  const [{ data: daily }, { data: monthly }] = await Promise.all([
    supabase
      .from('voice_usage')
      .select('duration_seconds')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('voice_usage')
      .select('duration_seconds')
      .eq('user_id', user.id)
      .gte('date', monthStart),
  ])

  const dailyUsed = (daily?.duration_seconds as number) ?? 0
  const monthlyUsed = ((monthly ?? []) as Array<{ duration_seconds: number }>).reduce(
    (s, r) => s + r.duration_seconds,
    0
  )

  const quotaExhausted = dailyUsed >= dailyQuota || monthlyUsed >= monthlyQuota
  const lowEnd = request.nextUrl.searchParams.get('lowEndDevice') === 'true'

  let mode: 'server' | 'local' | 'unavailable'
  let serverFallback: boolean
  if (quotaExhausted && lowEnd) {
    mode = 'unavailable'
    serverFallback = false
  } else if (quotaExhausted) {
    mode = 'local'
    serverFallback = false
  } else {
    mode = 'server'
    serverFallback = true
  }

  return NextResponse.json({
    mode,
    serverFallback,
    dailyUsedSeconds: dailyUsed,
    dailyQuotaSeconds: dailyQuota,
    monthlyUsedSeconds: monthlyUsed,
    monthlyQuotaSeconds: monthlyQuota,
  })
}
