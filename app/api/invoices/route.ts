import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import type { TablesUpdate } from '@/types/database'

function generateInvoiceNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `INV-${suffix}`
}

async function getOrgMember(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single()
  return data
}

// ─── GET /api/invoices ────────────────────────────────────────────────────────
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
    .from('invoices')
    .select('*')
    .eq('org_id', member.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    { invoices: data ?? [], count: data?.length ?? 0 },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } }
  )
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────

const CreateSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_email: z.string().email().optional(),
  amount: z.number().positive(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
  vendor_name: z.string().optional(),
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative(),
    amount: z.number().nonnegative(),
  })).optional(),
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

  const { customer_name, customer_email, amount, due_date, invoice_date, notes, vendor_name, line_items } = parsed.data

  // Ensure invoice_number is unique (retry up to 5 times)
  let invoice_number = generateInvoiceNumber()
  for (let i = 0; i < 4; i++) {
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('invoice_number', invoice_number)
      .maybeSingle()
    if (!existing) break
    invoice_number = generateInvoiceNumber()
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      org_id: member.org_id,
      invoice_number,
      customer_name,
      customer_email: customer_email ?? null,
      amount,
      due_date: due_date ?? null,
      invoice_date: invoice_date ?? today,
      notes: notes ?? null,
      vendor_name: vendor_name ?? null,
      line_items: line_items ?? null,
      status: 'draft',
      source: 'manual',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    supabase,
    orgId: member.org_id,
    userId: user.id,
    entityType: 'invoice',
    entityId: invoice.id,
    action: 'created',
    afterState: { invoice_number: invoice.invoice_number, amount: invoice.amount, status: 'draft' },
    request,
  })

  return NextResponse.json({ invoice }, { status: 201 })
}

// ─── PATCH /api/invoices ──────────────────────────────────────────────────────

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  const { id, status, notes, due_date } = parsed.data

  // Fetch current invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('org_id', member.org_id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status === 'paid' && status === 'paid') {
    return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
  }

  const updateData: TablesUpdate<'invoices'> = {}
  if (status !== undefined) updateData.status = status
  if (notes !== undefined) updateData.notes = notes
  if (due_date !== undefined) updateData.due_date = due_date

  if (status === 'paid') {
    updateData.paid_at = new Date().toISOString()
  }

  const { data: updated, error: updateError } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', member.org_id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await writeAuditLog({
    supabase,
    orgId: member.org_id,
    userId: user.id,
    entityType: 'invoice',
    entityId: id,
    action: status ? `status_changed_to_${status}` : 'updated',
    beforeState: { status: invoice.status },
    afterState: { ...updateData },
    request,
  })

  // When marked paid, auto-create an income transaction
  if (status === 'paid') {
    await supabase.from('transactions').insert({
      org_id: member.org_id,
      type: 'income',
      amount: invoice.amount,
      description: `Invoice ${invoice.invoice_number}${invoice.customer_name ? ` — ${invoice.customer_name}` : ''}`,
      date: new Date().toISOString().split('T')[0],
      category: 'Consulting Revenue',
      category_method: 'rule',
      category_confidence: 'high',
      source: 'invoice',
      is_reviewed: true,
      notes: `Auto-created from invoice ${invoice.invoice_number}`,
      created_by: user.id,
    })
  }

  return NextResponse.json({ invoice: updated })
}
