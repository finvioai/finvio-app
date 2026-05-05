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

---

## POST /api/chat/transcribe

Fallback speech-to-text endpoint used when the browser does not support the Web Speech API, or when the browser is Brave (which exposes `webkitSpeechRecognition` but silently blocks it). Accepts an audio recording and returns a transcript via OpenAI Whisper.

> **Primary path**: Chrome/Safari/Edge (non-Brave) use the browser's built-in `SpeechRecognition` API directly — no server call needed, no cost. This endpoint is hit on Firefox, Brave, and any other browser without a working Web Speech API.
>
> **Brave detection**: On mount, the client calls `navigator.brave.isBrave()` (Brave's own async API). If it resolves `true`, the Web Speech path is skipped and this endpoint is used instead, regardless of whether `webkitSpeechRecognition` appears to be available.

### Request

`Content-Type: multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `audio` | File | Required. Audio recording blob. |

### Accepted audio types

`audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/x-m4a`

### Constraints

- Maximum file size: **24 MB** (Whisper limit is 25 MB)
- Uses OpenAI Whisper `whisper-1` model
- Requires `OPENAI_API_KEY` environment variable (already used for chat)

### Response `200`

```json
{ "text": "Add a five hundred dollar AWS expense for today" }
```

### Error responses

| Status | Meaning |
|---|---|
| 400 | No audio file provided |
| 401 | Unauthenticated |
| 413 | File exceeds 24 MB |
| 415 | Unsupported audio MIME type |
| 503 | `OPENAI_API_KEY` not configured |
| 500 | Whisper transcription error |

### Privacy

Audio is sent to OpenAI Whisper for transcription only. **No audio is stored by Finvio.** For the primary Web Speech API path, audio is processed entirely by the browser's cloud engine (Google/Apple) and never reaches Finvio servers.
