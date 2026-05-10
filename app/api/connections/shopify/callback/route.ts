import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeShopifyCode, syncShopifyOrders } from '@/lib/sync/shopify'
import { encrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/connections?error=shopify_denied`)
  }

  if (!code || !shop || !state) {
    return NextResponse.redirect(`${origin}/connections?error=shopify_invalid`)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const savedState = cookieStore.get('shopify_oauth_state')?.value
  if (savedState !== state) {
    return NextResponse.redirect(`${origin}/connections?error=shopify_csrf`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) {
    return NextResponse.redirect(`${origin}/connections?error=shopify_no_org`)
  }

  try {
    const accessToken = await exchangeShopifyCode(shop, code)

    // Fetch store name for the account label
    let shopName = shop
    try {
      const infoRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      })
      if (infoRes.ok) {
        const json = await infoRes.json() as { shop?: { name?: string } }
        shopName = json.shop?.name ?? shop
      }
    } catch { /* keep shop domain as fallback */ }

    const { data: conn } = await supabase
      .from('connections')
      .upsert({
        org_id: member.org_id,
        provider: 'shopify',
        status: 'active',
        encrypted_access_token: encrypt(accessToken),
        account_name: shopName,
        metadata: { shop },
      }, { onConflict: 'org_id,provider' })
      .select('id')
      .single()

    // Auto-sync immediately after connecting
    if (conn?.id) {
      await syncShopifyOrders(member.org_id, conn.id, supabase)
    }

    const response = NextResponse.redirect(`${origin}/connections?connected=shopify`)
    response.cookies.delete('shopify_oauth_state')
    return response
  } catch (err) {
    console.error('Shopify OAuth callback error:', err)
    return NextResponse.redirect(`${origin}/connections?error=shopify_failed`)
  }
}
