import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runStripePullSync } from '@/lib/sync/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const { data: connection } = await supabase
    .from('connections')
    .select('id, last_synced_at')
    .eq('org_id', member.org_id)
    .eq('provider', 'stripe')
    .eq('status', 'active')
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: 'No active Stripe connection. Connect Stripe first.' }, { status: 400 })
  }

  const result = await runStripePullSync(member.org_id, connection.id, supabase)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ synced: result.synced, skipped: result.skipped })
}
