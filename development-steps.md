# Development Steps — Finvio

This file tracks the step-by-step development progress for Finvio.

**Key decisions:**
- LLM keys are product-provided (server env vars only — users pick a model, never paste a key)
- All 4 integrations are MVP: Stripe, Plaid, Shopify, PayPal
- Full chat write flow (create expenses/invoices via chat with confirmation cards)
- Build priority: DB → Auth → AI Chat first (demo the differentiator early), then wire dashboards

---

## Progress Tracker

| Phase | Step | Task | Status | Notes |
|---|---|---|---|---|
| 1 | 1 | Initialize Next.js repo & env | ✅ Completed | Next.js 14, TypeScript, Tailwind, App Router |
| 1 | 2 | Install all dependencies | ✅ Completed | supabase, recharts, lucide, zod, papaparse, xlsx, openai, anthropic, stripe, plaid, shadcn/ui |
| 1 | 3 | Apply Supabase DB schema (all tables) | ✅ Completed | 18 tables via MCP |
| 1 | 4 | Apply RLS policies | ✅ Completed | All tables + get_user_org_id() helper |
| 1 | 5 | Apply auth triggers & defaults | ✅ Completed | handle_new_user() + set_updated_at() |
| 1 | 6 | Create Supabase storage buckets | ✅ Completed | csv-imports, receipt-attachments |
| 1 | 7 | Create .env.local.example + Supabase clients | ✅ Completed | client.ts, server.ts, .env.local.example |
| 2 | 8 | Auth pages (login, signup) | ✅ Completed | email/password + magic link + confirm screens |
| 2 | 9 | App shell (sidebar, mobile nav, layout) | ✅ Completed | 240px sidebar desktop, Sheet drawer mobile |
| 2 | 10 | Middleware (auth guard) + placeholder pages | ✅ Completed | 12 pages + auth callback route |
| 3 | 11 | TypeScript types (types/index.ts) | ✅ Completed | All DB entity + metric + chat + LLM types |
| 3 | 12 | Financial metrics engine (lib/metrics/) | ✅ Completed | getMRR/ARR/burn/runway/P&L/forecast/completeness |
| 3 | 13 | LLM adapter layer (lib/llm/) | ✅ Completed | OpenAI + Anthropic + factory + adapter interface |
| 3 | 14 | Intent detection (lib/llm/intent.ts) | ✅ Completed | keyword regex + LLM fallback |
| 3 | 15 | Chat API route (app/api/chat/) | ✅ Completed | read + write flows + /confirm route |
| 3 | 16 | Chat UI (advisor page + components) | ✅ Completed | ConfirmationCard + full advisor page |
| 4 | 17 | Transactions API (CRUD) | ✅ Completed | GET filters + POST (auto-categorize) + PATCH |
| 4 | 18 | 3-layer categorization engine | ✅ Completed | category_overrides → org rules → system rules → AI |
| 4 | 19 | Transaction review queue UI | ✅ Completed | /transactions page, review queue, inline category edit |
| 4 | 20 | Manual entry forms (expense + income) | ✅ Completed | AddExpenseModal + AddIncomeModal (Sheet slide-over) |
| 5 | 21 | Invoices API + UI + PDF export | ✅ Completed | GET/POST/PATCH; mark paid → income txn; status badges + new invoice sheet |
| 5 | 22 | Expenses API + UI + approval workflow | ✅ Completed | GET/POST/PATCH; approve → expense txn; owner/admin role check |
| 6 | 23 | lib/encryption.ts (AES-256-GCM) | ✅ Completed | encrypt/decrypt with iv:authTag:ciphertext hex format |
| 6 | 24 | Stripe webhook ingestion | ✅ Completed | signature verify, idempotency via webhook_events, routes charge/invoice/subscription/payout events |
| 6 | 25 | Stripe on-demand sync | ✅ Completed | POST /api/sync/stripe; runStripePullSync pulls last 30 days |
| 6 | 26 | Plaid connection + bank sync | ✅ Completed | link-token + exchange via /api/connections/plaid; transactionsSync cursor-based |
| 6 | 27 | Shopify sync | ✅ Completed | OAuth redirect+callback, order sync via paginated Shopify API |
| 6 | 28 | PayPal sync | ✅ Completed | OAuth redirect+callback, reporting/transactions API with refresh token |
| 6 | 29 | CSV/XLSX import flow | ✅ Completed | multi-step UI: upload → map columns → import; papaparse+xlsx; debit/credit mode; idempotency via source_ref_id |
| 7 | 30 | Dashboard page (KPIs, charts, activity) | ✅ Completed | KPI cards, 6-month bar chart, action items, recent txns |
| 7 | 31 | Revenue page | ✅ Completed | MRR trend, by-source pie, customer table |
| 7 | 32 | Reports page (P&L + export) | ✅ Completed | Month picker, P&L table vs prior month, expense pie, CSV export |
| 7 | 33 | Forecast page (sliders + projections) | ✅ Completed | Growth rate + period sliders, break-even, cash chart |
| 7 | 34 | Scenarios page (hire/growth/fundraise) | ✅ Completed | Tabs with before/after runway comparison |
| 7 | 35 | Investor Updates page | ✅ Completed | AI-generated drafts via LLM, editable textarea, save |
| 7 | 36 | Connections page | ✅ Completed | Built in Phase 6 |
| 7 | 37 | Settings page | ✅ Completed | Org name/currency/fiscal year, AI model picker |
| 8 | 38 | Vercel cron jobs (daily sync, overdue invoices) | ✅ Completed | vercel.json + 2 cron routes, CRON_SECRET auth |
| 8 | 39 | Reconciliation logic (Stripe ↔ Plaid) | ✅ Completed | lib/sync/reconciliation.ts, ±3 day window |
| 8 | 40 | Audit logging (lib/audit.ts) wired everywhere | ✅ Completed | writeAuditLog() in invoices, expenses, chat confirm, invoice-overdue cron |
| 9 | 41 | Unit tests (lib/metrics/) | ✅ Completed | 18 unit tests via Vitest; vi.hoisted mock pattern |
| 9 | 42 | Integration tests (API routes) | ✅ Completed | 13 integration tests for invoices + transactions |
| 9 | 43 | GitHub Actions CI | ✅ Completed | .github/workflows/ci.yml: typecheck → test → build |
| 9 | 44 | Generate /docs files (17 files) | ✅ Completed | overview, architecture, env vars, deployment, DB schema, 7 API + 5 integration docs |
| 9 | 45 | Supabase seed.sql (dev sample data) | ✅ Completed | Luminary Labs fictional SaaS: 6 months txns, 4 invoices, 5 customers, 5 subs |
| 9 | 46 | Vercel deployment + config | ✅ Completed | vercel.json with cron config (Phase 8); deployment guide in docs/deployment.md |

