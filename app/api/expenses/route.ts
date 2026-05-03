import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import type { TablesUpdate } from '@/types/database'

async function getOrgMember(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .single()
  return data
}

// ─── GET /api/expenses ────────────────────────────────────────────────────────
// Query params: status, limit, offset

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getOrgMember(supabase, user.id)
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('expense_reports')
    .select('*')
    .eq('org_id', member.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ expenses: data ?? [], count: data?.length ?? 0 })
}

// ─── POST /api/expenses ───────────────────────────────────────────────────────

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  submitter_name: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getOrgMember(supabase, user.id)
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { title, amount, category, date, notes, submitter_name } = parsed.data

  const { data: expense, error } = await supabase
    .from('expense_reports')
    .insert({
      org_id: member.org_id,
      title,
      amount,
      category,
      date,
      notes: notes ?? null,
      submitter_id: user.id,
      submitter_name: submitter_name ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    supabase,
    orgId: member.org_id,
    userId: user.id,
    entityType: 'expense_report',
    entityId: expense.id,
    action: 'submitted',
    afterState: { title: expense.title, amount: expense.amount, category: expense.category },
    request,
  })

  return NextResponse.json({ expense }, { status: 201 })
}

// ─── PATCH /api/expenses ──────────────────────────────────────────────────────

const PatchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject']).optional(),
  notes: z.string().optional(),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getOrgMember(supabase, user.id)
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  const body = await request.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id, action, notes } = parsed.data

  const { data: expense } = await supabase
    .from('expense_reports')
    .select('*')
    .eq('id', id)
    .eq('org_id', member.org_id)
    .single()

  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

  if (action && expense.status !== 'pending') {
    return NextResponse.json({ error: `Cannot ${action} an expense that is already ${expense.status}` }, { status: 400 })
  }

  // Approve/reject require owner or admin role
  if (action && !['owner', 'admin'].includes(member.role ?? '')) {
    return NextResponse.json({ error: 'Only owners and admins can approve or reject expenses' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const updateData: TablesUpdate<'expense_reports'> = {}

  if (action === 'approve') {
    updateData.status = 'approved'
    updateData.reviewed_by = user.id
    updateData.reviewed_at = now
  } else if (action === 'reject') {
    updateData.status = 'rejected'
    updateData.reviewed_by = user.id
    updateData.reviewed_at = now
  }

  if (notes !== undefined) updateData.notes = notes

  const { data: updated, error: updateError } = await supabase
    .from('expense_reports')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', member.org_id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (action) {
    await writeAuditLog({
      supabase,
      orgId: member.org_id,
      userId: user.id,
      entityType: 'expense_report',
      entityId: id,
      action: action === 'approve' ? 'approved' : 'rejected',
      beforeState: { status: expense.status },
      afterState: { status: updateData.status, reviewed_by: user.id },
      request,
    })
  }

  // Approval auto-creates an expense transaction and links it
  if (action === 'approve') {
    const { data: txn } = await supabase
      .from('transactions')
      .insert({
        org_id: member.org_id,
        type: 'expense',
        amount: expense.amount,
        description: expense.title,
        date: expense.date,
        category: expense.category,
        category_method: 'user',
        category_confidence: 'high',
        source: 'expense_report',
        is_reviewed: true,
        notes: expense.notes ?? null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (txn) {
      await supabase
        .from('expense_reports')
        .update({ transaction_id: txn.id })
        .eq('id', id)

      return NextResponse.json({ expense: { ...updated, transaction_id: txn.id } })
    }
  }

  return NextResponse.json({ expense: updated })
}
