import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeOAuthUrl } from '@/lib/sync/stripe'
import crypto from 'crypto'

// GET — redirect browser to Stripe Connect OAuth authorization page
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const origin = new URL(request.url).origin

  if (!process.env.STRIPE_CLIENT_ID) {
    return NextResponse.redirect(new URL('/connections?error=stripe_not_configured', origin))
  }

  const redirectUri =
    process.env.STRIPE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/connections/stripe/callback`

  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = getStripeOAuthUrl(state, redirectUri)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('stripe_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  })
  return response
}

// DELETE — disconnect Stripe
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
    .update({ status: 'disconnected', encrypted_access_token: null, encrypted_refresh_token: null })
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
