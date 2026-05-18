import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBrexOAuthUrl, generateCodeVerifier, generateCodeChallenge } from '@/lib/sync/brex'
import crypto from 'crypto'

// GET — redirect browser to Brex OAuth authorization page (PKCE)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const origin = new URL(request.url).origin

  if (!process.env.BREX_CLIENT_ID || !process.env.BREX_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/connections?error=brex_not_configured', origin))
  }

  const redirectUri =
    process.env.BREX_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/connections/brex/callback`

  const state = crypto.randomBytes(16).toString('hex')
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const authUrl = getBrexOAuthUrl(state, codeChallenge, redirectUri)

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax' as const,
  }
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('brex_oauth_state', state, cookieOpts)
  response.cookies.set('brex_code_verifier', codeVerifier, cookieOpts)
  return response
}

// DELETE — disconnect Brex
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
    .eq('provider', 'brex')

  if (request.nextUrl.searchParams.get('removeData') === 'true') {
    await supabase
      .from('transactions')
      .update({ deleted_at: now })
      .eq('org_id', member.org_id)
      .eq('source', 'brex')
      .is('deleted_at', null)
  }

  return NextResponse.json({ disconnected: true })
}
