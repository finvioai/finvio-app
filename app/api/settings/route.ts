import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const [org, settings] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', member.org_id).single(),
    supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
  ])

  return NextResponse.json({ org: org.data, userSettings: settings.data, role: member.role })
}

const OrgSchema = z.object({
  name: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  fiscal_year_start: z.number().int().min(1).max(12).optional(),
  industry: z.string().optional(),
})

const UserSettingsSchema = z.object({
  llm_provider: z.string().optional(),
  llm_model: z.string().optional(),
})

const PatchSchema = z.object({
  org: OrgSchema.optional(),
  userSettings: UserSettingsSchema.optional(),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.org && (member.role === 'owner' || member.role === 'admin')) {
    await supabase.from('organizations').update(parsed.data.org).eq('id', member.org_id)
  }

  if (parsed.data.userSettings) {
    await supabase.from('user_settings').update(parsed.data.userSettings).eq('user_id', user.id)
  }
  return NextResponse.json({ ok: true })
}
