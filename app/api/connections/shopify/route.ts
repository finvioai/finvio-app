import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getShopifyAuthUrl } from '@/lib/sync/shopify'
import { randomBytes } from 'crypto'

// GET /api/connections/shopify?shop=my-store.myshopify.com
// Redirects to Shopify OAuth authorization page
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')

  if (!shop) {
    return NextResponse.json({ error: 'shop parameter is required' }, { status: 400 })
  }

  if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
    return NextResponse.json({ error: 'Shopify integration is not configured' }, { status: 503 })
  }

  // CSRF state stored in a short-lived cookie
  const state = randomBytes(16).toString('hex')
  const authUrl = getShopifyAuthUrl(shop, state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('shopify_oauth_state', state, { httpOnly: true, maxAge: 300, path: '/' })
  return response
}

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
    .update({ status: 'disconnected' })
    .eq('org_id', member.org_id)
    .eq('provider', 'shopify')

  return NextResponse.json({ disconnected: true })
}
