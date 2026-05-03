# Architecture

## Request flow

```
Browser → Next.js App Router
  ├── /(auth)/*        — login, signup, confirm (Supabase Auth)
  ├── /(dashboard)/*   — protected pages (middleware redirect)
  │     ├── layout.tsx — server component: getSession() (local JWT, no network)
  │     │               + getOrgInfo() (unstable_cache, 5-min TTL, React.cache dedup)
  │     ├── dashboard/page.tsx — server component: fetches all metrics server-side
  │     │   └── DashboardView.tsx — 'use client' (Recharts only)
  │     └── other pages — 'use client' + useEffect fetch (candidates for SSR migration)
  └── /api/*           — server-side handlers
        ├── auth guard: supabase.auth.getUser()
        ├── org lookup: org_members table
        ├── Cache-Control: private, max-age=30–60, stale-while-revalidate headers
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
  ├── Connect: POST /api/connections/stripe → validate key → encrypt → store in connections table
  ├── Webhook: POST /api/webhooks/stripe → verify sig → idempotent insert
  └── On-demand: POST /api/sync/stripe → decrypt key from connections → lib/sync/stripe.ts → pull last 30d

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
| `lib/metrics/index.ts` | Pure financial computations (getMRR, getBurnRate, getRunway, getPnL, getForecast…). All parallel via `Promise.all`. Connection status checks use `'active'` (the DB value). |
| `lib/auth.ts` | `getSession()` (React.cache, local JWT read) + `getOrgInfo()` (React.cache + unstable_cache 5-min TTL). Shared between layout and page to eliminate duplicate DB calls. |
| `lib/llm/` | OpenAI + Anthropic adapters + factory + intent detection. Model is configured server-side only — no user-facing model picker. |
| `lib/categorization/rules.ts` | 3-layer auto-categorization: org overrides → org rules → system rules → AI |
| `lib/sync/stripe.ts` | Stripe sync helpers. `getStripeClientForOrg()` decrypts per-org key from DB; falls back to `STRIPE_SECRET_KEY` env var. |
| `lib/sync/plaid.ts` | Plaid link token, token exchange, cursor-based transaction sync. Requires `PLAID_CLIENT_ID` + `PLAID_SECRET` platform credentials. |
| `lib/sync/shopify.ts` | Shopify OAuth + order sync. Requires `SHOPIFY_API_KEY` + `SHOPIFY_API_SECRET` platform credentials. |
| `lib/sync/paypal.ts` | PayPal OAuth + transaction sync. Requires `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` platform credentials. |
| `lib/sync/reconciliation.ts` | Match Stripe payouts ↔ Plaid deposits (±3 day, same amount) |
| `lib/encryption.ts` | AES-256-GCM encrypt/decrypt for all stored secrets (Stripe keys, Plaid tokens, OAuth tokens) |
| `lib/audit.ts` | Central audit log writer (`writeAuditLog`) |

## Multi-tenancy

Every table has an `org_id` foreign key. Supabase Row Level Security (RLS) enforces that users can only read/write rows belonging to their own org. The `get_user_org_id()` helper is used in RLS policies to avoid N+1 lookups.

Service-role operations (cron, webhooks) bypass RLS using `createServiceClient()` — these are never exposed to the browser.
