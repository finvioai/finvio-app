import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runLSPullSync, decrypt } from '@/lib/sync/lemonsqueezy'

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
    .select('id, encrypted_access_token, metadata')
    .eq('org_id', member.org_id)
    .eq('provider', 'lemonsqueezy')
    .eq('status', 'active')
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: 'No active Lemon Squeezy connection. Connect Lemon Squeezy first.' }, { status: 400 })
  }

  const apiKey = connection.encrypted_access_token ? decrypt(connection.encrypted_access_token) : null
  if (!apiKey) {
    return NextResponse.json({ error: 'Connection credentials missing. Please reconnect.' }, { status: 400 })
  }

  const meta = connection.metadata as Record<string, unknown> | null
  const storeId = meta?.store_id ? String(meta.store_id) : null
  if (!storeId) {
    return NextResponse.json({ error: 'Store ID not found. Please reconnect.' }, { status: 400 })
  }

  const result = await runLSPullSync(member.org_id, connection.id, apiKey, storeId, supabase)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ synced: result.synced, skipped: result.skipped })
}
