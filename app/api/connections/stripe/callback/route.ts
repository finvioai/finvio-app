import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeStripeCode, runStripePullSync } from '@/lib/sync/stripe'
import { encrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = new URL(request.url).origin

  if (error) {
    return NextResponse.redirect(new URL('/connections?error=stripe_denied', origin))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/connections?error=stripe_invalid_callback', origin))
  }

  // Verify CSRF state
  const savedState = request.cookies.get('stripe_oauth_state')?.value
  if (!savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/connections?error=stripe_state_mismatch', origin))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', origin))

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) {
    return NextResponse.redirect(new URL('/connections?error=stripe_no_org', origin))
  }

  let tokens: Awaited<ReturnType<typeof exchangeStripeCode>>
  try {
    tokens = await exchangeStripeCode(code)
  } catch {
    return NextResponse.redirect(new URL('/connections?error=stripe_token_exchange', origin))
  }

  const { data: conn, error: upsertError } = await supabase
    .from('connections')
    .upsert(
      {
        org_id: member.org_id,
        provider: 'stripe',
        status: 'active',
        encrypted_access_token: encrypt(tokens.accessToken),
        encrypted_refresh_token: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        account_name: tokens.email,
        metadata: { stripe_user_id: tokens.stripeUserId },
        last_synced_at: null,
      },
      { onConflict: 'org_id,provider' }
    )
    .select('id')
    .single()

  if (upsertError || !conn?.id) {
    return NextResponse.redirect(new URL('/connections?error=stripe_save_failed', origin))
  }

  // Auto-sync immediately after connecting
  await runStripePullSync(member.org_id, conn.id, supabase)

  const response = NextResponse.redirect(new URL('/connections?connected=stripe', origin))
  response.cookies.delete('stripe_oauth_state')
  return response
}
