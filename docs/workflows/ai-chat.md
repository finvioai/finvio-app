# AI Advisor Chat

The AI Advisor is Finvio's primary differentiator. It answers financial questions using real data from the database and can create expenses, invoices, and income entries through a confirmation flow.

## Architecture Overview

```
User message
    │
    ▼
POST /api/chat
    ├── Rate limit check (30 req/min)
    ├── Intent detection
    ├── READ path: fetch metrics → inject into system prompt → call LLM
    └── WRITE path: extract params → validate → return pendingAction (not executed yet)
    │
    ▼
Frontend shows response
    └── If pendingAction → show ConfirmationCard
              │
              ▼ (user confirms)
         POST /api/chat/confirm
              └── Execute DB write + audit log
```

**Key design principle:** Write actions (creating expenses, invoices, income) are never executed directly. The API always returns a `pendingAction` object. The frontend shows a confirmation card. Only after the user clicks Confirm does `/api/chat/confirm` execute the actual insert.

---

## Intent Detection

**File:** [lib/llm/intent.ts](../../lib/llm/intent.ts)

Every incoming message is classified into one of these intents before any LLM call for the actual response:

| Intent | Example triggers |
|--------|-----------------|
| `query_runway` | "runway", "months left", "how long" |
| `query_mrr` | "MRR", "monthly recurring revenue" — explicit only |
| `query_burn` | "burn rate", "spending", "monthly expenses" |
| `query_pnl` | "profit", "loss", "P&L", "net income" |
| `query_forecast` | "forecast", "projection", "next N months" |
| `query_customers` | "customers", "churn", "active users", "ARPU" |
| `query_revenue` | "revenue", "how much did I make", "total revenue", "monthly income" |
| `query_profit` | "profit", "gross margin", "how profitable" |
| `query_project` | "project status", "billable", "WIP", "work in progress" |
| `create_expense` | "add expense", "log expense", "record expense" |
| `create_invoice` | "create invoice", "new invoice", "send invoice" |
| `add_income` | "add income", "log revenue", "record payment" |
| `unknown` | anything else |

**Important routing distinction:** `query_mrr` only fires when the message contains "MRR", "monthly recurring", or "recurring revenue" explicitly. Generic revenue questions ("what's my revenue?" / "how much did I make?") route to `query_revenue` instead, which uses total revenue including one-time and project income — more appropriate for SMB and project-based businesses.

**Detection process:**
1. Regex patterns are tested against the message (fast, free)
2. If no pattern matches, a lightweight LLM call extracts the intent using structured output
3. If LLM also cannot determine intent → `unknown`

The `unknown` intent still hits the LLM but without specific financial context injected — it answers based on whatever it knows from the conversation.

---

## READ Path (Answering Questions)

For query intents, the system fetches exactly the metrics needed for that question — no more.

**Context fetched per intent:**

| Intent | Data fetched |
|--------|-------------|
| `query_runway` | runway_months, cash_balance, net_burn_per_month, burn_rate |
| `query_mrr` | mrr, arr, mrr_trend (6 months) |
| `query_burn` | burn_rate, net_burn, mrr |
| `query_pnl` | full P&L object (revenue lines, expense lines, net) |
| `query_forecast` | 6-month forecast at 5% monthly growth |
| `query_customers` | active_customers, churn_rate |
| `query_revenue` | total_revenue_this_month, revenue_by_type (recurring/one_time/project/milestone) |
| `query_profit` | gross_profit_this_month, total_revenue_this_month |
| `query_project` | projects array with collected, expenses, outstanding per project |
| `unknown` | snapshot of mrr, cash, runway, data_completeness |

All data is fetched from the database via `lib/metrics/index.ts` — the LLM never queries the DB directly.

Every intent also includes `businessModel` (derived from `inferBusinessModel()`) in the context JSON.

**System prompt structure:**

```
You are Finvio, an AI financial advisor.

{model-specific guidance paragraph}

You have access to the following verified financial data:
{context JSON — exact numbers from the database, always includes businessModel}

Today's date: {date}

Rules:
- Use ONLY the numbers above. Never invent or calculate your own numbers.
- If data warnings exist, mention them briefly.
- Be concise and actionable — 2-5 sentences max unless a table is needed.
- Format currency as $X,XXX.
- If asked about something not in the context, say the data isn't available yet.
```

**Business model guidance paragraphs** (injected based on `businessModel`):

| Model | Guidance injected |
|-------|------------------|
| `saas` | "This is a SaaS business. Focus on MRR, ARR, runway, and churn. Use SaaS terminology naturally." |
| `smb` | "This is a small business with non-recurring revenue. Focus on total revenue, gross profit, and cash flow. Avoid MRR framing unless explicitly asked." |
| `project_based` | "This business earns revenue project-by-project. Focus on project margins, billing, and cash collection rather than recurring metrics." |
| `mixed` | "This business has both recurring and one-time revenue streams. Address both dimensions when relevant." |

The injected context looks like:
```json
{
  "runway_months": 8,
  "cash_balance": 124000,
  "net_burn_per_month": 15500,
  "burn_rate": 18200,
  "businessModel": "saas",
  "data_warnings": ["Bank account not connected — cash balance is estimated from transactions"]
}
```

The LLM then responds as a financial advisor interpreting those specific numbers in the appropriate business model framing.

---

## WRITE Path (Creating Transactions / Invoices)

For write intents, the LLM extracts structured parameters from the user's message:

