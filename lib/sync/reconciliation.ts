import type { SupabaseClient } from '@supabase/supabase-js'

const WINDOW_DAYS = 3
const AMOUNT_TOLERANCE = 0.01   // cents-level float tolerance

interface TxnRow {
  id: string
  amount: number
  date: string
  source_ref_id: string | null
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
  )
}

export async function reconcileOrgTransactions(
  orgId: string,
  supabase: SupabaseClient
): Promise<{ matched: number; error?: string }> {
  // Fetch unreconciled Stripe payout transactions (income, source = stripe, ref starts with payout_)
  const { data: payouts, error: pe } = await supabase
    .from('transactions')
    .select('id, amount, date, source_ref_id')
    .eq('org_id', orgId)
    .eq('source', 'stripe')
    .eq('type', 'income')
    .eq('is_reconciled', false)
    .like('source_ref_id', 'payout_%')

  if (pe) return { matched: 0, error: pe.message }

  // Fetch unreconciled Plaid income transactions
  const { data: deposits, error: de } = await supabase
    .from('transactions')
    .select('id, amount, date, source_ref_id')
    .eq('org_id', orgId)
    .eq('source', 'plaid')
    .eq('type', 'income')
    .eq('is_reconciled', false)

  if (de) return { matched: 0, error: de.message }

  if (!payouts?.length || !deposits?.length) return { matched: 0 }

  let matched = 0
  const usedDepositIds = new Set<string>()

  for (const payout of payouts as TxnRow[]) {
    // Find the best matching Plaid deposit: same amount (within tolerance), within ±3 days
    const match = (deposits as TxnRow[]).find(
      (d) =>
        !usedDepositIds.has(d.id) &&
        Math.abs(d.amount - payout.amount) <= AMOUNT_TOLERANCE &&
        daysBetween(d.date, payout.date) <= WINDOW_DAYS
    )

    if (!match) continue

    usedDepositIds.add(match.id)

    // Mark both as reconciled, pointing at each other
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
