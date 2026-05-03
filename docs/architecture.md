# Architecture

## Request flow

```
Browser → Next.js App Router
  ├── /(auth)/*        — login, signup, confirm (Supabase Auth)
  ├── /(dashboard)/*   — protected pages (middleware redirect)
  │     └── 'use client' components → fetch /api/* routes
  └── /api/*           — server-side handlers
        ├── auth guard: supabase.auth.getUser()
        ├── org lookup: org_members table
        ├── business logic (lib/*)
        └── Supabase DB write
```

## Data flow — AI Chat

```
User message
  → POST /api/chat
    → intent detection (keyword match → LLM fallback)
    → READ flow: metrics engine → LLM → response
    → WRITE flow: LLM → pendingAction JSON → returned to client
  → Confirmation card shown
  → POST /api/chat/confirm
    → validate params
    → DB write
    → audit log
```

## Data flow — Integrations

```
Stripe
  ├── Webhook: POST /api/webhooks/stripe → verify sig → idempotent insert
  └── On-demand: POST /api/sync/stripe → lib/sync/stripe.ts → pull last 30d

Plaid
  ├── Link: GET /api/connections/plaid → link token → Plaid Link UI
  ├── Exchange: POST /api/connections/plaid → access token encrypted + stored
  └── Sync: POST /api/sync/plaid → cursor-based incremental sync

Shopify / PayPal
  ├── OAuth: GET /api/connections/{provider} → redirect to OAuth
  ├── Callback: GET /api/connections/{provider}/callback → exchange code → store
  └── Sync: POST /api/sync/{provider}

Vercel Cron (daily)
  ├── GET /api/cron/daily-sync → runStripePullSync + syncPlaidTransactions per org
  └── GET /api/cron/invoice-overdue → mark sent invoices past due_date as overdue
```

## Key library modules

| Module | Purpose |
|---|---|
| `lib/metrics/index.ts` | Pure financial computations (getMRR, getBurnRate, getRunway, getPnL, getForecast…) |
| `lib/llm/` | OpenAI + Anthropic adapters + factory + intent detection |
| `lib/categorization/rules.ts` | 3-layer auto-categorization: org overrides → org rules → system rules → AI |
| `lib/sync/stripe.ts` | Stripe charge/subscription/payout sync helpers |
| `lib/sync/plaid.ts` | Plaid link token, token exchange, cursor-based transaction sync |
| `lib/sync/shopify.ts` | Shopify OAuth + order sync |
| `lib/sync/paypal.ts` | PayPal OAuth + transaction sync |
| `lib/sync/reconciliation.ts` | Match Stripe payouts ↔ Plaid deposits (±3 day, same amount) |
| `lib/encryption.ts` | AES-256-GCM encrypt/decrypt for OAuth tokens |
| `lib/audit.ts` | Central audit log writer (`writeAuditLog`) |

## Multi-tenancy

Every table has an `org_id` foreign key. Supabase Row Level Security (RLS) enforces that users can only read/write rows belonging to their own org. The `get_user_org_id()` helper is used in RLS policies to avoid N+1 lookups.

Service-role operations (cron, webhooks) bypass RLS using `createServiceClient()` — these are never exposed to the browser.
