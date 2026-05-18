import type { SupabaseClient } from '@supabase/supabase-js'

const PAYOUT_WINDOW_DAYS = 3      // Stripe payout → bank deposit lag (typically 1–3 days)
const INVOICE_WINDOW_DAYS = 14    // Income → invoice match window (invoices paid after due date)
const DUPLICATE_WINDOW_DAYS = 1   // Adjacent-day cross-source duplicate detection
const AMOUNT_TOLERANCE = 0.01     // Cents-level float tolerance

interface TxnRow {
  id: string
  amount: number
  date: string
  type: string
  source: string
  source_ref_id: string | null
  tags: string[] | null
}

interface InvoiceRow {
  id: string
  amount: number
  due_date: string | null
  invoice_date: string | null
  status: string
  customer_name: string | null
  invoice_number: string
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
  )
}

// ─── 1. Stripe Payout ↔ Bank Deposit reconciliation ──────────────────────────
// Prevents double-counting: Stripe creates an income transaction when a payout
// is initiated; the bank (Plaid / Mercury / Brex) creates a matching credit
// when it lands. Both are the same money. Matched pairs are flagged
// is_reconciled = true and point at each other via reconciled_with.

async function reconcilePayouts(
  orgId: string,
  supabase: SupabaseClient
): Promise<{ matched: number; error?: string }> {
  const { data: payouts, error: pe } = await supabase
    .from('transactions')
    .select('id, amount, date, type, source, source_ref_id, tags')
    .eq('org_id', orgId)
    .eq('source', 'stripe')
    .eq('type', 'income')
    .eq('is_reconciled', false)
    .like('source_ref_id', 'payout_%')
    .is('deleted_at', null)

  if (pe) return { matched: 0, error: pe.message }

  const { data: deposits, error: de } = await supabase
    .from('transactions')
    .select('id, amount, date, type, source, source_ref_id, tags')
    .eq('org_id', orgId)
    .in('source', ['plaid', 'mercury', 'brex'])
    .eq('type', 'income')
    .eq('is_reconciled', false)
    .is('deleted_at', null)

  if (de) return { matched: 0, error: de.message }
  if (!payouts?.length || !deposits?.length) return { matched: 0 }

  let matched = 0
  const usedDepositIds = new Set<string>()

  for (const payout of payouts as TxnRow[]) {
    const match = (deposits as TxnRow[]).find(
      (d) =>
        !usedDepositIds.has(d.id) &&
        Math.abs(d.amount - payout.amount) <= AMOUNT_TOLERANCE &&
        daysBetween(d.date, payout.date) <= PAYOUT_WINDOW_DAYS
    )
    if (!match) continue

    usedDepositIds.add(match.id)
    await Promise.all([
      supabase
        .from('transactions')
        .update({ is_reconciled: true, reconciled_with: match.id })
        .eq('id', payout.id),
      supabase
        .from('transactions')
        .update({ is_reconciled: true, reconciled_with: payout.id })
        .eq('id', match.id),
    ])
    matched++
  }

  return { matched }
}

// ─── 2. Income → Invoice auto-matching ───────────────────────────────────────
// When income arrives from ANY source (bank, payment processor, manual), the
// engine checks open invoices for a matching amount (±$0.01) within 14 days
// of the invoice date or due date.
//
// On match:
//   - transaction.invoice_id is set (links payment to the invoice)
//   - invoice.status → 'paid' and paid_at is recorded
//
// This covers the accounts-receivable cycle: create invoice → client pays →
// money lands in bank → engine connects the bank credit to the invoice.

