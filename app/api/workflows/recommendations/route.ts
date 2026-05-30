import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkflowRecommendations } from '@/lib/workflows/recommendations'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'No org found' }, { status: 403 })

  const recommendations = await getWorkflowRecommendations(member.org_id, supabase)
  return NextResponse.json({ recommendations })
}
