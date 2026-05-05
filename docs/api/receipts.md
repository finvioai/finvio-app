# API — Receipts

## POST /api/receipts

Upload a receipt or bill file (PDF or image) to Supabase Storage. Returns a public URL that can be attached to an expense via the `receipt_url` field.

### Request

`Content-Type: multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | File | Required. PDF or image file. |

### Accepted file types

`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`

### Constraints

- Maximum file size: **10 MB**
- Files are stored at `{org_id}/{uuid}.{ext}` in the `expense-receipts` Supabase Storage bucket
- RLS policies ensure users can only upload to their own org's folder

### Response `201`

```json
{
  "receipt_url": "https://...supabase.co/storage/v1/object/public/expense-receipts/..."
}
```

### Error responses

| Status | Meaning |
|---|---|
| 400 | No file provided or invalid form data |
| 401 | Unauthenticated |
| 413 | File exceeds 10 MB |
| 415 | Unsupported MIME type |
| 500 | Storage upload failed |

### Usage

Upload the file first, then pass the returned `receipt_url` when creating an expense:

```js
// 1. Upload file
const fd = new FormData()
fd.append('file', file)
const { receipt_url } = await fetch('/api/receipts', { method: 'POST', body: fd }).then(r => r.json())

// 2. Create expense with receipt attached
await fetch('/api/expenses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title, amount, category, date, receipt_url }),
})
```

The same `receipt_url` field is also accepted by `POST /api/transactions` (for direct transaction creation) and `POST /api/chat/confirm` (for AI Advisor expense confirmations).
