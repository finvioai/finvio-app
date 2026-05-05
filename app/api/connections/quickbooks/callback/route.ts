import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import { syncQuickBooksData } from '@/lib/sync/quickbooks'

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = new URL(request.url).origin

  if (error) {
    return NextResponse.redirect(new URL('/connections?error=qb_denied', origin))
  }

  if (!code || !realmId || !state) {
    return NextResponse.redirect(new URL('/connections?error=qb_invalid_callback', origin))
  }

  // Verify CSRF state
  const savedState = request.cookies.get('qb_oauth_state')?.value
  if (!savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/connections?error=qb_state_mismatch', origin))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', origin))

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.redirect(new URL('/connections?error=qb_no_org', origin))

  const clientId = process.env.QB_CLIENT_ID!
  const clientSecret = process.env.QB_CLIENT_SECRET!
  const redirectUri = process.env.QB_REDIRECT_URI!

  // Exchange authorization code for access + refresh tokens
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenRes = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/connections?error=qb_token_exchange', origin))
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, x_refresh_token_expires_in } = tokens

  const environment = (process.env.QB_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production'
  const apiBase = environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

  // Fetch company name for display
  let companyName = `QuickBooks (${realmId})`
  try {
    const infoRes = await fetch(
      `${apiBase}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`,
      { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
    )
    if (infoRes.ok) {
      const info = await infoRes.json()
      companyName = info.CompanyInfo?.CompanyName ?? companyName
    }
  } catch {
    // non-critical
  }

  const { data: conn, error: upsertError } = await supabase
    .from('connections')
    .upsert(
      {
        org_id: member.org_id,
        provider: 'quickbooks',
        status: 'active',
        encrypted_access_token: encrypt(access_token),
        encrypted_refresh_token: encrypt(refresh_token),
        account_name: companyName,
        metadata: {
          realm_id: realmId,
          environment,
          refresh_token_expires_at: new Date(
            Date.now() + (x_refresh_token_expires_in ?? 8726400) * 1000
          ).toISOString(),
        },
      },
      { onConflict: 'org_id,provider' }
    )
    .select('id')
    .single()

  if (upsertError || !conn?.id) {
    return NextResponse.redirect(new URL('/connections?error=qb_save_failed', origin))
  }

  // Auto-sync immediately after connecting
  await syncQuickBooksData(member.org_id, conn.id, supabase)

  const response = NextResponse.redirect(new URL('/connections?connected=quickbooks', origin))
  // Clear the CSRF cookie
  response.cookies.delete('qb_oauth_state')
  return response
}
