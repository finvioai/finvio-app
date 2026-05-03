import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeShopifyCode } from '@/lib/sync/shopify'
import { encrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=shopify_denied`)
  }

  if (!code || !shop || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=shopify_invalid`)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const savedState = cookieStore.get('shopify_oauth_state')?.value
  if (savedState !== state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=shopify_csrf`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
  }

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=no_org`)
  }

  try {
    const accessToken = await exchangeShopifyCode(shop, code)
    const encryptedToken = encrypt(accessToken)

    const existing = await supabase
      .from('connections')
      .select('id')
      .eq('org_id', member.org_id)
      .eq('provider', 'shopify')
      .maybeSingle()

    if (existing.data) {
      await supabase.from('connections').update({
        encrypted_access_token: encryptedToken,
        account_name: shop,
        status: 'active',
        metadata: { shop },
      }).eq('id', existing.data.id)
    } else {
      await supabase.from('connections').insert({
        org_id: member.org_id,
        provider: 'shopify',
        encrypted_access_token: encryptedToken,
        account_name: shop,
        status: 'active',
        metadata: { shop },
      })
    }

    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?success=shopify`
    )
    response.cookies.delete('shopify_oauth_state')
    return response
  } catch (err) {
    console.error('Shopify OAuth callback error:', err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=shopify_failed`
    )
  }
}