_Update status: Not started → In progress → Completed. Add notes as you go._

---

## Phase Details

### Phase 1 — Repo Init & Supabase Schema
**Goal:** Runnable Next.js app + complete DB with auth triggers in Supabase

- `npx create-next-app@latest` with TypeScript + Tailwind + App Router
- Dependencies: `@supabase/supabase-js @supabase/ssr shadcn/ui recharts lucide-react xlsx papaparse date-fns zod`
- Supabase MCP: apply all migrations (schema, RLS, triggers, seed rules)
- Storage buckets: `csv-imports`, `receipt-attachments`
- Auth: email/password + magic link enabled

**Acceptance:** `npm run dev` starts. Signing up creates org + user_settings + data_completeness automatically.

---

### Phase 2 — Auth Pages + App Shell
**Goal:** Working login/signup + full navigation shell with placeholder pages

- Auth pages with Supabase email/password + magic link
- Fixed left sidebar (240px) + mobile hamburger drawer
- `middleware.ts` guards all `/(dashboard)/*` routes
- 12 placeholder pages at correct routes

**Acceptance:** Login works. Sidebar navigation renders. Unauthenticated users are redirected.

---

### Phase 3 — Metrics Engine + AI Chat ← MAIN DIFFERENTIATOR
**Goal:** Fully working AI advisor before the dashboards