async function matchTransactionsToInvoices(
  orgId: string,
  supabase: SupabaseClient
): Promise<{ matched: number; error?: string }> {
  const { data: openInvoices, error: ie } = await supabase
    .from('invoices')
    .select('id, amount, due_date, invoice_date, status, customer_name, invoice_number')
    .eq('org_id', orgId)
    .in('status', ['sent', 'overdue'])

  if (ie) return { matched: 0, error: ie.message }
  if (!openInvoices?.length) return { matched: 0 }

  // Only income transactions that don't have an invoice linked yet
  const { data: incomes, error: te } = await supabase
    .from('transactions')
    .select('id, amount, date, type, source, source_ref_id, tags')
    .eq('org_id', orgId)
    .eq('type', 'income')
    .is('invoice_id', null)
    .is('deleted_at', null)

  if (te) return { matched: 0, error: te.message }
  if (!incomes?.length) return { matched: 0 }

  let matched = 0
  const usedInvoiceIds = new Set<string>()

  for (const txn of incomes as TxnRow[]) {
    const matchedInvoice = (openInvoices as InvoiceRow[]).find((inv) => {
      if (usedInvoiceIds.has(inv.id)) return false
      if (Math.abs(inv.amount - txn.amount) > AMOUNT_TOLERANCE) return false
      // Check within window of invoice_date or due_date (prefer due_date)
      const refDate = inv.due_date ?? inv.invoice_date
      if (!refDate) return false
      return daysBetween(txn.date, refDate) <= INVOICE_WINDOW_DAYS
    })

    if (!matchedInvoice) continue
    usedInvoiceIds.add(matchedInvoice.id)

    await Promise.all([
      supabase
        .from('transactions')
        .update({ invoice_id: matchedInvoice.id })
        .eq('id', txn.id),
      supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', matchedInvoice.id),
    ])

    matched++
  }

  return { matched }
}

// ─── 3. Cross-source duplicate detection ─────────────────────────────────────
// Detects when the same financial event is imported from two different
// sources — e.g., a subscription payment that appears in both QuickBooks
// (via accounting sync) and Stripe (via payment processor sync), or a bank
// expense captured by Gmail AND the bank integration.
//
// Within-source deduplication is handled at import time via source_ref_id.
// This function only looks for CROSS-source matches.
//
// Suspected duplicates are tagged 'potential_duplicate' in the tags column
// for user review. They are NOT auto-deleted — the user decides which to keep.
//
// An already-reconciled pair (is_reconciled = true) is never flagged because
// the payout reconciliation deliberately marks both sides of the same event.

async function detectCrossSourceDuplicates(
  orgId: string,
  supabase: SupabaseClient
): Promise<{ flagged: number; error?: string }> {
  // Limit to last 60 days — older transactions are unlikely new duplicates
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: txns, error } = await supabase
    .from('transactions')
    .select('id, amount, date, type, source, source_ref_id, tags')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .or('is_reconciled.is.null,is_reconciled.eq.false')
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(500)

  if (error) return { flagged: 0, error: error.message }
  if (!txns?.length) return { flagged: 0 }

  const rows = txns as TxnRow[]
  let flagged = 0
  const alreadyFlagged = new Set<string>()
  const updates: PromiseLike<unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    if (alreadyFlagged.has(a.id)) continue

    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j]
      if (alreadyFlagged.has(b.id)) continue
      if (a.source === b.source) continue  // same source — not a cross-source dup
      if (a.type !== b.type) continue

      const amountMatch = Math.abs(a.amount - b.amount) <= AMOUNT_TOLERANCE
      const dateClose = daysBetween(a.date, b.date) <= DUPLICATE_WINDOW_DAYS

      if (amountMatch && dateClose) {
        if (!a.tags?.includes('potential_duplicate')) {
          updates.push(
            supabase
              .from('transactions')
              .update({ tags: [...(a.tags ?? []), 'potential_duplicate'] })
              .eq('id', a.id)
          )
        }
        if (!b.tags?.includes('potential_duplicate')) {
          updates.push(
            supabase
              .from('transactions')
              .update({ tags: [...(b.tags ?? []), 'potential_duplicate'] })
              .eq('id', b.id)
          )
        }
        alreadyFlagged.add(a.id)
        alreadyFlagged.add(b.id)
        flagged++
        break  // one match per transaction
      }
    }
  }

  if (updates.length) await Promise.all(updates)

  return { flagged }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────
// Runs all three reconciliation passes for an org. Safe to call multiple times
// (idempotent: already-reconciled / already-matched items are skipped).

export async function reconcileOrgTransactions(
  orgId: string,
  supabase: SupabaseClient
): Promise<{ matched: number; invoicesMatched: number; duplicatesFlagged: number; error?: string }> {
  const [payoutResult, invoiceResult, duplicateResult] = await Promise.all([
    reconcilePayouts(orgId, supabase),
    matchTransactionsToInvoices(orgId, supabase),
    detectCrossSourceDuplicates(orgId, supabase),
  ])

  const errors = [payoutResult.error, invoiceResult.error, duplicateResult.error].filter(Boolean)

  return {
    matched: payoutResult.matched,
    invoicesMatched: invoiceResult.matched,
    duplicatesFlagged: duplicateResult.flagged,
    ...(errors.length ? { error: errors.join('; ') } : {}),
  }
}
