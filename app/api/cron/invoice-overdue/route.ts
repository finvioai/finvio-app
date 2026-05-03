import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'

// Vercel Cron — runs daily at 06:00 UTC
// Finds all 'sent' invoices where due_date < today and marks them 'overdue'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: overdueInvoices, error } = await supabase
    .from('invoices')
    .select('id, org_id, invoice_number, amount, due_date')
    .eq('status', 'sent')
    .lt('due_date', today)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return NextResponse.json({ ok: true, marked: 0 })
  }

  const ids = overdueInvoices.map((inv) => inv.id)
  await supabase.from('invoices').update({ status: 'overdue' }).in('id', ids)

  // Write audit log entries for each overdue transition
  for (const inv of overdueInvoices) {
    await writeAuditLog({
      supabase,
      orgId: inv.org_id,
      userId: null,
      entityType: 'invoice',
      entityId: inv.id,
      action: 'marked_overdue',
      beforeState: { status: 'sent', due_date: inv.due_date },
      afterState: { status: 'overdue' },
    })
  }

  return NextResponse.json({ ok: true, marked: overdueInvoices.length, ids })
}
