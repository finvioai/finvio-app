import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncGmailTransactions } from '@/lib/sync/gmail'

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

  const { data: conn } = await supabase
    .from('connections')
    .select('id')
    .eq('org_id', member.org_id)
    .eq('provider', 'gmail')
    .eq('status', 'active')
    .maybeSingle()

  if (!conn) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })

  const result = await syncGmailTransactions(member.org_id, conn.id, supabase)

  if (result.error) {
    return NextResponse.json({ error: result.error, synced: result.synced, skipped: result.skipped }, { status: 500 })
  }

  return NextResponse.json({ synced: result.synced, skipped: result.skipped })
}
