# Finvio — Detailed System Overview

> Assessment Date: 2026-05-31  
> Purpose: Full codebase audit covering features, architecture, accounting capabilities, reusable components, MVP workflow automation recommendation, and implementation gaps.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend Pages & Navigation](#2-frontend-pages--navigation)
3. [Backend APIs](#3-backend-apis)
4. [Database Schema](#4-database-schema)
5. [AI / Agent Infrastructure](#5-ai--agent-infrastructure)
6. [Existing Features — Implementation Status](#6-existing-features--implementation-status)
7. [Accounting Capabilities](#7-accounting-capabilities)
8. [Workflow, Job & Automation Systems](#8-workflow-job--automation-systems)
9. [Reusable Components](#9-reusable-components)
10. [Tech Stack Summary](#10-tech-stack-summary)
11. [MVP Workflow Automation — Recommendation](#11-mvp-workflow-automation--recommendation)
12. [Gaps — What's Missing for Key Workflows](#12-gaps--whats-missing-for-key-workflows)

---

## 1. Architecture Overview

Finvio is a **Next.js 16 App Router** monolith hosted on Vercel with **Supabase** (PostgreSQL + Auth + RLS) as its data layer.

```
Browser / Mobile
    │
    ▼
Next.js App (Vercel)
├── app/(dashboard)/    — Protected dashboard pages (React server + client components)
├── app/(auth)/         — Login / signup / private beta gate
├── app/api/            — REST API routes (server-only)
│   ├── chat/           — AI advisor endpoints
│   ├── transactions/   — Ledger CRUD
│   ├── invoices/       — AR management
│   ├── sync/           — Provider sync triggers
│   ├── cron/           — Scheduled jobs (Vercel Cron)
│   └── webhooks/       — Stripe / Mercury / LemonSqueezy
├── lib/
│   ├── llm/            — LLM adapters, intent detection, document extraction
│   ├── metrics/        — All financial metric calculations
│   ├── sync/           — Provider sync + reconciliation engine
│   └── categorization/ — Rules engine + AI fallback categorizer
└── supabase/
    └── migrations/     — PostgreSQL schema migrations
```

**Auth flow:** Supabase Auth → `proxy.ts` (Next.js middleware equivalent) → org check → dashboard.  
**Multi-tenancy:** `org_id` on every table; per-org row-level security in Supabase.

---

## 2. Frontend Pages & Navigation

### Landing & Auth

| Route | File | Status | Notes |
|-------|------|--------|-------|
| `/` | `app/page.tsx` | Live | Marketing landing page |
| `/waitlist` | `app/waitlist/page.tsx` | Live | LaunchList waitlist widget |
| `/login` | `app/(auth)/login/page.tsx` | Live | Email/password only |
| `/signup` | `app/(auth)/signup/page.tsx` | Gated | Private beta gate; links to `/waitlist` |
| `/pricing` | `app/(marketing)/pricing/page.tsx` | Live | "Pricing announced at launch" card |
| `/features` | `app/(marketing)/features/page.tsx` | Live | Feature listing |
| `/faq` | `app/(marketing)/faq/page.tsx` | Live | FAQ accordion + contact card |
| `/insights` | `app/insights/page.tsx` | Live | Blog powered by Sanity CMS |
| `/studio` | `app/studio/[[...tool]]/page.tsx` | Live | Sanity CMS editor (internal) |

### Dashboard (protected)

| Route | File | Status | Notes |
|-------|------|--------|-------|
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | **Fully functional** | MRR, ARR, runway, burn, recent transactions, alerts |
| `/transactions` | `app/(dashboard)/transactions/page.tsx` | **Fully functional** | CRUD, filter by type/category/source, soft delete |
| `/invoices` | `app/(dashboard)/invoices/page.tsx` | **Mostly complete** | CRUD + status management; PDF gen missing |
| `/revenue` | `app/(dashboard)/revenue/page.tsx` | **Fully functional** | MRR/ARR trend (6-month), breakdown by type, churn rate |
| `/expenses` | `app/(dashboard)/expenses/page.tsx` | **Fully functional** | Expense reports with approval workflow |
| `/projects` | `app/(dashboard)/projects/page.tsx` | **Functional** | Project CRUD, budget tracking, transaction linkage |
| `/advisor` | `app/(dashboard)/advisor/page.tsx` | **Functional** | AI chat with voice, PDF upload, intent routing |
| `/connections` | `app/(dashboard)/connections/page.tsx` | **Partially complete** | OAuth UI for 11 providers; Plaid sync stubbed |
| `/reports` | `app/(dashboard)/reports/page.tsx` | **Functional** | P&L by month, period comparison |
| `/forecast` | `app/(dashboard)/forecast/page.tsx` | **Functional** | 6-month projection with adjustable growth rate |
| `/investor-updates` | `app/(dashboard)/investor-updates/page.tsx` | **Functional** | Draft/send monthly investor emails |
| `/import` | `app/(dashboard)/import/page.tsx` | **Fully functional** | CSV upload with column mapping, preview, batch import |
| `/balance-sheet` | `app/(dashboard)/balance-sheet/page.tsx` | **Placeholder** | Page exists; no calculation logic |
| `/scenarios` | `app/(dashboard)/scenarios/page.tsx` | **Placeholder** | Page exists; minimal implementation |
| `/glossary` | `app/(dashboard)/glossary/page.tsx` | **Placeholder** | Page exists |
| `/settings` | `app/(dashboard)/settings/page.tsx` | **Minimal** | Profile, AI model preference |

### Navigation Structure
- **Sidebar** defined in `app/(dashboard)/layout.tsx` — links to all dashboard pages
- **Landing navbar** (`components/landing/SiteNav.tsx`) — Login + Join Waitlist
- Mobile: hamburger sheet menu with same items
- `FloatingAdvisorButton` appears on all dashboard pages (bottom-right chat toggle)

---

## 3. Backend APIs

### AI / Chat

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat` | Main chat — intent detection, context fetch, LLM call |
| POST | `/api/chat/confirm` | Execute pending action (expense/invoice/income) with audit log |
| GET/POST | `/api/chat/sessions` | Session CRUD |
| GET | `/api/chat/sessions/[id]/messages` | Message history for session |
| POST | `/api/chat/upload` | PDF upload → text extraction → pending action |
| POST | `/api/chat/voice-route` | Voice message routing |

### Transactions & Ledger

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST/PATCH/DELETE | `/api/transactions` | Transaction CRUD; soft delete; categorization |
| GET/POST/PATCH | `/api/invoices` | Invoice CRUD, status management |
| GET/POST | `/api/expenses` | Expense report CRUD with approval workflow |
| GET/POST | `/api/projects` | Project CRUD with collected/expense totals |

### Connections & Sync

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/connections/configured` | List active connections for org |
| GET | `/api/connections/[provider]` | Initiate OAuth redirect |
| GET | `/api/connections/[provider]/callback` | OAuth callback; store encrypted tokens |
| DELETE | `/api/connections/[provider]` | Disconnect provider |
| POST | `/api/sync/[provider]` | Manual sync trigger (Stripe, Plaid, Gmail, Outlook, PayPal, Shopify, QuickBooks, Mercury, Brex, LemonSqueezy) |

### Metrics & Reporting

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/metrics/dashboard` | Full dashboard snapshot (MRR, ARR, runway, burn, transactions) |
| GET | `/api/metrics/pnl` | P&L by month with period comparison |
| GET | `/api/metrics/revenue` | Revenue breakdown by type |
| GET | `/api/metrics/forecast` | 6-month revenue/expense projection |

### Cron Jobs

| Method | Route | Schedule | Description |
|--------|-------|----------|-------------|
| GET | `/api/cron/daily-sync` | 02:00 UTC daily | Sync all active connections; run reconciliation |
| GET | `/api/cron/invoice-overdue` | 06:00 UTC daily | Mark sent invoices overdue if past due date |

### Webhooks

| Method | Route | Source |
|--------|-------|--------|
| POST | `/api/webhooks/stripe` | Stripe (charge, subscription, invoice, payout) |
| POST | `/api/webhooks/mercury` | Mercury (bank transactions) |
| POST | `/api/webhooks/lemonsqueezy` | LemonSqueezy (revenue events) |

### Other

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/import` | CSV batch import with column mapping |
| GET/POST | `/api/investor-updates` | Investor update draft/send |
| GET/PATCH | `/api/settings` | User preferences (LLM provider/model, theme) |

---

## 4. Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `organizations` | Multi-tenant root | `id, name, currency, fiscal_year_start, industry` |
| `org_members` | Team roles | `org_id, user_id, role (owner/member/viewer)` |
| `user_settings` | Per-user config | `user_id, llm_provider, llm_model, theme` |
| `transactions` | Master ledger | `org_id, type, amount, description, category, date, source, is_reviewed, is_reconciled, reconciled_with, deleted_at, recurrence, revenue_type, project_id, invoice_id` |
| `invoices` | Accounts receivable | `org_id, invoice_number, customer_name, amount, status, due_date, invoice_date, paid_at, tax_amount` |
| `customers` | CRM / subscription tracking | `org_id, external_id, name, email, status, source, mrr, plan, first_seen, churned_at` |
| `subscriptions` | Recurring revenue | `org_id, external_id, customer_id, amount, interval, status, plan_name, current_period_start/end, source` |
| `projects` | Billable project tracking | `org_id, name, client, status, budget, start_date, end_date` |
| `expense_reports` | AP approval workflow | `org_id, title, amount, category, date, status (pending/approved/rejected), submitter_id, receipt_url, reviewed_by` |
| `connections` | Integration credentials | `org_id, provider, encrypted_access_token, encrypted_refresh_token, status, last_synced_at, metadata` |
| `category_rules` | Auto-categorization | `org_id, match_value, match_type (exact/keyword/regex), category, priority` |
| `category_overrides` | Org-specific overrides | `org_id, description_pattern, category, subcategory` |
| `csv_imports` | Import tracking | `org_id, file_name, status, imported_rows, total_rows, error_log, column_mapping` |
| `chat_sessions` | Conversation threads | `org_id, user_id, title, created_at` |
| `chat_messages` | Message log | `session_id, role, content, intent, function_calls, execution_result, data_context, model_used, tokens_used` |
| `monthly_snapshots` | Historical metrics | `org_id, month, mrr, arr, cash_balance, burn_rate, runway` |
| `audit_log` | Compliance trail | `org_id, user_id, entity_type, entity_id, action, before_state, after_state, ip_address, user_agent` |
| `data_completeness` | Data quality | `org_id, stripe_connected, bank_connected, revenue_completeness, expense_completeness` |
| `webhook_events` | Idempotency keys | `org_id, event_id, event_type, provider, payload, status` |
| `investor_updates` | Founder communication | `org_id, month, status (draft/sent), content, metrics_snapshot, sent_at` |
| `sync_logs` | Job tracking | `org_id, provider, sync_type, records_synced, records_skipped, error_message, started_at, completed_at` |
| `voice_usage` | Rate limiting | `user_id, date, duration_seconds` |

### Notable Schema Design Decisions

- **Soft deletes** on `transactions` (`deleted_at` column + index) — data is never hard deleted
- **Reconciliation links** — `transactions.reconciled_with` links paired transactions; `transactions.invoice_id` links to AR
- **Audit log** captures before/after state for all write operations
- **Encrypted tokens** — OAuth tokens stored encrypted in `connections` table via `crypto` module
- **Dedup index** — `idx_transactions_dedup` on `(org_id, amount, type, date)` for cross-source deduplication

---

## 5. AI / Agent Infrastructure

### Intent Detection (`lib/llm/intent.ts`)

Two-stage detection — fast keyword pass first, LLM fallback only if no match:

**Query intents:**
- `query_runway` — "how long is my runway", "months of cash left"
- `query_mrr` — "what's my MRR", "monthly recurring revenue"
- `query_burn` — "burn rate", "net burn"
- `query_pnl` — "profit and loss", "P&L"
- `query_forecast` — "revenue forecast", "projected growth"
- `query_customers` — "active customers", "churn rate"
- `query_revenue` — "total revenue this month"
- `query_profit` — "net profit", "gross margin"
- `query_expenses` — "what are my expenses", "biggest costs"
- `query_project` — project-specific financial questions
- `query_help` — app navigation and how-to questions

**Write intents:**
- `create_expense` — "add expense for $200"
- `create_invoice` — "create invoice for Acme $5,000"
- `add_income` — "record payment received"
- `confirm_action` — "yes", "confirm", "ok"

**Unknown** — fallback when no intent matches.

### LLM Adapters (`lib/llm/`)

| File | Purpose |
|------|---------|
| `factory.ts` | Returns OpenAI or Anthropic adapter based on user setting |
| `openai.ts` | `gpt-4o-mini` for intent; `gpt-4o` for chat; structured output |
| `anthropic.ts` | Claude adapter for chat |
| `intent.ts` | Keyword patterns + LLM fallback for intent classification |
| `documentExtractor.ts` | PDF text → structured financial data |
| `chatSchemas.ts` | Shared Zod schemas for expense, invoice, income |

### Chat Flow (`app/api/chat/route.ts`)

```
User message
    ↓
Rate limit check (30 req/min per user)
    ↓
detectIntent() — keyword pass → LLM fallback if needed
    ↓
fetchContextForIntent() — pulls live financial data from DB
    ↓
buildSystemPrompt() — injects org metrics + app knowledge + guardrails
    ↓
LLM call (OpenAI or Anthropic based on user preference)
    ↓
If write intent → extractWriteAction() → Zod validation → pendingAction
    ↓
Save to chat_messages (with intent, tokens, function_calls)
    ↓
Return { message, pendingAction?, sessionId }
```

### Confirmation Flow

1. AI returns `pendingAction` (not yet saved)
2. Frontend renders `ConfirmationCard` showing extracted details
3. User clicks "Confirm" → POST `/api/chat/confirm`
4. Server writes to DB + appends to `audit_log`

### Document Extraction (`lib/llm/documentExtractor.ts`)

- Input: PDF text (from `pdf-parse`)
- LLM classifies: `receipt | invoice_received | invoice_sent | quotation | payment_confirmation | unknown`
- Extracts: vendor, amount, date, description, currency, confidence level
- Builds `PendingAction` → same confirmation flow as text chat

### Voice Input

- Client-side Whisper-tiny via `@huggingface/transformers` (WASM)
- Transcribed locally in browser, no server round-trip for audio
- Rate-limited via `voice_usage` table

---

## 6. Existing Features — Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Transaction CRUD** | ✅ Fully implemented | Create, read, update, soft delete; source tracking |
| **Auto-categorization** | ✅ Fully implemented | 3-layer: org overrides → org rules → system rules → AI fallback |
| **Revenue / MRR / ARR** | ✅ Fully implemented | From subscriptions + income transactions; 6-month trends; churn |
| **Expense tracking** | ✅ Fully implemented | Transactions table + expense_reports approval workflow |
| **Invoicing (AR)** | 🟡 Mostly complete | Create/edit/status/overdue; missing: PDF gen, line items, recurring |
| **Project tracking** | ✅ Functional | CRUD, budget, client; transaction linkage via `project_id` |
| **Stripe integration** | ✅ Fully implemented | OAuth, customer sync, charges, subscriptions, payout reconciliation |
| **Email integrations** | ✅ Functional | Gmail + Outlook → parse receipts/invoices → transactions |
| **PayPal integration** | ✅ Functional | OAuth + transaction sync |
| **Shopify integration** | ✅ Functional | OAuth + revenue sync |
| **QuickBooks integration** | ✅ Functional | OAuth + expense sync |
| **Mercury / Brex** | ✅ Functional | Balance sync + transaction pull |
| **LemonSqueezy** | ✅ Functional | Webhook-based revenue events |
| **Plaid (bank)** | 🔴 Stubbed | OAuth connector exists; sync marked "coming soon" in UI |
| **CSV bulk import** | ✅ Fully implemented | Column mapping, preview, batch import, error log |
| **Reconciliation engine** | ✅ Functional | Payout↔deposit matching, income↔invoice matching, cross-source dedup |
| **Daily cron sync** | ✅ Functional | Vercel Cron at 02:00 UTC |
| **Invoice overdue cron** | ✅ Functional | Vercel Cron at 06:00 UTC |
| **P&L reporting** | ✅ Functional | Monthly P&L with period-over-period comparison |
| **Revenue reporting** | ✅ Functional | Breakdown by type (recurring/one-time/project) |
| **Forecast** | ✅ Functional | 6-month projection with growth rate slider |
| **Investor updates** | ✅ Functional | Draft + send monthly emails with metrics snapshot |
| **AI advisor chat** | ✅ Functional | Multi-intent, context-aware, voice, PDF upload |
| **Audit log** | ✅ Functional | All writes logged with before/after state |
| **Balance sheet** | 🔴 Placeholder | Page exists; no calculation |
| **Cash flow statement** | 🔴 Not implemented | Not explicitly built; derivable from transactions |
| **Journal entries / GL** | 🔴 Not implemented | No general ledger or manual journal entry system |
| **Period closing** | 🔴 Not implemented | `monthly_snapshots` captures metrics but no lock/finalize process |
| **Payroll** | 🔴 Not implemented | No tables, time tracking, or payroll integration |
| **Tax form generation** | 🔴 Not implemented | No 5472, 1120, 7004 generation despite UI copy |
| **Multi-entity support** | 🔴 Not implemented | Single-org architecture; no subsidiaries or consolidated view |
| **Capital account tracking** | 🔴 Not implemented | No equity, distributions, or member contribution tracking |
| **AP management (accrual)** | 🔴 Partial | `expense_reports` approval flow exists; no accrual tracking or aging |
| **Compliance calendar** | 🔴 Not implemented | No tax deadline tracking or alerts |
| **Recurring invoices** | 🔴 Not implemented | `recurrence` field on transactions but no invoice recurrence engine |

---

## 7. Accounting Capabilities

### Implemented

**Transaction Management**
- Income and expense entries with full metadata (source, category, date, project, invoice linkage)
- Auto-categorization via rules engine with AI fallback
- Manual review and override via transactions page
- Soft delete with full audit trail
- Recurrence tagging (monthly, quarterly, annual)
- Cross-source deduplication (prevents double-counting Gmail + Plaid)

**Revenue / AR Tracking**
- MRR/ARR calculated from active subscriptions (primary) or income transactions (fallback)
- Churn rate from `customers.churned_at`
- Revenue segmented by type: recurring, one-time, project-based, milestone
- Invoice lifecycle: draft → sent → paid → overdue (auto-flagged by cron)
- Invoice auto-matched to income transactions by amount + date proximity

**Expense / AP Tracking**
- Expenses categorized and filtered on expenses page
- Expense report approval workflow: pending → approved/rejected
- AP aging: not implemented (no accrual dates or aging buckets)

**Reconciliation**
- Stripe payout → bank deposit matching (amount ±$0.01, 3-day window)
- Income transaction → open invoice matching (±$0.01, 14-day window)
- Duplicate flagging across sources

**Reporting**
- P&L: monthly revenue vs expenses, net income, period-over-period
- Revenue breakdown: by type, by customer
- Forecast: 6-month projection
- Balance sheet: page exists but empty

### Not Implemented

| Capability | Gap |
|-----------|-----|
| **General Ledger / Chart of Accounts** | No double-entry bookkeeping; ledger is single-entry transactions |
| **Journal Entries** | No manual debit/credit entries |
| **Accrual Accounting** | Cash-basis only; no accounts payable aging |
| **Balance Sheet** | No assets/liabilities/equity calculation |
| **Cash Flow Statement** | Not built (derivable from transactions) |
| **Period Locking** | No ability to lock closed months from edits |
| **Bank Reconciliation Workflow** | `is_reconciled` flag exists but no UI reconciliation workflow |
| **Payroll** | No payroll processing, tax withholding, or pay stub generation |
| **Tax Form Generation** | 5472, 1120, 7004 mentioned in UI copy but not implemented |
| **Depreciation / Fixed Assets** | Not implemented |
| **Inventory Accounting** | Not implemented |
| **Multi-Currency Settlement** | Transactions store currency but no FX gain/loss accounting |

---

## 8. Workflow, Job & Automation Systems

### Scheduled Jobs (Vercel Cron)

| Job | Schedule | File | What It Does |
|-----|----------|------|-------------|
| Daily Sync | 02:00 UTC | `app/api/cron/daily-sync/route.ts` | Syncs Stripe, Plaid, Gmail, Outlook for all active connections; runs reconciliation |
| Invoice Overdue | 06:00 UTC | `app/api/cron/invoice-overdue/route.ts` | Queries sent invoices past due date → marks overdue → audit log |

Both require `Authorization: Bearer {CRON_SECRET}` header (Vercel sets this automatically).

### Reconciliation Engine (`lib/sync/reconciliation.ts`)

Three automated matching passes run after each sync:

1. **Payout → Deposit:** Stripe payout events matched to bank deposits (amount ±$0.01, ±3 days)
2. **Income → Invoice:** Incoming payments matched to open invoices (amount ±$0.01, ±14 days of due date)  
3. **Cross-Source Dedup:** Transactions from different sources flagged if same amount/type/date within 1 day

### Webhooks (Event-Driven)

| Provider | Events Handled |
|----------|---------------|
| Stripe | `charge.succeeded`, `charge.refunded`, `customer.subscription.*`, `invoice.paid`, `payout.paid` |
| Mercury | Bank transaction webhooks |
| LemonSqueezy | Revenue events |

Webhook idempotency enforced via `webhook_events` table — duplicate event IDs are skipped.

### Approval Workflow

- `expense_reports` go through pending → approved/rejected cycle
- AI-suggested transactions require user confirmation before write (ConfirmationCard → `/api/chat/confirm`)

### What's Missing

- No task queue (no Bull, Inngest, Trigger.dev, etc.)
- No complex multi-step workflow engine
- No retry logic for failed syncs (sync_logs tracks failures but no automatic retry)
- No notification system for workflow events (email/Slack alerts)
- No human-in-the-loop approval for automated actions beyond the chat confirmation card

---

## 9. Reusable Components

### Confirmation Pattern

**`components/chat/ConfirmationCard.tsx`**  
Shows extracted action details (amount, description, category, date) with Confirm/Cancel buttons. Currently only used by AI chat — could be reused for any workflow step that needs user approval before a write.

The `PendingAction` type in `types/index.ts` defines the shape:
```typescript
{ type: 'create_expense' | 'create_invoice' | 'add_income', ...fields }
```

### Modal Pattern

`components/modals/AddExpenseModal.tsx` and `AddIncomeModal.tsx` — quick-add modals with form state and POST to API. Good template for adding new quick-create flows.

### Notification System

`sonner` toast library used throughout. Call `toast.success()`, `toast.error()`, `toast.warning()` from anywhere. No custom wrapper needed.

### Progress / Loading

- `Skeleton` components (shadcn/ui) used on dashboard metric cards
- File upload progress tracked via `XMLHttpRequest` `progress` event (in CSV import)
- Whisper model download progress in `VoiceInput.tsx`

### Metrics Calculation (`lib/metrics/index.ts`)

All metric functions follow the pattern:
```typescript
export async function getMetricName(orgId: string, options?): Promise<{ value, trend, warnings[] }>
```

Functions are independent and can be composed with `Promise.all()`. Currently used by:
- `/api/metrics/*` endpoints
- AI advisor context fetchers

Good candidates for reuse in workflow automation (e.g., snapshot metrics at month-end close).

### Audit Log

`audit_log` table is written by `/api/chat/confirm`. The pattern:
```typescript
await supabase.from('audit_log').insert({
  org_id, user_id, entity_type, entity_id, action,
  before_state, after_state, ip_address, user_agent
})
```
Can be extracted to a shared `lib/audit.ts` helper and reused in any workflow that modifies data.

### Sync Infrastructure

`lib/sync/` contains provider-specific sync functions. Each follows the same structure:
1. Fetch cursor (`last_synced_at` from `connections`)
2. Pull records from provider API
3. Upsert to `transactions`/`customers`/`subscriptions`
4. Update `last_synced_at`
5. Write to `sync_logs`

### Reporting (`/api/metrics/pnl`)

Returns structured monthly P&L data. Could feed a month-end close snapshot writer without modification.

---

## 10. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router) + React 19.2 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password) |
| ORM | `@supabase/supabase-js` + PostgREST |
| LLM | Anthropic SDK + OpenAI SDK (user-selectable) |
| Payments | Stripe SDK 22.x |
| Bank | Plaid SDK (partial) |
| PDF parsing | `pdf-parse` |
| CSV | PapaParse |
| Voice | `@huggingface/transformers` (Whisper-tiny WASM, client-side) |
| Charts | Recharts |
| Toast | Sonner |
| Icons | Lucide React |
| Dates | date-fns |
| CMS | Sanity (headless, for blog) |
| Hosting | Vercel |
| Cron | Vercel Cron Jobs |
| Testing | Vitest 4.1 + coverage |

---

## 11. MVP Workflow Automation — Recommendation

### Design Principle

Use **existing infrastructure** — metrics functions, reconciliation engine, cron jobs, audit log, confirmation card — rather than building new systems. The MVP should feel like "the AI does the work and shows you a summary to approve."

### Recommended MVP Workflows (Priority Order)

---

#### A. Month-End Close Workflow ⭐ Highest Value

**What it does:** At the end of each month, the system:
1. Pulls all transactions for the month
2. Identifies uncategorized or unreviewed entries and surfaces them to the user for review
3. Runs reconciliation (payouts, invoices, dedup — already built)
4. Takes a `monthly_snapshots` record (already exists, just needs to be written reliably)
5. Locks the month (sets a `closed_months` record; API rejects edits to locked periods)
6. Generates P&L summary for that month

**What to build (minimal):**
- `closed_months` table: `(org_id, month, closed_at, closed_by)` — just a lock flag
- `/api/workflows/month-end/run` endpoint that orchestrates steps 1–5
- Simple UI: "Close Month" button on Reports page → shows summary card → Confirm → locks
- Block transaction edits if `date` falls in a closed month

**Reuses:** `lib/metrics/index.ts`, `lib/sync/reconciliation.ts`, `monthly_snapshots`, `audit_log`, `ConfirmationCard` pattern

**Complexity:** Medium — 3–4 days of engineering

---

#### B. Bank Reconciliation Workflow ⭐ High Value

**What it does:** 
1. Surfaces unreconciled transactions (bank imports vs recorded transactions)
2. Lets user match, ignore, or create a new entry for each
3. Marks matched pairs `is_reconciled = true`

**What to build:**
- UI screen at `/reconciliation` (or modal on Transactions page): two-column list (bank side vs ledger side) with "Match" / "Create Entry" / "Ignore" actions
- `POST /api/reconciliation/match` — sets `is_reconciled = true` on both, links via `reconciled_with`
- Filter `transactions` where `is_reconciled = false AND source = 'plaid'` vs `is_reconciled = false AND source IN ('stripe','manual')`

**Depends on:** Plaid sync (currently stubbed — this workflow only becomes valuable after Plaid is fully implemented). Can demo with Stripe/Mercury in the interim.

**Reuses:** Reconciliation engine (`lib/sync/reconciliation.ts`), `is_reconciled` and `reconciled_with` columns (already in schema)

**Complexity:** Medium — 2–3 days, plus Plaid sync (1–2 weeks to complete)

---

#### C. Daily Accounting Workflow ⭐ Medium Value

**What it does:** A daily digest surfaced in the dashboard (or as an email/notification):
1. Transactions synced yesterday — X new, Y uncategorized
2. Invoices newly overdue
3. Upcoming invoice due dates (next 7 days)
4. Any reconciliation warnings from last night's cron

**What to build:**
- Dashboard widget (already has alerts section) — pull from `sync_logs` for yesterday's counts
- Email digest: `POST /api/investor-updates` already sends emails; a new daily digest email template using the same infrastructure
- Scheduled email at 08:00 via Vercel Cron (new cron route: `/api/cron/daily-digest`)

**Reuses:** Daily cron infrastructure, `sync_logs`, existing invoice overdue logic, email sending in `investor-updates`

**Complexity:** Low-Medium — 1–2 days

---

#### D. Payroll Workflow 🔴 Defer

**Current gap:** No payroll tables, no time tracking, no tax withholding logic, no integration with Gusto/ADP/Rippling. This requires a significant data model expansion.

**Recommended approach:** Integrate a third-party payroll API (Gusto or Check) rather than building payroll from scratch. Payroll compliance (federal/state withholding, W-2, 1099) is extremely complex and liability-heavy.

**Defer until:** Plaid is fully implemented, multi-entity support exists, and the existing accounting base is stable.

---

### Workflows to Exclude from MVP

| Workflow | Reason |
|---------|--------|
| Payroll | Requires major infrastructure + regulatory complexity |
| Tax form generation (5472, 1120) | IRS form validation is complex; better as CPA-reviewed output |
| Multi-entity consolidation | Requires data model rewrite |
| Journal entries / GL | Requires double-entry bookkeeping engine |
| AP aging | Requires accrual accounting model |

### Real vs Mocked for MVP

| Feature | Real | Mocked/Approximate |
|---------|------|-------------------|
| Monthly snapshots | Real (already exists) | — |
| Reconciliation matching | Real (already built) | — |
| Period lock (closed months) | Real (new table needed) | — |
| P&L for closed month | Real | — |
| Bank reconciliation UI | — | Can mock with Stripe/Mercury data until Plaid is live |
| Daily digest email | Real (template new, infra existing) | — |
| Payroll | — | Mock: just a "Payroll recorded" manual entry for now |

---

## 12. Gaps — What's Missing for Key Workflows

### Run Month-End Close

| Gap | What's Needed | Files to Create/Modify |
|-----|--------------|----------------------|
| No period locking | `closed_months` table + API enforcement | New migration + `lib/periods.ts` + guards in `/api/transactions` |
| `monthly_snapshots` written inconsistently | Ensure snapshot is written reliably at close | Update `/api/workflows/month-end/run` |
| No "uncategorized review" step | Query `is_reviewed = false` for the month and surface to user | UI review screen or modal |
| No orchestration endpoint | Need single endpoint that runs: reconciliation → snapshot → lock | New `app/api/workflows/month-end/route.ts` |
| No UI entry point | "Close Month" button + confirmation card | New section on `/reports` or `/dashboard` |
| No email/notification at close | Optional but valuable | Extend investor-updates sender |

**Estimated effort:** 4–5 days (2 days backend + 2 days UI + 1 day testing)

---

### Run Bank Reconciliation

| Gap | What's Needed | Files to Create/Modify |
|-----|--------------|----------------------|
| Plaid sync not complete | Full Plaid sync must be implemented first | `app/api/sync/plaid/route.ts` (extend stub) |
| No reconciliation UI | Two-column "bank vs ledger" matching screen | New `app/(dashboard)/reconciliation/page.tsx` |
| No manual match endpoint | `POST /api/reconciliation/match` | New API route |
| No "ignore" / "create entry" actions | Allow user to dismiss unmatched items | Extend match endpoint + UI |
| No running reconciliation report | Show % reconciled, outstanding items | New query on `/api/metrics/` |

**Estimated effort:** 3–4 days UI/backend, plus 1–2 weeks for Plaid completion

---

### Run Payroll Workflow

| Gap | What's Needed | Notes |
|-----|--------------|-------|
| No payroll data model | `payroll_runs`, `payroll_line_items`, `employees`, `tax_withholdings` tables | Major schema work |
| No time tracking | Need hours or salary basis | Could integrate Toggl, Harvest, or build simple entry |
| No tax calculation | Federal/state withholding, FICA | Extremely complex; use Gusto/Check API instead |
| No pay stub generation | PDF generation needed | Use a payroll provider's API |
| No payroll integration | Gusto, Rippling, ADP, or Check API | Strongly recommend third-party |
| No payroll expense auto-categorization | Payroll transactions need to auto-tag as `payroll` category | Extend category rules |

**Estimated effort:** 6–10 weeks if built from scratch. 2–3 weeks if integrating Gusto/Check API.  
**Recommendation:** Defer. Integrate Gusto (has a clean API) as Phase 2.

---

### Run Daily Accounting Workflow

| Gap | What's Needed | Files to Create/Modify |
|-----|--------------|----------------------|
| No daily digest | Summary of yesterday's syncs, new overdue invoices, uncategorized count | New `/api/cron/daily-digest/route.ts` |
| No email template for daily digest | Brief HTML email with key numbers | Extend email sender in `investor-updates` or add `lib/email.ts` |
| No dashboard "yesterday summary" widget | Card showing sync results from last run | Pull from `sync_logs` in dashboard page query |
| No notification system | Toasts exist but no push/email notifications | Add email via Resend or Postmark |
| No "items needing attention" view | Aggregated view of unreviewed transactions + overdue invoices | New dashboard widget or dedicated `/inbox` page |

**Estimated effort:** 2–3 days for dashboard widget + digest cron; 1 additional day for email delivery

---

*This document reflects the state of the codebase as of 2026-05-31. Update when major features ship.*
