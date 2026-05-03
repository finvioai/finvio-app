# API — Transactions

## GET /api/transactions

List transactions for the authenticated user's org.

### Query params

| Param | Type | Description |
|---|---|---|
| `type` | string | Filter by `income` or `expense` |
| `category` | string | Filter by category |
| `source` | string | Filter by source (`stripe`, `plaid`, `manual`, etc.) |
| `is_reviewed` | boolean | Filter by review status |
| `date_from` | date | ISO date — start of range |
| `date_to` | date | ISO date — end of range |
| `limit` | integer | Max records (default 100, max 500) |
| `offset` | integer | Pagination offset |

### Response

```json
{
  "transactions": [ { ...transaction } ],
  "count": 42
}
```

---

## POST /api/transactions

Create a transaction manually.

### Request body

```json
{
  "type": "expense",
  "amount": 150.00,
  "description": "AWS monthly bill",
  "date": "2026-05-01",
  "category": "Infrastructure",
  "source": "manual",
  "notes": "us-east-1 region"
}
```

Required: `type`, `amount`, `description`, `date`. `source` defaults to `manual`.

Auto-categorization runs if `category` is omitted — uses 3-layer engine (org overrides → rules → AI).

### Response

```json
{ "transaction": { ...transaction } }
```

Status: 201 Created.

---

## PATCH /api/transactions

Update a transaction's category or review status.

### Request body

```json
{
  "id": "uuid",
  "category": "Software",
  "is_reviewed": true,
  "notes": "optional"
}
```

Required: `id`. When `category` is updated, a `category_overrides` record is created so future similar transactions auto-categorize the same way.

### Response

```json
{ "transaction": { ...updated } }
```
