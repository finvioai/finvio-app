import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'No org found' }, { status: 403 })

  const limit = Math.min(
    parseInt(new URL(request.url).searchParams.get('limit') ?? '20', 10),
    100
  )

  const { data: runs } = await supabase
    .from('workflow_runs')
    .select('id, workflow_id, workflow_name, status, started_at, completed_at, summary_json')
    .eq('org_id', member.org_id)
    .order('started_at', { ascending: false })
    .limit(limit)

  return NextResponse.json({ runs: runs ?? [] })
}
