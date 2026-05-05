import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import { runStripePullSync } from '@/lib/sync/stripe'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const secretKey: string = body.secret_key ?? ''

  if (!secretKey || !secretKey.startsWith('sk_')) {
    return NextResponse.json({ error: 'Enter a valid Stripe secret key (starts with sk_live_ or sk_test_)' }, { status: 400 })
  }

  // Validate key against Stripe API
  let accountName: string | null = null
  try {
    const stripe = new Stripe(secretKey)
    // retrieve(null) fetches the account tied to this key (no args needed for own account)
    const account = await stripe.accounts.retrieve(null)
    accountName = account.email ?? account.business_profile?.name ?? account.id ?? 'Stripe Account'
  } catch {
    // Key may be invalid, or this is a restricted key that can't read account info
    // Do a balance check to validate the key is at least functional
    try {
      const stripe = new Stripe(secretKey)
      await stripe.balance.retrieve()
      accountName = secretKey.startsWith('sk_live_') ? 'Stripe Live Account' : 'Stripe Test Account'
    } catch {
      return NextResponse.json({ error: 'Invalid Stripe secret key. Please check and try again.' }, { status: 400 })
    }
  }

  const encryptedToken = encrypt(secretKey)

  const { data: conn, error } = await supabase
    .from('connections')
    .upsert({
      org_id: member.org_id,
      provider: 'stripe',
      status: 'active',
      encrypted_access_token: encryptedToken,
      account_name: accountName,
    }, { onConflict: 'org_id,provider' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-sync immediately after connecting
  let syncResult: { synced: number; skipped: number; error?: string } = { synced: 0, skipped: 0 }
  if (conn?.id) {
    syncResult = await runStripePullSync(member.org_id, conn.id, supabase)
  }

  return NextResponse.json({
    connected: true,
    account_name: accountName,
    synced: syncResult.synced,
    skipped: syncResult.skipped,
    sync_error: syncResult.error ?? null,
  })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  await supabase
    .from('connections')
    .update({ status: 'disconnected', encrypted_access_token: null })
    .eq('org_id', member.org_id)
    .eq('provider', 'stripe')

  if (request.nextUrl.searchParams.get('removeData') === 'true') {
    await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('org_id', member.org_id)
      .eq('source', 'stripe')
      .is('deleted_at', null)
  }

  return NextResponse.json({ disconnected: true })
}
