# Deduplication — How Duplicate Transactions Are Prevented

Finvio uses a `source_ref_id` column on the `transactions` table as the primary deduplication key. Every synced transaction gets a deterministic, stable ID derived from the provider's own identifier. Before inserting, the system checks if a row with that `source_ref_id` already exists for this org.

---

## source_ref_id Format

| Provider | Format | Example |
|----------|--------|---------|
| Stripe charge | `{charge.id}` | `ch_3Pqrs...` |
| Stripe refund | `refund_{charge.id}` | `refund_ch_3Pqrs...` |
| Stripe invoice | `invoice_{invoice.id}` | `invoice_in_1Nxyz...` |
| Stripe payout | `payout_{payout.id}` | `payout_po_1Abcd...` |
| Plaid | `plaid_{transaction_id}` | `plaid_abc123def456` |
| PayPal | `paypal_{transaction_id}` | `paypal_7WH123456` |
| Shopify | `shopify_{order.id}` | `shopify_5012345678901` |
| QuickBooks purchase | `qb_purchase_{Id}` | `qb_purchase_1` |
| QuickBooks paid invoice | `qb_invoice_{Id}` | `qb_invoice_42` |
| QuickBooks sales receipt | `qb_receipt_{Id}` | `qb_receipt_7` |
| CSV import | `{importId}_{rowIndex}` | `import_uuid_42` |
| Manual | null | (no dedup needed) |

The `source_ref_id` is unique within an org — the uniqueness constraint is `(org_id, source_ref_id)`.

---

## How the Check Works

### Stripe, PayPal, Shopify (check-before-insert)

```typescript
const { data: existing } = await supabase
  .from('transactions')
  .select('id')
  .eq('org_id', orgId)
  .eq('source_ref_id', refId)
  .maybeSingle()

if (existing) {
  skipped++
  continue  // skip, don't insert
}

// safe to insert
await supabase.from('transactions').insert({ ... })
synced++
```

If a transaction already exists: increment `skipped` counter, move on. No update is performed.

### Plaid (check-before-insert + update-if-modified)

Plaid's `transactionsSync` API returns both `added` and `modified` transactions. Modified transactions represent corrections (e.g., merchant name clarified, category updated by Plaid).

```typescript
if (existing) {
  await supabase.from('transactions').update({
    amount: absAmount,
    description,
    date,
  }).eq('id', existing.id)
  skipped++  // counts as "skipped" (not newly synced)
  continue
}
// new transaction — insert
```

Plaid modified transactions update `amount`, `description`, and `date` but preserve the user-set `category` and `is_reviewed` state.

### CSV Import (idempotency via import run)

CSV import uses `{importId}_{rowIndex}` as the ref ID. `importId` is a UUID generated once per import session and stored in `csv_imports`. If you re-upload the same file:
- New `importId` → new ref IDs → all rows treated as new
- Intentional: re-importing the same file is a user action that should create new records

There is no cross-import deduplication for CSV. If you need to avoid duplicates across separate CSV uploads, use the review queue to identify and delete duplicates.

---

## Reconciliation (Stripe ↔ Plaid Matching)

**File:** [lib/sync/reconciliation.ts](../../lib/sync/reconciliation.ts)

When both Stripe and Plaid are connected, Stripe payouts appear in both systems:
- As a `payout_*` transaction from Stripe (source='stripe')
- As a bank deposit from Plaid (source='plaid', type='income')

Reconciliation matches these pairs and marks them so the bank deposit isn't counted as additional income.

**Matching criteria (both must be true):**
1. Amount within $0.01 tolerance
2. Dates within ±3 days (payouts take 1-3 days to settle)

**What happens on match:**
- Both rows get `is_reconciled = true`
- Both rows get `reconciled_with = <other transaction id>`
- A `Set` prevents any transaction from being matched twice in the same run

**When reconciliation runs:** After each Stripe sync and after each Plaid sync.

**Impact on metrics:** `getCashBalance()` and income calculations in `lib/metrics/index.ts` should exclude reconciled Plaid deposits to avoid double-counting. The rule: use Stripe as authoritative for revenue when both are connected.

---

## Customers and Subscriptions (Stripe)

The `customers` and `subscriptions` tables use upsert logic keyed on `external_id` (the Stripe customer/subscription ID):

```typescript
const { data: existing } = await supabase
  .from('customers')
  .select('id')
  .eq('org_id', orgId)
  .eq('external_id', customer.id)
  .maybeSingle()

if (existing) {
  await supabase.from('customers').update({ ... }).eq('id', existing.id)
} else {
  await supabase.from('customers').insert({ ... })
}
```

This means syncing Stripe multiple times updates existing customer and subscription records rather than creating duplicates.

---

## Webhook Idempotency

**Table:** `webhook_events`

Stripe can deliver the same webhook event more than once (at-least-once delivery guarantee). The webhook handler checks `webhook_events` before processing:

```typescript
const { data: existing } = await supabase
  .from('webhook_events')
  .select('id')
  .eq('event_id', event.id)
  .maybeSingle()

if (existing) {
  return NextResponse.json({ received: true }) // already processed
}
```

After processing, the event ID is stored in `webhook_events` so subsequent deliveries are no-ops.

---

## Summary

| Mechanism | Where | Prevents |
|-----------|-------|---------|
| `source_ref_id` uniqueness | All sync providers | Re-syncing same transaction |
| Plaid modified handling | Plaid sync | Duplicate rows from Plaid corrections |
| Reconciliation `is_reconciled` flag | Stripe + Plaid together | Double-counting bank deposits |
| `external_id` upsert | Stripe customers/subscriptions | Duplicate customer/subscription rows |
| `webhook_events` table | Stripe webhook handler | Processing same Stripe event twice |
| CSV `{importId}_{rowIndex}` | CSV import | Inserting duplicate rows within one upload |
