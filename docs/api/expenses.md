# API — Expenses

## GET /api/expenses

List expense reports for the org.

### Query params

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter: `pending` \| `approved` \| `rejected` |
| `limit` | integer | Default 100, max 500 |
| `offset` | integer | |

---

## POST /api/expenses

Submit an expense report.

### Request body

```json
{
  "title": "Team lunch",
  "amount": 240.00,
  "category": "Meals & Entertainment",
  "date": "2026-05-02",
  "notes": "Sales team Q2 kickoff",
  "submitter_name": "Jane Smith"
}
```

Required: `title`, `amount`, `category`, `date`. Created with status `pending`.

---

## PATCH /api/expenses

Approve or reject an expense. **Requires owner or admin role.**

### Request body

```json
{
  "id": "uuid",
  "action": "approve",
  "notes": "Approved for Q2 budget"
}
```

`action`: `approve` \| `reject`

### Side effects

| Action | Side effect |
|---|---|
| `approve` | Creates expense transaction in ledger; links `transaction_id` back to expense report; writes audit log |
| `reject` | Updates status to `rejected`; writes audit log |

Only `pending` expenses can be approved or rejected. Attempting to approve an already-approved expense returns HTTP 400.
