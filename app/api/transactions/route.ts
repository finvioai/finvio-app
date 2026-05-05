import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorize, saveOverride } from '@/lib/categorization/rules'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import type { TablesUpdate } from '@/types/database'

// ─── GET /api/transactions ────────────────────────────────────────────────────
// Query params: type, category, is_reviewed, source, date_from, date_to, limit, offset

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const category = searchParams.get('category')
  const isReviewed = searchParams.get('is_reviewed')
  const source = searchParams.get('source')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('org_id', member.org_id)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)
  if (category) query = query.eq('category', category)
  if (isReviewed !== null) query = query.eq('is_reviewed', isReviewed === 'true')
  if (source) query = query.eq('source', source)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    { transactions: data ?? [], count: data?.length ?? 0 },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } }
  )
}

// ─── POST /api/transactions ───────────────────────────────────────────────────

const CreateSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().optional(),
  recurrence: z.enum(['monthly', 'quarterly', 'annual', 'one_time']).optional(),
  notes: z.string().optional(),
  vendor: z.string().optional(),
  receipt_url: z.string().url().optional(),
})

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
  const orgId = member.org_id

  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { type, amount, description, date, category, recurrence, notes, vendor, receipt_url } = parsed.data

  let resolvedCategory = category
  let categoryConfidence: string
  let categoryMethod: string
  let resolvedRevenueType: string | null = null

  if (resolvedCategory) {
    categoryConfidence = 'high'
    categoryMethod = 'user'
    const { CATEGORY_TO_REVENUE_TYPE } = await import('@/types')
    resolvedRevenueType = CATEGORY_TO_REVENUE_TYPE[resolvedCategory as keyof typeof CATEGORY_TO_REVENUE_TYPE] ?? null
  } else {
    const result = await categorize(description, type, orgId)
    resolvedCategory = result.category
    categoryConfidence = result.confidence
    categoryMethod = result.method
    resolvedRevenueType = result.revenue_type ?? null
  }

  const { data: txn, error } = await supabase
    .from('transactions')
    .insert({
      org_id: orgId,
      type,
      amount,
      description,
      date,
      category: resolvedCategory,
      category_confidence: categoryConfidence,
      category_method: categoryMethod,
      revenue_type: resolvedRevenueType,
      recurrence: recurrence ?? null,
      notes: notes ?? null,
      vendor: vendor ?? null,
      receipt_url: receipt_url ?? null,
      source: 'manual',
      is_reviewed: !!category,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ transaction: txn }, { status: 201 })
}

// ─── PATCH /api/transactions ──────────────────────────────────────────────────

const PatchSchema = z.object({
  id: z.string().uuid(),
  category: z.string().optional(),
  recurrence: z.enum(['monthly', 'quarterly', 'annual', 'one_time']).nullable().optional(),
  is_reviewed: z.boolean().optional(),
  notes: z.string().optional(),
  vendor: z.string().optional(),
  project_id: z.string().uuid().nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
  const orgId = member.org_id

  const body = await request.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id, category, recurrence, is_reviewed, notes, vendor, project_id } = parsed.data

  // Fetch before-state for audit
  const { data: before } = await supabase
    .from('transactions')
    .select('category, is_reviewed, notes, vendor, description, type')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!before) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  const updateData: TablesUpdate<'transactions'> = {}
  if (category !== undefined) {
    updateData.category = category
    updateData.category_method = 'user'
    updateData.category_confidence = 'high'
    updateData.is_reviewed = true
  }
  if (recurrence !== undefined) updateData.recurrence = recurrence
  if (is_reviewed !== undefined) updateData.is_reviewed = is_reviewed
  if (notes !== undefined) updateData.notes = notes
  if (vendor !== undefined) updateData.vendor = vendor
  if (project_id !== undefined) updateData.project_id = project_id

  const { data: txn, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Save user correction as override for future auto-categorization
  if (category && before.description) {
    await saveOverride(orgId, before.description, category)
  }

  return NextResponse.json({ transaction: txn })
}

// ─── DELETE /api/transactions ─────────────────────────────────────────────────
// Soft-deletes a manually-created transaction. Imported transactions (source ≠
// 'manual' | 'invoice') are rejected with 403 — remove them via the integration
// disconnect flow instead.

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  let id: string
  try {
    const body = await request.json() as { id?: string }
    if (!body.id) throw new Error()
    id = body.id
  } catch {
    return NextResponse.json({ error: 'Missing transaction id' }, { status: 400 })
  }

  const { data: txn } = await supabase
    .from('transactions')
    .select('id, source, amount, type, description, category')
    .eq('id', id)
    .eq('org_id', member.org_id)
    .is('deleted_at', null)
    .single()

  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  if (!['manual', 'invoice'].includes(txn.source)) {
    return NextResponse.json(
      { error: 'Only manually created transactions can be deleted. To remove imported data, disconnect the integration.' },
      { status: 403 }
    )
  }

  await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  await writeAuditLog({
    supabase,
    orgId: member.org_id,
    userId: user.id,
    entityType: 'transaction',
    entityId: id,
    action: 'deleted',
    beforeState: { source: txn.source, amount: txn.amount, type: txn.type, description: txn.description, category: txn.category },
    request,
  })

  return NextResponse.json({ deleted: true })
}
