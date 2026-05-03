import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangePayPalCode } from '@/lib/sync/paypal'
import { encrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=paypal_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=paypal_invalid`)
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('paypal_oauth_state')?.value
  if (savedState !== state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=paypal_csrf`)
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
    const { accessToken, refreshToken } = await exchangePayPalCode(code)

    const existing = await supabase
      .from('connections')
      .select('id')
      .eq('org_id', member.org_id)
      .eq('provider', 'paypal')
      .maybeSingle()

    const record = {
      encrypted_access_token: encrypt(accessToken),
      encrypted_refresh_token: encrypt(refreshToken),
      account_name: 'PayPal',
      status: 'active',
    }

    if (existing.data) {
      await supabase.from('connections').update(record).eq('id', existing.data.id)
    } else {
      await supabase.from('connections').insert({
        org_id: member.org_id,
        provider: 'paypal',
        ...record,
      })
    }

    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?success=paypal`
    )
    response.cookies.delete('paypal_oauth_state')
    return response
  } catch (err) {
    console.error('PayPal OAuth callback error:', err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=paypal_failed`
    )
  }
}
