import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_SCOPE = 'com.intuit.quickbooks.accounting'

// GET — redirect browser to QuickBooks OAuth authorization page
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const clientId = process.env.QB_CLIENT_ID
  if (!clientId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    return NextResponse.redirect(`${appUrl}/connections?error=qb_not_configured`)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const redirectUri = `${appUrl}/api/connections/quickbooks/callback`
  const state = crypto.randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id: clientId,
    scope: QB_SCOPE,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  })

  const response = NextResponse.redirect(`${QB_AUTH_URL}?${params.toString()}`)
  // Store state in cookie for CSRF verification on callback
  response.cookies.set('qb_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
    sameSite: 'lax',
  })
  return response
}

// DELETE — disconnect QuickBooks
export async function DELETE() {
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
    .update({
      status: 'disconnected',
      encrypted_access_token: null,
      encrypted_refresh_token: null,
    })
    .eq('org_id', member.org_id)
    .eq('provider', 'quickbooks')

  return NextResponse.json({ disconnected: true })
}
