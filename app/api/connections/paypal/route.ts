import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPayPalAuthUrl } from '@/lib/sync/paypal'
import { randomBytes } from 'crypto'

// GET /api/connections/paypal
// Redirects to PayPal OAuth authorization page
export async function GET() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return NextResponse.json({ error: 'PayPal integration is not configured' }, { status: 503 })
  }

  const state = randomBytes(16).toString('hex')
  const authUrl = getPayPalAuthUrl(state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('paypal_oauth_state', state, { httpOnly: true, maxAge: 300, path: '/' })
  return response
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

  await supabase
    .from('connections')
    .update({ status: 'disconnected' })
    .eq('org_id', member.org_id)
    .eq('provider', 'paypal')

  return NextResponse.json({ disconnected: true })
}
