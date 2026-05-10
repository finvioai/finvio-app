import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getShopifyAuthUrl } from '@/lib/sync/shopify'
import crypto from 'crypto'

// GET — redirect browser to Shopify OAuth authorization page
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  if (!process.env.SHOPIFY_API_KEY) {
    return NextResponse.redirect(new URL('/connections?error=shopify_not_configured', request.url))
  }

  const rawShop = request.nextUrl.searchParams.get('shop')?.trim() ?? ''
  if (!rawShop) {
    return NextResponse.redirect(new URL('/connections?error=shopify_no_shop', request.url))
  }

  const normalized = rawShop.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const shopDomain = normalized.endsWith('.myshopify.com') ? normalized : `${normalized}.myshopify.com`

  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = getShopifyAuthUrl(shopDomain, state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  })
  return response
}

// DELETE — disconnect Shopify
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  await supabase.from('connections')
    .update({ status: 'disconnected', encrypted_access_token: null })
    .eq('org_id', member.org_id).eq('provider', 'shopify')

  if (request.nextUrl.searchParams.get('removeData') === 'true') {
    await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('org_id', member.org_id)
      .eq('source', 'shopify')
      .is('deleted_at', null)
  }

  return NextResponse.json({ disconnected: true })
}
