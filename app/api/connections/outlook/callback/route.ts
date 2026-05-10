import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeOutlookCode, syncOutlookTransactions } from '@/lib/sync/outlook'
import { encrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = new URL(request.url).origin

  if (error) {
    return NextResponse.redirect(new URL('/connections?error=outlook_denied', origin))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/connections?error=outlook_invalid_callback', origin))
  }

  // Verify CSRF state
  const savedState = request.cookies.get('outlook_oauth_state')?.value
  if (!savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/connections?error=outlook_state_mismatch', origin))
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
    return NextResponse.redirect(new URL('/connections?error=outlook_no_org', origin))
  }

  const redirectUri = process.env.OUTLOOK_REDIRECT_URI!

  let tokens: Awaited<ReturnType<typeof exchangeOutlookCode>>
  try {
    tokens = await exchangeOutlookCode(code, redirectUri)
  } catch {
    return NextResponse.redirect(new URL('/connections?error=outlook_token_exchange', origin))
  }

  const { data: conn, error: upsertError } = await supabase
    .from('connections')
    .upsert(
      {
        org_id: member.org_id,
        provider: 'outlook',
        status: 'active',
        encrypted_access_token: encrypt(tokens.accessToken),
        encrypted_refresh_token: encrypt(tokens.refreshToken),
        account_name: tokens.email,
        metadata: { email_address: tokens.email },
        sync_cursor: null,
        last_synced_at: null, // reset so sync uses full lookback on reconnect
      },
      { onConflict: 'org_id,provider' }
    )
    .select('id')
    .single()

  if (upsertError || !conn?.id) {
    return NextResponse.redirect(new URL('/connections?error=outlook_save_failed', origin))
  }

  // Auto-sync immediately after connecting
  await syncOutlookTransactions(member.org_id, conn.id, supabase)

  const response = NextResponse.redirect(new URL('/connections?connected=outlook', origin))
  response.cookies.delete('outlook_oauth_state')
  return response
}