**For `create_expense`:**
```typescript
{
  amount: number,                                              // validated > 0
  description: string,
  category: string,                                            // must be in EXPENSE_CATEGORIES
  date: string,                                                // ISO date, defaults to today
  recurrence?: 'monthly' | 'quarterly' | 'annual' | 'one_time', // affects burn rate calculation
  notes?: string
}
```

**For `create_invoice`:**
```typescript
{
  customer_name: string,
  amount: number,
  due_date: string,
  notes?: string
}
```

**For `add_income`:**
```typescript
{
  amount: number,
  description: string,
  category: string,      // must be in allowed income categories
  date: string,
  source?: string,
  project_id?: string,   // set by user in confirmation card (optional)
  project_name?: string  // display name, resolved client-side
}
```

After extraction, Zod validates the params (amount must be positive, date must parse, category must exist in the allowed list). If validation fails, the assistant asks for clarification instead of returning a pending action.

The API response includes:
```json
{
  "message": "I'll create a $500 expense for Vercel (Software & SaaS) for today. Confirm?",
  "pendingAction": {
    "type": "create_expense",
    "params": { "amount": 500, "description": "Vercel", "category": "Software & SaaS", "date": "2026-05-03" }
  }
}
```

---

## Confirmation Flow

When the frontend receives a `pendingAction`, it renders a `ConfirmationCard` in the chat bubble showing all action details. The user has two options:

- **Confirm** → `POST /api/chat/confirm` with `{action, sessionId}`
- **Cancel** → The pending action is discarded, a cancellation message is shown

**Editable fields in the card:** The AI pre-fills category and recurrence from what it extracted. The user can correct them before confirming without having to retype the message.

| Action | Editable in card | Read-only in card |
|--------|-----------------|-------------------|
| `create_expense` | Category (dropdown), Recurrence (dropdown) | Title, Amount, Date, Notes |
| `add_income` | Category (dropdown), Project link (picker) | Description, Amount, Date, Source |
| `create_invoice` | None | Customer, Amount, Due Date, Notes |

On confirmation, `/api/chat/confirm` merges any user overrides with the AI-extracted params before executing the DB write:

| Action type | What happens |
|------------|-------------|
| `create_expense` | INSERT into `transactions` (type='expense', source='manual', is_reviewed=true, recurrence from card) |
| `create_invoice` | INSERT into `invoices` (status='draft', unique INV-XXXXXXXX number generated) |
| `add_income` | INSERT into `transactions` (type='income', source='manual', is_reviewed=true, project_id if selected) |

**Project linking for income:** The `add_income` confirmation card fetches the org's active projects from `GET /api/projects` and renders an optional "Link to project" dropdown. If the user selects a project before confirming, `project_id` is included in the transaction insert, and the project's collected/outstanding totals update automatically.

After execution, `writeAuditLog()` records who created what and when. A confirmation message is stored in the session's chat history.

---

## Chat Sessions

Each conversation belongs to a `chat_sessions` row. Sessions are created on first message if no `sessionId` is provided, and the returned `sessionId` is reused for all subsequent messages in the conversation.

The last 10 messages of a session are injected into the LLM call as conversation history, giving the AI short-term memory within a session.

**Session persistence:** The active `sessionId` is stored in `localStorage` under the key `finvio_chat_session_id`. Navigating away from the advisor page and returning restores the last session automatically — messages are re-fetched from `GET /api/chat/sessions/[id]/messages`.

**Session history sidebar:** The advisor page shows a sidebar listing the 30 most recent sessions (title + relative time). Clicking a session loads its message history. The "New chat" button clears the active session and removes the localStorage entry, starting fresh. Each session row has a delete (trash) icon on hover — clicking it calls `DELETE /api/chat/sessions/[id]` and removes the session and all its messages. If the deleted session is currently active, the chat resets to a new session.

**Session list API:** `GET /api/chat/sessions` returns sessions ordered by `updated_at DESC`. `GET /api/chat/sessions/[id]/messages` returns all messages for a session ordered by `created_at ASC`.

---

## Scenarios in the Chat

The Scenarios page (`/scenarios`) is a separate UI, but the chat can answer scenario-like questions. When a user asks "what if we hired 2 more engineers?" the `unknown` intent flows through and the LLM responds in a qualitative advisory tone since no structured scenario data is injected.

For quantitative scenarios with before/after projections, the Scenarios page provides dedicated sliders that call `getForecast()` directly.

---

## Rate Limiting

The chat route counts messages in `chat_messages` within the last minute for the current user. If the count exceeds 30, the request is rejected with a 429 response. This is a DB-query-based limiter that works without Redis or an external service.

---

## LLM Adapters

**File:** [lib/llm/adapter.ts](../../lib/llm/adapter.ts)

Both OpenAI and Anthropic are supported via a common interface:

```typescript
interface LLMAdapter {
  chat(messages: ChatMessagePayload[], systemPrompt: string): Promise<string>
  extractStructuredOutput<T>(prompt: string, schema: object): Promise<T>
}
```

The adapter is selected by `getLLMAdapter(provider, model)` based on `DEFAULT_LLM_PROVIDER` and `DEFAULT_LLM_MODEL` env vars. API keys come from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — users never enter keys.

| Provider | Chat settings | Structured output |
|---------|--------------|------------------|
| OpenAI | temp=0.3, max_tokens=1024 | JSON mode, temp=0, max_tokens=512 |
| Anthropic | max_tokens=1024 | Parses JSON from response, strips backticks |

---

## Data Warning Banner

If `data_completeness.warnings` contains entries, the chat UI shows a yellow warning banner above the input ("Your data may be incomplete: Bank account not connected"). This prevents users from trusting AI answers that were based on partial data without realizing it.

The warnings are returned in the chat API response context and surfaced in the frontend.
