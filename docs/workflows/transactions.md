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
  created_at: timestamp
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

## The Review Queue

### What Goes In

Every transaction with `is_reviewed = false` is in the review queue. This covers:
- All synced transactions (Stripe, Plaid, PayPal, Shopify)
- CSV imports without a category column
- Manual entries where no category was specified

### What Gets Auto-Approved

- Manual entries where the user specified a category
- AI Chat-created transactions (user explicitly confirmed)
- Invoice-created income transactions

### The Review UI

**File:** [app/(dashboard)/transactions/page.tsx](../../app/(dashboard)/transactions/page.tsx)

The Transactions page has two sections:

**Review Queue (top):**
- Yellow-highlighted rows with `is_reviewed = false`
- Sorted by confidence (low confidence AI guesses first)
- Each row shows: description, date, amount, confidence badge, category dropdown
- "Done" button → PATCH `{is_reviewed: true}` (with whatever category is selected)
- Bulk categorization available

**Transaction Table (bottom):**
- All reviewed transactions in a standard table
- Columns: date, description, category (editable dropdown), source badge, amount
- Clicking category dropdown → PATCH immediately

Both sections load from `GET /api/transactions?limit=200` on page mount.

---

## Calculating Totals

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

These appear in three summary cards at the top of the page.

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
