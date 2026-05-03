# API — Chat

## POST /api/chat

Send a message to the AI advisor. Returns a response and optionally a `pendingAction` for write flows.

### Request body

```json
{
  "message": "What's my burn rate?",
  "sessionId": "uuid (optional — omit to start new session)"
}
```

### Response

```json
{
  "message": "Your average monthly burn rate over the past 3 months is $12,400...",
  "sessionId": "uuid",
  "intent": "query_burn",
  "pendingAction": null
}
```

For write intents (create_expense, create_invoice, add_income):

```json
{
  "message": "I'll create a $500 expense for AWS. Please confirm:",
  "sessionId": "uuid",
  "intent": "create_expense",
  "pendingAction": {
    "type": "create_expense",
    "params": {
      "title": "AWS monthly bill",
      "amount": 500,
      "category": "Infrastructure",
      "date": "2026-05-01"
    }
  }
}
```

### Rate limit

30 requests per minute per user. Returns HTTP 429 if exceeded.

---

## POST /api/chat/confirm

Execute a confirmed write action from a `pendingAction` returned by `/api/chat`.

### Request body

```json
{
  "action": {
    "type": "create_expense",
    "params": {
      "title": "AWS monthly bill",
      "amount": 500,
      "category": "Infrastructure",
      "date": "2026-05-01"
    }
  },
  "sessionId": "uuid"
}
```

### Supported action types

| type | Effect |
|---|---|
| `create_expense` | Inserts expense transaction, audit log |
| `create_invoice` | Inserts draft invoice, audit log |
| `add_income` | Inserts income transaction, audit log |

### Response

```json
{ "success": true, "id": "uuid-of-created-record" }
```

### Security

LLM output is **never** executed directly. The `pendingAction` is returned to the client, shown in a confirmation card, and only executed after explicit user confirmation via this endpoint. All parameters are re-validated server-side on confirm.
