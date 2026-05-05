# Transactions — How They're Created, Stored, and Shown

Transactions are the core data unit in Finvio. Everything financial — income, expenses, synced data, manual entries, imported rows — ends up as a row in the `transactions` table.

---

## Transaction Shape

```typescript
{
  id: uuid,
  org_id: uuid,
  type: 'income' | 'expense',
  amount: number,           // always positive, direction is in `type`
  description: string,
  date: string,             // ISO date (YYYY-MM-DD)
  category: string,         // e.g. "Software & SaaS", "Payroll"
  subcategory?: string,
  category_confidence: 'high' | 'medium' | 'low',
  category_method: 'rule' | 'ai' | 'user',
  source: 'stripe' | 'plaid' | 'paypal' | 'shopify' | 'csv' | 'manual' | 'invoice',
  source_ref_id?: string,   // dedup key (null for manual)
  vendor?: string,          // merchant name if known
  currency: string,         // 'usd' by default
  is_reviewed: boolean,     // false = in review queue
  is_reconciled: boolean,   // true = matched with reconciled counterpart
  reconciled_with?: uuid,   // id of the matched transaction
  raw_metadata?: object,    // full provider payload (Stripe charge, Plaid txn, etc.)
  notes?: string,
  created_by?: uuid,        // user_id for manual entries
  revenue_type?: 'recurring' | 'one_time' | 'project' | 'milestone',  // income classification
  project_id?: uuid,        // optional link to a project row
  created_at: timestamp,
  deleted_at?: timestamp    // null = active; non-null = soft deleted (manual/invoice only)
}
```

Amount is always positive. A $500 expense is `{type: 'expense', amount: 500}` — not `{amount: -500}`.

### Revenue Type

`revenue_type` classifies income transactions for multi-model analytics:

| Value | Meaning | Auto-assigned from category |
|-------|---------|----------------------------|
| `recurring` | Subscription, MRR | "Subscription Revenue" |
| `one_time` | One-off sale or service | "One-time Revenue", "Service Revenue", "Refund Received" |
| `project` | Project- or contract-based | "Project Revenue", "Contract Revenue", "Consulting" |
| `milestone` | Milestone payment on a project | "Milestone Payment" |
| `null` | Not yet classified | (fallback for unknown categories) |

`revenue_type` is auto-set by the categorization engine when a category is assigned. Users can correct the category → `revenue_type` is updated accordingly. It is only set on `type = 'income'` transactions.

### Project Links

`project_id` (nullable FK → `projects.id`) optionally links a transaction to a project. This enables project-level P&L: collected revenue, expenses, and outstanding balance per project. Linking is done via the Projects page.

---

## How Transactions Are Created

### From Integrations (Stripe, Plaid, PayPal, Shopify)

Each sync function in `lib/sync/` follows this pattern:
1. Fetch data from the provider API
2. Check `source_ref_id` for existing row (skip if found)
3. Call `categorize(description, type, orgId)` for new rows
4. Insert with `is_reviewed = false`, `source = '<provider>'`

See [data-sync.md](./data-sync.md) for provider-specific details and [deduplication.md](./deduplication.md) for how duplicates are caught.

### From CSV / XLSX Import

- Column mapping determines `amount`, `type`, `description`, `date`
- If no category column mapped → `categorize()` is called
- `source = 'csv'`, `source_ref_id = '{importId}_{rowIndex}'`
- `is_reviewed = false`

See [csv-import.md](./csv-import.md) for the full import workflow.

### Manual Entry (via UI or AI Chat)

**Via Add Expense / Add Income modals:**
- `POST /api/transactions` with body `{type, amount, description, date, category, notes}`
- If category provided by user → `is_reviewed = true`, `category_method = 'user'`
- If no category → `categorize()` called, `is_reviewed = false`
- `source = 'manual'`

**Via AI Chat confirm:**
- `POST /api/chat/confirm` creates the transaction after user confirmation
- Always `is_reviewed = true` (user explicitly confirmed via chat)
- `source = 'manual'`

### From Invoice Payment

When an invoice is marked Paid (`PATCH /api/invoices` with `status = 'paid'`):
- An income transaction is auto-created
- `source = 'invoice'`, `category = 'Consulting Revenue'`, `is_reviewed = true`
- Description includes the invoice number

---

## Transaction API

**File:** [app/api/transactions/route.ts](../../app/api/transactions/route.ts)

### GET /api/transactions

Supports filtering by: `type`, `category`, `is_reviewed`, `source`, `date_from`, `date_to`  
Pagination: `limit` (max 500), `offset`  
Order: `date DESC, created_at DESC`  
Cache headers: 30s max-age, 60s stale-while-revalidate

### POST /api/transactions

Creates a manual transaction. If no `category` provided, runs through the full 3-layer categorization engine.

### PATCH /api/transactions

Updates `category`, `is_reviewed`, `notes`, `vendor`, or `project_id`. When category changes:
- Sets `category_method = 'user'`, `category_confidence = 'high'`
- Calls `saveOverride(orgId, description, category)` to persist the correction for future auto-categorization

`project_id` accepts a UUID (to link) or `null` (to unlink). Setting it updates the linked project's collected/expense totals immediately — the Projects page reads these live from `GET /api/projects?totals=true`.

---

## Review Queue — notification only, not a gate

**Key design principle:** `is_reviewed` is a UI signal, not a data filter. Every transaction — regardless of `is_reviewed` or category confidence — is included in all calculations (dashboard, revenue analytics, P&L, forecast) immediately after it is created.

The review queue exists so users can correct poor categorizations. It does not hold transactions out of the financial picture.

