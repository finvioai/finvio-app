import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeBrexCode, getBrexAccountInfo, runBrexPullSync } from '@/lib/sync/brex'
import { encrypt } from '@/lib/encryption'
import type { Json } from '@/types/database'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = new URL(request.url).origin

  if (error) {
    return NextResponse.redirect(new URL('/connections?error=brex_denied', origin))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/connections?error=brex_invalid_callback', origin))
  }

  const savedState = request.cookies.get('brex_oauth_state')?.value
  if (!savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/connections?error=brex_state_mismatch', origin))
  }

  const codeVerifier = request.cookies.get('brex_code_verifier')?.value
  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/connections?error=brex_state_mismatch', origin))
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
    return NextResponse.redirect(new URL('/connections?error=brex_no_org', origin))
  }

  const redirectUri =
    process.env.BREX_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/connections/brex/callback`

  let tokens: { accessToken: string; refreshToken: string }
  try {
    tokens = await exchangeBrexCode(code, codeVerifier, redirectUri)
  } catch {
    return NextResponse.redirect(new URL('/connections?error=brex_token_exchange', origin))
  }

  // Fetch account info for display name and initial balance
  let accountName = 'Brex'
  let initialBalance = 0
  try {
    const info = await getBrexAccountInfo(tokens.accessToken)
    accountName = info.companyName ? `Brex — ${info.companyName}` : 'Brex'
    initialBalance = info.totalCashBalance
  } catch {
    // Non-fatal
  }

  const { data: conn, error: upsertError } = await supabase
    .from('connections')
    .upsert(
      {
        org_id: member.org_id,
        provider: 'brex',
        status: 'active',
        encrypted_access_token: encrypt(tokens.accessToken),
        encrypted_refresh_token: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        account_name: accountName,
        metadata: { balance: initialBalance } as unknown as Json,
        last_synced_at: null,
      },
      { onConflict: 'org_id,provider' }
    )
    .select('id')
    .single()

  if (upsertError || !conn?.id) {
    return NextResponse.redirect(new URL('/connections?error=brex_save_failed', origin))
  }

  // Initial sync (non-fatal)
  try {
    await runBrexPullSync(member.org_id, conn.id, supabase)
  } catch {
    // Sync failure is non-fatal — connection is saved
  }

  const response = NextResponse.redirect(new URL('/connections?connected=brex', origin))
  response.cookies.delete('brex_oauth_state')
  response.cookies.delete('brex_code_verifier')
  return response
}
