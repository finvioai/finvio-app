import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'
import type { PendingAction, CreateExpenseParams, CreateInvoiceParams, AddIncomeParams } from '@/types'

// ─── POST /api/chat/confirm ───────────────────────────────────────────────────
// Executes a confirmed write action and writes an audit log entry.

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
  const { action, sessionId } = body as { action: PendingAction; sessionId: string }

  if (!action?.type || !action?.params) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  let resultId: string | undefined
  let auditAction = ''
  let auditAfter: Record<string, unknown> = {}

  // ─── create_expense ───────────────────────────────────────────────────────
  if (action.type === 'create_expense') {
    const p = action.params as CreateExpenseParams

    const { data: txn, error } = await supabase
      .from('transactions')
      .insert({
        org_id: orgId,
        type: 'expense',
        amount: p.amount,
        description: p.title,
        category: p.category,
        date: p.date,
        recurrence: p.recurrence ?? null,
        notes: p.notes,
        source: 'manual',
        is_reviewed: true,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    resultId = txn.id
    auditAction = 'create_expense'
    auditAfter = { transaction_id: resultId, ...p }
  }

  // ─── create_invoice ───────────────────────────────────────────────────────
  if (action.type === 'create_invoice') {
    const p = action.params as CreateInvoiceParams
    const invoiceNumber = `INV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        org_id: orgId,
        customer_name: p.customerName,
        invoice_number: invoiceNumber,
        amount: p.amount,
        due_date: p.dueDate,
        notes: p.notes,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    resultId = invoice.id
    auditAction = 'create_invoice'
    auditAfter = { invoice_id: resultId, invoice_number: invoiceNumber, ...p }
  }

  // ─── add_income ───────────────────────────────────────────────────────────
  if (action.type === 'add_income') {
    const p = action.params as AddIncomeParams

    const { data: txn, error } = await supabase
      .from('transactions')
      .insert({
        org_id: orgId,
        type: 'income',
        amount: p.amount,
        description: p.description,
        category: p.category,
        recurrence: p.recurrence ?? null,
        date: p.date,
        notes: p.source,
        source: 'manual',
        is_reviewed: true,
        project_id: p.project_id ?? null,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    resultId = txn.id
    auditAction = 'add_income'
    auditAfter = { transaction_id: resultId, ...p }
  }

  // ─── audit log ────────────────────────────────────────────────────────────
  await writeAuditLog({
    supabase,
    orgId,
    userId: user.id,
    action: `chat.${auditAction}`,
    entityType: action.type === 'create_invoice' ? 'invoice' : 'transaction',
    entityId: resultId,
    afterState: auditAfter,
    request,
  })

  // ─── store a confirmation message in the chat session ─────────────────────
  if (sessionId) {
    const label: Record<string, string> = {
      create_expense: 'expense',
      create_invoice: 'invoice',
      add_income: 'income record',
    }
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      org_id: orgId,
      role: 'assistant',
      content: `Done! Your ${label[action.type] ?? 'record'} has been saved successfully.`,
      intent: action.type,
    } satisfies import('@/types/database').Database['public']['Tables']['chat_messages']['Insert'])
  }

  return NextResponse.json({ success: true, id: resultId })
}
