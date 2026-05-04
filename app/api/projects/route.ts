import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single()
  return data?.org_id ?? null
}

const CreateSchema = z.object({
  name:        z.string().min(1).max(200),
  client:      z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  status:      z.enum(['active', 'completed', 'on_hold', 'cancelled']).default('active'),
  budget:      z.number().positive().optional(),
  currency:    z.string().length(3).default('USD'),
  start_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const UpdateSchema = CreateSchema.partial().extend({
  id: z.string().uuid(),
})

// ─── GET /api/projects ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const withTotals = searchParams.get('totals') === 'true'

  let query = supabase
    .from('projects')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: projects, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!withTotals) {
    return NextResponse.json({ projects: projects ?? [] })
  }

  // Augment with collected/expenses from linked transactions
  const enriched = await Promise.all((projects ?? []).map(async (project) => {
    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('project_id', project.id)

    const collected = txns?.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount ?? 0), 0) ?? 0
    const expenses  = txns?.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0) ?? 0

    return {
      ...project,
      collected,
      expenses,
      outstanding: project.budget != null ? project.budget - collected : null,
    }
  }))

  return NextResponse.json({ projects: enriched })
}

// ─── POST /api/projects ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: project, error } = await supabase
    .from('projects')
    .insert({ org_id: orgId, ...parsed.data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project }, { status: 201 })
}

// ─── PATCH /api/projects ──────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, ...fields } = parsed.data

  const { data: project, error } = await supabase
    .from('projects')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project })
}
