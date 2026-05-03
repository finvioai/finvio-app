# API — Invoices

## GET /api/invoices

List invoices for the org.

### Query params

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter: `draft` \| `sent` \| `paid` \| `overdue` \| `cancelled` |
| `limit` | integer | Default 100, max 500 |
| `offset` | integer | |

---

## POST /api/invoices

Create a draft invoice.

### Request body

```json
{
  "customer_name": "Acme Corp",
  "customer_email": "billing@acme.com",
  "amount": 5000,
  "due_date": "2026-06-01",
  "invoice_date": "2026-05-01",
  "notes": "Net 30",
  "line_items": [
    { "description": "Platform fee", "quantity": 1, "unit_price": 5000, "amount": 5000 }
  ]
}
```

Required: `customer_name`, `amount`. Invoice number is auto-generated (`INV-XXXXXXXX`).

---

## PATCH /api/invoices

Update invoice status or metadata.

### Request body

```json
{
  "id": "uuid",
  "status": "paid",
  "notes": "optional",
  "due_date": "2026-06-15"
}
```

### Status transitions

| From | To | Side effect |
|---|---|---|
| `draft` | `sent` | — |
| `sent` | `paid` | Auto-creates income transaction; sets `paid_at` |
| `sent` | `overdue` | Set by cron daily (not via this endpoint directly) |
| any | `cancelled` | — |

Marking an already-paid invoice as paid returns HTTP 400.

All status changes write an audit log entry.
