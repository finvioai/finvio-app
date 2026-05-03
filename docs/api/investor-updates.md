# API — Investor Updates

## GET /api/investor-updates

List all saved investor updates for the org, ordered newest first.

### Response

```json
{
  "updates": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "month": "2026-05-01",
      "period": "May 2026",
      "content": "## May 2026 Update\n\nMRR grew 12% this month...",
      "created_at": "2026-05-03T10:00:00Z"
    }
  ]
}
```

---

## POST /api/investor-updates

Generate an AI draft or save an existing draft.

### Generate (no body or empty body)

```json
{}
```

The server fetches live dashboard metrics, injects them into an LLM system prompt, and returns a generated draft. The draft is **not** saved automatically.

### Save (provide content)

```json
{
  "content": "## May 2026 Update\n\nMRR: $12,500...",
  "month": "2026-05-01",
  "period": "May 2026"
}
```

Required when saving: `content`, `month` (ISO first-of-month), `period` (display string).

### Response (generate)

```json
{
  "update": {
    "content": "## May 2026\n\n**MRR**: $12,500 (+12% MoM)...",
    "month": "2026-05-01",
    "period": "May 2026"
  }
}
```

### Response (save)

```json
{
  "update": { ...saved investor_updates row }
}
```

Status: 201 Created on save.