### What `is_reviewed = false` means

A transaction starts unreviewed (`is_reviewed = false`) when:
- It came from an integration sync (Stripe, Plaid, PayPal, Shopify, QuickBooks)
- It came from a CSV import without a mapped category column
- It was created manually without a category specified

It starts reviewed (`is_reviewed = true`) when:
- The user specified a category during manual entry
- The AI Chat created it (user explicitly confirmed the action)
- It was created from an invoice payment
- The user clicks "Done" or edits the category in the review UI

### Categorization on unreviewed transactions

All transactions — even those with `is_reviewed = false` — have a category. The categorization engine always assigns one:

- **Rule or override match** → correct category, `confidence = 'high'`
- **AI fallback** → best guess from the allowed list, `confidence = 'low'`, flagged with ⚠
- **AI failure** → "Other Income" or "Other Expense", `confidence = 'low'`, flagged with ⚠

There is no "uncategorized" state. Every transaction has a category and participates in calculations. Low-confidence transactions show a warning badge so users know to verify them.

### Notification banner

The Transactions page shows a banner when there are unreviewed transactions:

> ⚠ **22 transactions need review** — categories were guessed automatically. Review them to improve accuracy.

The count comes from `GET /api/transactions?is_reviewed=false&limit=1` (just the count, not the full list). Clicking the banner scrolls to the review section.

### The review UI

**File:** [app/(dashboard)/transactions/page.tsx](../../app/(dashboard)/transactions/page.tsx)

The Transactions page has two sections:

**Review section (top, collapsible):**
- Visible only when unreviewed transactions exist
- Low-confidence AI guesses sorted first
- Each row shows: description, date, amount, ⚠ badge for low confidence, category dropdown
- "Done" button → PATCH `{is_reviewed: true}` with whatever category is selected
- Bulk mark-as-reviewed available

**Transaction table (below):**
- All transactions — reviewed and unreviewed together
- Unreviewed rows show a subtle ⚠ icon next to their category
- Category dropdown always editable inline → PATCH immediately

Both sections load from `GET /api/transactions?limit=200` on page mount.

---

## Soft delete (manual records only)

Users can delete transactions they created manually. Imported transactions are not individually deletable.

### What can be deleted

| Source | Deletable? |
|---|---|
| `manual` | Yes — user created it |
| `invoice` | Yes — user created the invoice |
| `stripe`, `plaid`, `paypal`, `shopify`, `quickbooks`, `csv` | No — use the integration disconnect flow to remove imported data |

### Soft delete mechanics

Deletion sets `deleted_at = NOW()` on the row. The row is never physically removed.

All queries that serve UI and calculations filter `WHERE deleted_at IS NULL`. Soft-deleted rows are invisible to users but remain in the database for audit purposes.

**Endpoint:** `DELETE /api/transactions/:id` — returns 403 if the transaction's source is not `manual` or `invoice`.

---

## Integration disconnect — data retention policy

When a user disconnects an integration (e.g. QuickBooks), the default behavior is to **retain** all previously imported data. This preserves historical records, P&L history, and reconciliation state.

### At disconnect time

The UI presents an explicit choice:

> **Remove QuickBooks data?**  
> Your imported transactions, income, and expenses from QuickBooks will remain in Finvio. This preserves your historical records.  
> [ Keep imported data ] (default)  [ Remove imported data ]

Choosing **Remove imported data** soft-deletes all transactions where `source = 'quickbooks'` (or the relevant provider) and `org_id = <this org>`. The connection row in `connections` is set to `status = 'disconnected'` in both cases.

### Why keep by default

- Accounting history should never disappear automatically
- Users may reconnect later and need continuity
- Removing imported data can silently break P&L reports, investor updates, and scenario models that reference historical periods
- If data were deleted automatically on disconnect, a mis-click would destroy months of accounting history

---

## Calculating Totals

All transactions — reviewed and unreviewed, high and low confidence — are included in totals. The only exclusion is soft-deleted rows (`deleted_at IS NOT NULL`).

The Transactions page computes totals client-side from the fetched list:

```typescript
const totalIncome = transactions
  .filter(t => t.type === 'income')
  .reduce((sum, t) => sum + t.amount, 0)

const totalExpenses = transactions
  .filter(t => t.type === 'expense')
  .reduce((sum, t) => sum + t.amount, 0)

const net = totalIncome - totalExpenses
```

These appear in three summary cards at the top of the page. Dashboard, revenue analytics, P&L, and forecast pages use the same unfiltered dataset (excluding soft-deleted rows).

---

## Source Badges

The source column in the transaction table shows colored badges:

| Source | Badge |
|--------|-------|
| `stripe` | Blue |
| `plaid` | Purple |
| `paypal` | Indigo |
| `shopify` | Green |
| `csv` | Orange |
| `manual` | Gray |
| `invoice` | Teal |

---

## Filters

The Transactions page has a type filter (All / Income / Expense) that rerenders the table client-side — no new API call needed since all transactions are already fetched.

**Project assignment column:** The reviewed transactions table and the review queue both include a "Project" dropdown. Selecting a project immediately PATCHes the transaction with `project_id`, which updates the project's collected/expense totals on the Projects page. The dropdown only shows active projects. "—" means no project linked.

Planned: date range filter, category filter. These are passed as query params to `GET /api/transactions` when set.

---

## Raw Metadata

All synced transactions store the full provider payload in `raw_metadata` (JSONB). This means you can always look back at exactly what the provider returned, without needing to re-fetch from the API. Useful for debugging categorization, reconciliation, or amount discrepancies.

Manual and invoice-created transactions have `raw_metadata = null`.
