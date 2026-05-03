# Invoices — Lifecycle and Workflow

Invoices in Finvio track money owed to your organization. When an invoice is marked paid, it automatically creates an income transaction in the ledger.

---

## Invoice States

```
draft ──► sent ──► paid
  │                  
  └──────────────► cancelled
  
sent ──► overdue (automatic, via daily cron)
```

| Status | Meaning |
|--------|---------|
| `draft` | Created but not sent to customer |
| `sent` | Delivered to customer, awaiting payment |
| `overdue` | Past `due_date`, not yet paid |
| `paid` | Payment received |
| `cancelled` | Invoice voided |

---

## Creating an Invoice

**Via UI:** New Invoice button on `/invoices` page → modal form  
**Via AI Chat:** "Create an invoice for Acme Corp for $5,000 due in 30 days" → confirmation card → confirm

**API:** `POST /api/invoices`

```typescript
{
  customer_name: string,
  amount: number,
  due_date: string,          // ISO date
  invoice_date?: string,     // defaults to today
  notes?: string,
  line_items?: LineItem[]    // optional JSON array
}
```

**Invoice number generation:**

```typescript
function generateInvoiceNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'INV-'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
```

Retries up to 5 times in case of collision (extremely unlikely with 36^8 = ~2.8 trillion combinations). The invoice number is stored and displayed to the customer on the invoice PDF.

All creates are audit-logged with `entity_type = 'invoice'`, `action = 'created'`.

---

## Invoice Line Items

`line_items` is a JSONB array, each item:
```typescript
{
  description: string,
  quantity: number,
  unit_price: number,
  amount: number   // quantity × unit_price
}
```

The `amount` column on the invoice itself stores the total (sum of all line items or a flat amount if no line items provided).

---

## Status Transitions

**Sent:** `PATCH /api/invoices` with `{status: 'sent'}` — manual action by user

**Paid:** `PATCH /api/invoices` with `{status: 'paid'}`

When paid, the API automatically creates an income transaction:
```typescript
await supabase.from('transactions').insert({
  org_id,
  type: 'income',
  amount: invoice.amount,
  description: `Invoice ${invoice.invoice_number} — ${invoice.customer_name}`,
  date: today,
  category: 'Consulting Revenue',
  category_method: 'rule',
  category_confidence: 'high',
  source: 'invoice',
  is_reviewed: true,
  notes: `Auto-created from invoice ${invoice.invoice_number}`,
})
```

This is the mechanism that keeps invoices and the financial ledger in sync — you don't need to manually add income after marking an invoice paid.

**Overdue:** Automatic via daily cron. Any invoice with `status = 'sent'` and `due_date < today` is updated to `status = 'overdue'`.

---

## Invoice API

**File:** [app/api/invoices/route.ts](../../app/api/invoices/route.ts)

### GET /api/invoices

Query params: `status`, `limit` (max 500), `offset`  
Order: `created_at DESC`

### POST /api/invoices

Creates invoice with auto-generated invoice number. Writes audit log.

### PATCH /api/invoices

Updates `status`, `notes`, `due_date`. On `status = 'paid'`: sets `paid_at = now()` and creates income transaction.

---

## Status Badge Colors

| Status | Color |
|--------|-------|
| draft | Gray |
| sent | Blue |
| overdue | Red |
| paid | Green |
| cancelled | Gray |

---

## PDF Export

Invoices can be exported as PDF using react-pdf or jsPDF. The PDF template includes:
- Invoice number and date
- Customer name
- Line items table (if provided) or flat amount
- Due date
- Notes
- Company name from organization settings

---

## Audit Trail

Every invoice state transition writes to `audit_log`:

```typescript
writeAuditLog({
  orgId,
  userId,
  entityType: 'invoice',
  entityId: invoice.id,
  action: 'status_changed',
  beforeState: { status: 'sent' },
  afterState: { status: 'paid' },
})
```

The full before/after state is stored so you can reconstruct exactly what changed and when.
