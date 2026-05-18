# Reconciliation & Duplicate Avoidance

How Finvio prevents double-counting and keeps your financial data clean when data flows in from multiple sources simultaneously.

---

## Overview

Finvio aggregates transactions from many sources at once — Stripe, Brex, Plaid, QuickBooks, Gmail, manual entries, CSV imports, and more. The same financial event can legitimately appear in two or more of these sources. Without a reconciliation layer, your P&L, burn rate, and runway calculations would be wrong.

The reconciliation engine runs three passes after every sync:

| Pass | What it does |
|------|-------------|
| **Payout reconciliation** | Matches Stripe payouts against bank deposits (Plaid / Mercury / Brex) |
| **Invoice auto-matching** | Links incoming payments to open invoices and marks them paid |
| **Cross-source duplicate detection** | Flags transactions that appear to be the same event from two different integrations |

---

## How the data flows

```
Stripe webhook          → income transaction (source='stripe', source_ref_id='payout_po_xxx')
Bank sync (Plaid etc.)  → income transaction (source='plaid',  source_ref_id='txn_xxx')
                                    ↕  reconciliation pass 1: match these two
                         Both marked is_reconciled=true, reconciled_with=<each other's ID>
                         → Only ONE side counted in P&L (the Stripe side, as revenue)

Invoice created          → invoices table (status='sent')
Customer pays            → income transaction arrives from bank
                                    ↕  reconciliation pass 2: invoice auto-match
                         invoice.status → 'paid', invoice.paid_at = now()
                         transaction.invoice_id → invoice.id

QuickBooks import        → income transaction (source='quickbooks')
Manual entry             → income transaction (source='manual')  ← same amount, same day
                                    ↕  reconciliation pass 3: cross-source duplicate detection
                         Both tagged 'potential_duplicate' in the tags column
                         User sees warning banner and orange-highlighted rows
                         User deletes the duplicate manually
```

---

## Pass 1 — Stripe Payout ↔ Bank Deposit Reconciliation

### Why it exists

When Stripe transfers a payout to your bank account, two records appear:

1. **Stripe income transaction** (`source='stripe'`, `source_ref_id='payout_po_xxx'`) — created by the Stripe webhook when the payout is initiated.
2. **Bank credit transaction** (`source='plaid'|'mercury'|'brex'`) — created by the bank sync when the deposit lands.

Both represent the same money. Including both in P&L would double-count your revenue.

### Matching logic

```
For each unreconciled Stripe payout:
  Find a bank credit transaction where:
    - source IN ('plaid', 'mercury', 'brex')
    - type = 'income'
    - is_reconciled = false
    - |amount difference| ≤ $0.01
    - |date difference| ≤ 3 days   ← Stripe payouts typically arrive in 1–3 business days
  
  On match:
    - Both rows: is_reconciled = true
    - Both rows: reconciled_with = <other row's UUID>
```

### Effect on calculations

Reconciled transactions are **still included in all queries** — they are not deleted. The `is_reconciled` flag tells downstream aggregations (MRR, P&L, runway) to count only one side of each pair to avoid double-counting. The Stripe income transaction is the authoritative revenue record; the bank credit is the settlement confirmation.

### Tolerance

- Amount: ±$0.01 (float rounding during currency conversion)
- Date: ±3 days (bank processing time; international transfers may take longer)

If Stripe and the bank sides never meet within those bounds, both stay unreconciled and are each counted once — a small double-count is safer than silently discarding data.

---

## Pass 2 — Invoice Auto-Matching

### Why it exists

The AR (accounts receivable) lifecycle in Finvio:

```
1. You create an invoice in Finvio (status='sent')
2. Client pays — money lands in your bank account
3. Bank sync brings in an income transaction
```

Without invoice matching, steps 1 and 3 are disconnected. The invoice sits as "sent" forever and you have to manually mark it paid.

### Matching logic

```
For each open invoice (status IN 'sent', 'overdue'):
  For each income transaction where invoice_id IS NULL:
    - |amount difference| ≤ $0.01
    - |date difference from invoice_date or due_date| ≤ 14 days

  On match:
    - transaction.invoice_id = invoice.id
    - invoice.status = 'paid'
    - invoice.paid_at = now()
```

The 14-day window accounts for:
- Clients who pay a few days after the due date
- Bank processing delays
- Invoices created retroactively after the payment arrived

### What triggers it

Invoice matching runs after every sync in the daily cron, and after manual syncs triggered via the Connections page. It is idempotent — already-matched transactions (invoice_id IS NOT NULL) and already-paid invoices are skipped.

### Manual override

If the auto-match is wrong (e.g., two clients paid the same amount in the same week), you can correct the link:

1. Go to **Transactions**
2. Click the **Project / Invoice** dropdown on the income row
3. Select the correct invoice (or clear it)

The dropdown only shows invoices with status `sent` or `overdue`, plus the currently linked invoice.

---

## Pass 3 — Cross-Source Duplicate Detection

### Why it exists

Within-source deduplication is handled at import time via `source_ref_id` — each integration checks whether it has already imported a given record ID before inserting. But cross-source duplicates are harder:

- QuickBooks imports a sale AND Stripe also imports the same charge
- A bank CSV import overlaps with the Plaid bank sync
- Gmail detects a subscription charge that Brex also imported
- A manual entry duplicates an auto-imported transaction

These are not always duplicates — a QuickBooks invoice payment and a Stripe charge for the same client could genuinely be two separate things. So the engine **flags** suspected duplicates for human review rather than auto-deleting.

