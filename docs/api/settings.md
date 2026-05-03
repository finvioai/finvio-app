# API — Settings

## GET /api/settings

Returns the org settings and user AI model preferences.

### Response

```json
{
  "org": {
    "id": "uuid",
    "name": "Acme Inc.",
    "currency": "USD",
    "fiscal_year_start": 1,
    "industry": "SaaS"
  },
  "userSettings": {
    "llm_provider": "openai",
    "llm_model": "gpt-4o"
  },
  "role": "owner"
}
```

---

## PATCH /api/settings

Update org settings and/or user AI model preferences in one request.

### Request body

```json
{
  "org": {
    "name": "Acme Corp",
    "currency": "EUR",
    "fiscal_year_start": 4
  },
  "userSettings": {
    "llm_provider": "anthropic",
    "llm_model": "claude-sonnet-4-6"
  }
}
```

Both `org` and `userSettings` are optional — send only the fields you want to change.

Org fields can only be changed by users with `owner` or `admin` role. Attempting to update org fields as a `member` silently skips the org update (no error, but no change either).

### Validation

- `currency`: exactly 3 characters (ISO 4217)
- `fiscal_year_start`: integer 1–12
- `llm_provider`: any string (validated against UI options client-side)
- `llm_model`: any string

### Response

```json
{ "ok": true }
```
