import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLinkToken, exchangePublicToken } from '@/lib/sync/plaid'
import { z } from 'zod'

const Schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('link-token') }),
  z.object({ action: z.literal('exchange'), public_token: z.string().min(1) }),
])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    if (parsed.data.action === 'link-token') {
      const linkToken = await createLinkToken(member.org_id, user.id)
      return NextResponse.json({ link_token: linkToken })
    }

    if (parsed.data.action === 'exchange') {
      const connectionId = await exchangePublicToken(member.org_id, parsed.data.public_token, supabase)
      return NextResponse.json({ connection_id: connectionId })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Plaid connection failed' },
      { status: 500 }
    )
  }
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
    .eq('provider', 'plaid')

  return NextResponse.json({ disconnected: true })
}
