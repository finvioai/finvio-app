# Audit Logging

Finvio maintains an audit trail of all write actions in the `audit_log` table. This lets you see who changed what, when, and from where.

---

## File

[lib/audit.ts](../../lib/audit.ts)

---

## What Gets Logged

| Action | Triggered by |
|--------|-------------|
| Invoice created | `POST /api/invoices` |
| Invoice status changed | `PATCH /api/invoices` |
| Expense approved / rejected | Expense approval flow |
| Transaction category changed | `PATCH /api/transactions` |
| AI write action confirmed | `POST /api/chat/confirm` |
| Connection established | Connection routes (Stripe, Plaid, etc.) |
| Connection disconnected | DELETE connection routes |

---

## Audit Log Schema

```typescript
{
  id: uuid,
  org_id: uuid,
  user_id: uuid,
  entity_type: string,    // 'invoice', 'transaction', 'expense', 'connection'
  entity_id: uuid,        // ID of the affected record
  action: string,         // 'created', 'status_changed', 'category_changed', etc.
  before_state: object,   // snapshot of record before change (null for creates)
  after_state: object,    // snapshot of record after change
  ip_address: string,     // from x-forwarded-for header
  user_agent: string,     // browser/client user agent
  created_at: timestamp
}
```

---

## How It Works

```typescript
await writeAuditLog({
  orgId: member.org_id,
  userId: user.id,
  entityType: 'invoice',
  entityId: invoice.id,
  action: 'status_changed',
  beforeState: { status: 'sent' },
  afterState: { status: 'paid' },
  request,  // NextRequest — used to extract IP and user agent
})
```

The `before_state` and `after_state` are plain objects — typically a subset of the changed record's fields rather than the full row. This keeps log entries readable without storing redundant data.

For create actions, `before_state` is `null`. For delete/disconnect actions, `after_state` records the final state.

---

## IP Extraction

```typescript
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
         ?? request.headers.get('x-real-ip')
         ?? 'unknown'
```

`x-forwarded-for` can contain a comma-separated list when the request passes through multiple proxies. The first IP in the list is the original client IP.

---

## Reading the Audit Log

The audit log is visible in the Supabase dashboard under the `audit_log` table. There is no UI for browsing it in Finvio itself — it's primarily for compliance and debugging.

RLS policy: users can only read audit log rows for their own organization.

---

## What's Not Logged

- Read operations (GET requests)
- Sync operations (too high volume; sync_logs handles those)
- Auth events (handled by Supabase Auth built-in logging)
- Failed/rejected requests (only successful writes are logged)
