import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'

// POST /api/connections/shopify — connect via admin API access token (no OAuth needed)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const shop: string = (body.shop ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const accessToken: string = (body.access_token ?? '').trim()

  if (!shop) return NextResponse.json({ error: 'Enter your store domain (e.g. my-store.myshopify.com)' }, { status: 400 })
  if (!accessToken) return NextResponse.json({ error: 'Enter your Shopify Admin API access token' }, { status: 400 })

  // Validate by calling the Shopify API
  let shopName: string = shop
  try {
    const res = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    })
    if (!res.ok) throw new Error(`Shopify API returned ${res.status}`)
    const json = await res.json() as { shop?: { name?: string } }
    shopName = json.shop?.name ?? shop
  } catch {
    return NextResponse.json({ error: 'Could not connect to Shopify. Check your store domain and access token.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('connections')
    .upsert({
      org_id: member.org_id,
      provider: 'shopify',
      status: 'active',
      encrypted_access_token: encrypt(accessToken),
      account_name: shopName,
      metadata: { shop },
    }, { onConflict: 'org_id,provider' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ connected: true, shop_name: shopName })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  await supabase.from('connections')
    .update({ status: 'disconnected' })
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
