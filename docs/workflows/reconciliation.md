# Reconciliation — Matching Stripe Payouts with Bank Deposits

When both Stripe and Plaid are connected, the same money appears twice:
- As a Stripe payout (Stripe paid out to your bank)
- As a bank deposit in Plaid (the money arrived in your bank account)

Without reconciliation, Finvio would count this as two separate income events and double your revenue figures. Reconciliation matches these pairs and flags the bank deposit so it's excluded from income calculations.

---

## File

[lib/sync/reconciliation.ts](../../lib/sync/reconciliation.ts)

---

## When It Runs

After every Stripe sync and after every Plaid sync. This ensures that as soon as both sides of a payout/deposit pair are in the database, they get matched.

---

## Matching Logic

**Step 1 — Fetch unreconciled Stripe payouts:**
```sql
SELECT id, amount, date FROM transactions
WHERE org_id = ? 
  AND source = 'stripe' 
  AND type = 'income'
  AND source_ref_id LIKE 'payout_%'
  AND is_reconciled = false
```

**Step 2 — Fetch unreconciled Plaid income transactions:**
```sql
SELECT id, amount, date FROM transactions
WHERE org_id = ?
  AND source = 'plaid'
  AND type = 'income'
  AND is_reconciled = false
```

**Step 3 — Match pairs:**

For each Stripe payout, find a Plaid transaction where:
1. Amounts match within $0.01 (accounts for rounding)
2. Dates are within ±3 days (payouts take 1–3 business days to settle)

```typescript
Math.abs(payout.amount - plaidTxn.amount) <= 0.01
&&
Math.abs(daysBetween(payout.date, plaidTxn.date)) <= 3
```

**Step 4 — Mark matched pairs:**

```typescript
// Mark Stripe payout
await supabase.from('transactions').update({
  is_reconciled: true,
  reconciled_with: plaidTxnId
}).eq('id', payoutId)

// Mark Plaid deposit
await supabase.from('transactions').update({
  is_reconciled: true,
  reconciled_with: payoutId
}).eq('id', plaidTxnId)
```

**Step 5 — Prevent double-matching:**

A `Set` tracks which Plaid transaction IDs have already been matched in this run. A transaction can only be matched once per reconciliation pass.

---

## Impact on Metrics

When both Stripe and Plaid are connected, the rule is: **use Stripe as the authoritative source for revenue**.

The `getCashBalance()` function in `lib/metrics/index.ts` prioritizes real Plaid bank balance data when available. Income totals should logically exclude reconciled Plaid deposits to avoid double-counting — the Stripe payout already accounts for that revenue.

In practice: if you see inflated income figures when both Stripe and Plaid are connected, check whether reconciliation ran. You can verify by looking at `is_reconciled` flags on recent payout/deposit pairs.

---

## The `reconciled_with` Field

Both transactions in a matched pair point to each other via `reconciled_with`. This bidirectional link means you can:
- Start from a Stripe payout → find the corresponding bank deposit
- Start from a bank deposit → find the Stripe payout that caused it

Useful for auditing and explaining to a user why a transaction is flagged.

---

## Edge Cases

| Situation | Outcome |
|-----------|---------|
| Stripe payout not yet in Plaid (payout just created) | No match found this run; matched on next sync after settlement |
| Multiple payouts on same day with same amount | First match wins; duplicates remain unreconciled (rare in practice) |
| Payout partially matches two Plaid deposits | No match (strict single-pair matching prevents partial splits) |
| Plaid connected but Stripe not connected | Reconciliation has nothing to match; skips |
| Stripe connected but Plaid not connected | Reconciliation has nothing to match; skips |
