import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'

// POST /api/connections/paypal — connect via user's own PayPal REST API credentials
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const clientId: string = (body.client_id ?? '').trim()
  const clientSecret: string = (body.client_secret ?? '').trim()
  const sandbox: boolean = body.sandbox !== false // default sandbox=true

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Client ID and Client Secret are required' }, { status: 400 })
  }

  const base = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

  // Validate credentials by getting an access token (client_credentials flow)
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) throw new Error(`PayPal returned ${res.status}`)
    const json = await res.json() as { access_token?: string }
    if (!json.access_token) throw new Error('No access token returned')
  } catch {
    return NextResponse.json({ error: 'Invalid PayPal credentials. Check your Client ID and Secret.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('connections')
    .upsert({
      org_id: member.org_id,
      provider: 'paypal',
      status: 'active',
      account_name: clientId,
      encrypted_access_token: encrypt(clientSecret),
      metadata: { sandbox, paypal_client_id: clientId },
    }, { onConflict: 'org_id,provider' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ connected: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  await supabase.from('connections')
    .update({ status: 'disconnected', encrypted_access_token: null })
    .eq('org_id', member.org_id).eq('provider', 'paypal')

  if (request.nextUrl.searchParams.get('removeData') === 'true') {
    await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('org_id', member.org_id)
      .eq('source', 'paypal')
      .is('deleted_at', null)
  }

  return NextResponse.json({ disconnected: true })
}
