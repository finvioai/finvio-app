import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  validateTokenAndGetAccounts,
  generateWebhookSecret,
  registerMercuryWebhook,
  runMercuryPullSync,
  encrypt,
} from '@/lib/sync/mercury'
import type { Json } from '@/types/database'

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

  const body = await request.json() as { api_token?: string; sandbox?: boolean }
  const apiToken = body.api_token?.trim()
  const sandbox = body.sandbox === true

  if (!apiToken) return NextResponse.json({ error: 'API token is required' }, { status: 400 })

  // Validate token and get accounts
  let accountInfo: Awaited<ReturnType<typeof validateTokenAndGetAccounts>>
  try {
    accountInfo = await validateTokenAndGetAccounts(apiToken, sandbox)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid API token'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { accounts, totalBalance } = accountInfo
  const accountNames = accounts
    .filter((a) => a.status === 'active')
    .map((a) => a.name)
    .join(', ')
  const accountName = `Mercury${sandbox ? ' (Sandbox)' : ''} — ${accountNames || 'Unknown'}`

  // Generate and register webhook
  const webhookSecret = generateWebhookSecret()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const webhookUrl = `${appUrl}/api/webhooks/mercury`
  const webhookId = appUrl
    ? await registerMercuryWebhook(apiToken, sandbox, webhookUrl, webhookSecret)
    : null

  // Upsert connection
  const { data: conn, error: upsertError } = await supabase
    .from('connections')
    .upsert(
      {
        org_id: member.org_id,
        provider: 'mercury',
        status: 'active',
        encrypted_access_token: encrypt(apiToken),
        encrypted_refresh_token: encrypt(webhookSecret),
        account_name: accountName,
        metadata: {
          sandbox,
          balance: totalBalance,
          account_count: accounts.length,
          webhook_id: webhookId,
          webhook_registered: !!webhookId,
          account_ids: accounts.map((a) => a.id),
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

  // Initial sync
  try {
    await runMercuryPullSync(member.org_id, conn.id, apiToken, sandbox, supabase)
  } catch {
    // Sync failure is non-fatal
  }

  return NextResponse.json({
    success: true,
    account_name: accountName,
    balance: totalBalance,
    webhook_registered: !!webhookId,
    sandbox,
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

  const now = new Date().toISOString()

  await supabase
    .from('connections')
    .update({ status: 'disconnected', encrypted_access_token: null, encrypted_refresh_token: null })
    .eq('org_id', member.org_id)
    .eq('provider', 'mercury')

  if (request.nextUrl.searchParams.get('removeData') === 'true') {
    await supabase
      .from('transactions')
      .update({ deleted_at: now })
      .eq('org_id', member.org_id)
      .eq('source', 'mercury')
      .is('deleted_at', null)
  }

  return NextResponse.json({ disconnected: true })
}
