import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLinkToken, exchangePublicToken } from '@/lib/sync/plaid'
import { encrypt } from '@/lib/encryption'
import { z } from 'zod'

const Schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('setup'),
    client_id: z.string().min(1),
    secret: z.string().min(1),
    plaid_env: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
  }),
  z.object({ action: z.literal('link-token') }),
  z.object({ action: z.literal('exchange'), public_token: z.string().min(1) }),
])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    // ─ Step 1: save Plaid developer credentials ────────────────────────────
    if (parsed.data.action === 'setup') {
      const { client_id, secret, plaid_env } = parsed.data

      // Validate credentials by creating a test link token
      try {
        await createLinkToken(member.org_id, user.id, { client_id, secret, plaid_env })
      } catch {
        return NextResponse.json(
          { error: 'Invalid Plaid credentials. Check your Client ID and Secret.' },
          { status: 400 }
        )
      }

      await supabase.from('connections').upsert({
        org_id: member.org_id,
        provider: 'plaid',
        status: 'setup',
        account_name: `Plaid (${plaid_env})`,
        encrypted_refresh_token: encrypt(secret),
        metadata: { plaid_client_id: client_id, plaid_env },
      }, { onConflict: 'org_id,provider' })

      return NextResponse.json({ setup: true })
    }

    // ─ Step 2/3: use stored credentials ────────────────────────────────────
    const { data: conn } = await supabase
      .from('connections')
      .select('encrypted_refresh_token, metadata')
      .eq('org_id', member.org_id)
      .eq('provider', 'plaid')
      .maybeSingle()

    // Fall back to env vars if no stored credentials (backward compat)
    const meta = (conn?.metadata ?? {}) as Record<string, string>
    const storedCreds = conn?.encrypted_refresh_token
      ? { client_id: meta.plaid_client_id, secret: conn.encrypted_refresh_token, plaid_env: meta.plaid_env as 'sandbox' | 'development' | 'production' }
      : undefined

    if (parsed.data.action === 'link-token') {
      const linkToken = await createLinkToken(member.org_id, user.id, storedCreds)
      return NextResponse.json({ link_token: linkToken })
    }

    if (parsed.data.action === 'exchange') {
      const connectionId = await exchangePublicToken(member.org_id, parsed.data.public_token, supabase, storedCreds)
      return NextResponse.json({ connection_id: connectionId })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Plaid connection failed' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  await supabase.from('connections')
    .update({ status: 'disconnected' })
    .eq('org_id', member.org_id).eq('provider', 'plaid')

  return NextResponse.json({ disconnected: true })
}
