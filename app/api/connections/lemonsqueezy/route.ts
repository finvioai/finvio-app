import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  validateApiKeyAndGetStore,
  generateWebhookSecret,
  registerWebhook,
  runLSPullSync,
  encrypt,
} from '@/lib/sync/lemonsqueezy'
import type { Json } from '@/types/database'

// POST — connect with API key (validate → register webhook → save → initial sync)
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

  const body = await request.json() as { api_key?: string }
  const apiKey = body.api_key?.trim()
  if (!apiKey) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

  // Validate API key and get store info
  let storeInfo: Awaited<ReturnType<typeof validateApiKeyAndGetStore>>
  try {
    storeInfo = await validateApiKeyAndGetStore(apiKey)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid API key'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Generate and register webhook
  const webhookSecret = generateWebhookSecret()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const webhookUrl = `${appUrl}/api/webhooks/lemonsqueezy`
  const webhookId = appUrl
    ? await registerWebhook(apiKey, storeInfo.storeId, webhookUrl, webhookSecret)
    : null

  // Upsert connection
  const { data: conn, error: upsertError } = await supabase
    .from('connections')
    .upsert(
      {
        org_id: member.org_id,
        provider: 'lemonsqueezy',
        status: 'active',
        encrypted_access_token: encrypt(apiKey),
        encrypted_refresh_token: encrypt(webhookSecret),
        account_name: `${storeInfo.storeName} (${storeInfo.storeSlug})`,
        metadata: {
          store_id: storeInfo.storeId,
          store_name: storeInfo.storeName,
          webhook_id: webhookId,
          webhook_registered: !!webhookId,
        } as unknown as Json,
        last_synced_at: null,
      },
      { onConflict: 'org_id,provider' },
    )
    .select('id')
    .single()

  if (upsertError || !conn?.id) {
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
  }

  // Initial sync (non-blocking — fire and await; if it times out the user can sync manually)
  try {
    await runLSPullSync(member.org_id, conn.id, apiKey, storeInfo.storeId, supabase)
  } catch {
    // Sync failure is non-fatal — connection is still saved
  }

  return NextResponse.json({
    success: true,
    store_name: storeInfo.storeName,
    webhook_registered: !!webhookId,
  })
}

// DELETE — disconnect and optionally remove imported data
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

  const now = new Date().toISOString()

  await supabase
    .from('connections')
    .update({ status: 'disconnected', encrypted_access_token: null, encrypted_refresh_token: null })
    .eq('org_id', member.org_id)
    .eq('provider', 'lemonsqueezy')

  await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: now })
    .eq('org_id', member.org_id)
    .eq('source', 'lemonsqueezy')
    .neq('status', 'cancelled')

  await supabase
    .from('customers')
    .update({ status: 'inactive' })
    .eq('org_id', member.org_id)
    .eq('source', 'lemonsqueezy')
    .eq('status', 'active')

  if (request.nextUrl.searchParams.get('removeData') === 'true') {
    await supabase
      .from('transactions')
      .update({ deleted_at: now })
      .eq('org_id', member.org_id)
      .eq('source', 'lemonsqueezy')
      .is('deleted_at', null)
  }

  return NextResponse.json({ disconnected: true })
}