### Matching logic

```
For all non-reconciled transactions in the last 60 days (limit 500):
  For each pair (A, B) where:
    - A.source ≠ B.source        ← different integrations
    - A.type = B.type            ← both income or both expense
    - |A.amount - B.amount| ≤ $0.01
    - |A.date - B.date| ≤ 1 day  ← same or adjacent calendar day

  Tag both with 'potential_duplicate' in the tags[] column
```

### What the user sees

- A warning banner at the top of the Transactions page: "N transactions may be duplicates from different integrations."
- Duplicate rows have an orange background tint.
- A copy icon appears in the row action column.

The user inspects both rows and deletes the one from the less authoritative source. Authoritative source order (most → least trusted):

```
Stripe / Brex / Plaid / Mercury   ← direct financial integrations (truth)
QuickBooks / Xero                 ← accounting systems (may include manual entries)
Shopify / PayPal / LemonSqueezy   ← platform integrations
Gmail / Outlook                   ← email parsing (least accurate)
manual                            ← user-entered
CSV import                        ← uploaded data
```

Deleting a Gmail or manual duplicate is allowed directly from the Transactions page. For other sources, you must disconnect the integration to remove all its data.

---

## Within-Source Deduplication (at import time)

Before the reconciliation passes even run, each integration prevents importing the same record twice. Every sync checks:

```sql
SELECT id FROM transactions
WHERE org_id = ? AND source_ref_id = ? AND deleted_at IS NULL
```

If a row exists with that `source_ref_id`, the transaction is **skipped** (counted as `skipped` in sync results). This is the primary defence against duplicates within a single source.

`source_ref_id` formats by integration:

| Source | Format |
|--------|--------|
| Stripe | `charge_{id}`, `payout_{id}`, `refund_{id}` |
| Brex card | `brex_card_{id}` |
| Brex cash | `brex_cash_{id}` |
| Mercury | `mercury_{id}` |
| Plaid | `plaid_{id}` |
| Shopify | `shopify_order_{id}`, `shopify_refund_{id}` |
| PayPal | `paypal_{id}` |
| LemonSqueezy | `ls_{id}` |
| QuickBooks | `qb_{id}` |
| Gmail / Outlook | `gmail_{messageId}`, `outlook_{messageId}` |

The `brex_card_` / `brex_cash_` prefix distinction is intentional: Brex reports each card charge in the card endpoint AND as a batch settlement in the cash account. The `CARD` type cash entries are skipped at sync time; card charges use `brex_card_` prefix; cash movements use `brex_cash_`. This prevents the same Brex card charge appearing twice.

---

## When reconciliation runs

| Trigger | What runs |
|---------|-----------|
| Daily cron after Stripe sync | All 3 passes |
| Daily cron after Gmail sync | Passes 2 + 3 (invoice match + duplicate detection) |
| Daily cron after Outlook sync | Passes 2 + 3 |
| Manual sync via Connections page | All 3 passes (called from sync route) |

The reconciliation function is idempotent:
- Already-reconciled payouts (`is_reconciled=true`) are excluded from pass 1
- Already-matched income transactions (`invoice_id IS NOT NULL`) are excluded from pass 2
- Already-flagged duplicates (`'potential_duplicate' IN tags`) are excluded from pass 3

---

## The Project / Invoice column

Every income transaction can be linked to either a **Project** or an **Invoice** using the dropdown in the Transactions table. For expense transactions, only projects are shown (invoices are outgoing payment requests, not relevant to expenses).

**Auto-linking**: Pass 2 sets `invoice_id` automatically when a bank deposit matches an open invoice. This also appears immediately in the Project / Invoice dropdown.

**Manual linking**: Use the dropdown to:
- Link an income payment to a specific invoice (marks the invoice as paid)
- Link any transaction to a project (contributes to the project's collected/expenses totals)
- Clear a link by selecting `—`

Switching from an invoice link to a project link (or vice versa) clears the other field in the same PATCH request to avoid orphaned links.

---

## Caveats and limitations

**Partial Stripe payouts**: Stripe can batch multiple charges into one payout. The payout amount equals the sum of charges minus fees. Pass 1 matches the payout transaction against the bank deposit (same net amount), which works correctly. The individual charge transactions are separate income rows — not reconciled against bank deposits directly.

**International currency**: Amount matching uses a $0.01 tolerance in the stored `amount` field (always in USD equivalent). FX rounding can occasionally prevent a match. In that case, link the invoice manually via the dropdown.

**Time zone edge cases**: Dates are stored as calendar dates in your bank's time zone. For transactions near midnight, a 1-day date difference might represent the same real-world event. Pass 3's 1-day tolerance accounts for this.

**Very large orgs**: Cross-source duplicate detection (pass 3) is limited to the 500 most-recent non-reconciled transactions in the last 60 days to keep query times bounded. Older potential duplicates are not flagged automatically.

---

## Key files

| File | Role |
|------|------|
| `lib/sync/reconciliation.ts` | All three reconciliation passes; `reconcileOrgTransactions` orchestrator |
| `app/api/cron/daily-sync/route.ts` | Calls reconciliation after Stripe / Gmail / Outlook syncs |
| `app/(dashboard)/transactions/page.tsx` | Displays duplicate warnings; Project / Invoice dropdown |
| `app/api/transactions/route.ts` | PATCH handler for `invoice_id` and `project_id`; DELETE allows Gmail source |