- Pure TypeScript metrics engine: getMRR, getARR, getBurnRate, getRunway, getCashBalance, getMRRTrend, getPnL, getChurnRate, getActiveCustomers, getForecast, getDataCompleteness
- LLM adapters: OpenAIAdapter + AnthropicAdapter (product-provided keys from env)
- Intent detection: keyword matching + LLM fallback
- Chat API: rate-limited, read flow (metrics → LLM) + write flow (LLM → validate → pendingAction → confirm → DB write)
- Chat UI: full-page, suggested prompts, confirmation cards, session history, mobile responsive

**Acceptance:** Chat answers "What's my runway?". Write flow shows confirmation card. Confirmed write executes and appears in DB.

---

### Phase 4 — Transactions, Categorization & Manual Entry
**Goal:** Core data layer working end-to-end

- Transactions API (GET with filters, POST, PATCH)
- 3-layer categorization: rule-based → AI fallback → user correction
- Review queue for uncategorized transactions
- Manual entry modal forms for expense + income

**Acceptance:** Manual expense created → appears in transactions with auto-category → review queue shows uncategorized items.

---

### Phase 5 — Invoices & Expenses UI
**Goal:** Invoice lifecycle + expense approval workflow

- Invoices: create, list, mark paid, PDF export, overdue detection
- Expenses: submit, approve/reject, receipt upload

**Acceptance:** Invoice created → marked paid → income transaction auto-created. Expense approved → expense transaction auto-created.

---

### Phase 6 — Data Ingestion
**Goal:** Live data from all 4 integrations + CSV import

- AES-256-GCM token encryption
- Stripe: webhooks + on-demand sync (idempotent)
- Plaid: connect + bank sync (encrypted tokens)
- Shopify + PayPal: OAuth + order sync
- CSV/XLSX: upload → column mapping → parse → import with error handling

**Acceptance:** Stripe sandbox charges sync to transactions. CSV import creates normalized records idempotently.

---

### Phase 7 — Dashboard & All Remaining Pages
**Goal:** All 12 pages wired to live data

Pages: Dashboard, Revenue, Reports (P&L), Forecast, Scenarios, Investor Updates, Connections, Settings

**Acceptance:** Dashboard shows live MRR, cash balance, runway from real data. All pages render correctly on mobile (375px).

---

### Phase 8 — Background Jobs, Reconciliation & Audit
**Goal:** Production-grade reliability

- Vercel cron: daily sync + overdue invoice detection
- Reconciliation: match Stripe payouts ↔ Plaid deposits (±3 day window)
- Audit logging wired into all write operations

**Acceptance:** Cron marks overdue invoices. Reconciled records flagged correctly.

---

### Phase 9 — Tests, Docs & Deploy
**Goal:** Shippable, documented product

- Unit tests for lib/metrics/
- Integration tests for chat + transactions + invoices APIs
- GitHub Actions CI
- 17 docs files in /docs/
- seed.sql with realistic sample data
- Vercel deployment verified

**Acceptance:** CI passes. All docs present. Staging deploy succeeds.

---

## Important Edge Cases & Decisions

1. **LLM keys**: Product provides keys via env vars. Settings UI shows model picker only (GPT-4o, GPT-4o-mini, Claude Sonnet 4, Claude Haiku 4.5). No API key input.
2. **SQL fix**: Brief had `industry TEXT,claude finance` typo in organizations table — corrected in migration.
3. **Empty states**: Every page renders with zero data and shows CTAs. Critical for users without Plaid.
4. **MRR priority**: Active subscriptions sum → fallback to monthly income transactions.
5. **Reconciliation**: Stripe is authoritative for revenue. Plaid deposits matched to Stripe payouts are excluded from income totals.
6. **Rate limit**: Chat capped at 30 req/min per user.
7. **Write flow safety**: LLM output is NEVER executed directly. Always validate → confirm → execute.
