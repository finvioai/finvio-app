# Finvio Data Architecture & Security

This document explains how Finvio stores and processes financial data — what goes where, how it gets there, who can see it, and how it is protected. It is written for both technical and non-technical readers.

---

## Table of Contents

1. [What Finvio Is, in One Paragraph](#1-what-finvio-is-in-one-paragraph)
2. [The Big Picture: How Data Flows](#2-the-big-picture-how-data-flows)
3. [Tenant Isolation — Your Data Is Yours Alone](#3-tenant-isolation--your-data-is-yours-alone)
4. [Database Tables Reference](#4-database-tables-reference)
5. [How Financial Data Gets In](#5-how-financial-data-gets-in)
6. [How Credentials Are Stored](#6-how-credentials-are-stored)
7. [How Metrics Are Calculated](#7-how-metrics-are-calculated)
8. [AI Features and What Data They See](#8-ai-features-and-what-data-they-see)
9. [Audit Trail](#9-audit-trail)
10. [Data Deletion and Soft Deletes](#10-data-deletion-and-soft-deletes)
11. [Access Control Layers](#11-access-control-layers)
12. [Security Summary for Auditors](#12-security-summary-for-auditors)
13. [Complete Table Schema — Column by Column](#13-complete-table-schema--column-by-column)
14. [Metric Calculation Deep Dive](#14-metric-calculation-deep-dive)

---

## 1. What Finvio Is, in One Paragraph

Finvio connects to your existing financial accounts (bank, Stripe, Shopify, etc.), pulls in transaction data with your permission, and gives you a unified view of your company's finances — MRR, burn rate, P&L, invoice aging, and more. It does not hold your money, initiate payments, or share your data with third parties for any purpose other than running the service.

---

## 2. The Big Picture: How Data Flows

```
┌──────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL PLATFORMS                            │
│   Stripe   Brex   Mercury   Shopify   QuickBooks   PayPal   Plaid    │
└────────────────────────────┬─────────────────────────────────────────┘
                             │  OAuth / API tokens (encrypted at rest)
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       FINVIO SYNC ENGINE                             │
│                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────────────────┐   │
│  │ Pull sync   │   │  Webhooks   │   │  Manual CSV import       │   │
│  │ (scheduled  │   │  (real-time │   │  (user uploads file)     │   │
│  │  daily)     │   │   push)     │   │                          │   │
│  └──────┬──────┘   └──────┬──────┘   └──────────┬───────────────┘   │
│         └─────────────────┴──────────────────────┘                   │
│                             │                                         │
│                             ▼                                         │
│                    Normalize & deduplicate                            │
│                             │                                         │
│                             ▼                                         │
└──────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        SUPABASE DATABASE                             │
│                        (PostgreSQL + RLS)                            │
│                                                                      │
│  transactions  ◄──────► customers  ◄──────► subscriptions           │
│  invoices            monthly_snapshots       sync_logs               │
│  connections         audit_log               workflow_runs           │
│  ...                                                                 │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
              ┌───────────────┼─────────────────┐
              ▼               ▼                 ▼
        ┌──────────┐   ┌────────────┐   ┌─────────────┐
        │ Dashboard│   │ AI Advisor │   │  Workflows  │
        │  & Reports│  │  (chat)   │   │ (automation)│
        └──────────┘   └────────────┘   └─────────────┘
              │               │                 │
              └───────────────┴─────────────────┘
                              │
                              ▼
                        Your browser
```

**In plain language:**
1. You connect your accounts once (Settings → Connections).
2. Finvio pulls data from those accounts on a daily schedule and whenever an event happens (e.g. new Stripe payment).
3. That data is stored in a PostgreSQL database hosted on Supabase.
4. Every dashboard view, report, and AI response is computed from data already in the database — Finvio does not call your bank or Stripe every time you open a page.

---

## 3. Tenant Isolation — Your Data Is Yours Alone

Every row in almost every database table has an `org_id` column. This is the unique identifier for your company ("organization"). Finvio uses **Row Level Security (RLS)** — a PostgreSQL feature — that is enforced at the database engine level, meaning:

- When your session queries the `transactions` table, PostgreSQL automatically appends `WHERE org_id = <your org id>` to every query.
- This filtering happens inside the database itself, not in application code. Even if there were a bug in the application, the database would still reject cross-tenant data access.
- Finvio engineers with database access can still query across tenants (using the service role key), but this is restricted to authorized personnel and is logged.

```
┌────────────────────────────────────────────────────────────┐
│                     Database (PostgreSQL)                  │
│                                                            │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │  Org A data          │  │  Org B data              │   │
│  │  org_id = "aaa-..."  │  │  org_id = "bbb-..."      │   │
│  │                      │  │                          │   │
│  │  transactions: 1,200 │  │  transactions: 3,400     │   │
│  │  customers:      48  │  │  customers:      112     │   │
│  │  invoices:       17  │  │  invoices:        34     │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│                                                            │
│  RLS policy: "SELECT ... WHERE org_id = auth.uid()'s org" │
│  ← enforced by PostgreSQL itself, not application code     │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Database Tables Reference

Finvio has 24 tables. They fall into five groups:

### 4.1 Identity and Access

| Table | What it stores | Key columns |
|-------|---------------|-------------|
| `organizations` | One row per company using Finvio | `id`, `name`, `owner_id`, `currency` |
| `org_members` | Who belongs to which org | `user_id`, `org_id`, `role` |
| `user_settings` | Per-user preferences (theme, AI model preference) | `user_id`, `llm_provider`, `notification_prefs` |

`auth.users` (Supabase Auth, not a custom table) holds passwords and sessions. Finvio never stores passwords directly.

### 4.2 Integrations and Sync

| Table | What it stores | Key columns |
|-------|---------------|-------------|
| `connections` | One row per connected platform per org | `provider`, `status`, `encrypted_access_token`, `last_synced_at` |
| `sync_logs` | History of every sync run (success, error, record count) | `provider`, `status`, `records_synced`, `error_message` |
| `webhook_events` | Raw webhook payloads received from platforms | `provider`, `event_id`, `event_type`, `payload`, `status` |
| `csv_imports` | Metadata about uploaded CSV files | `file_name`, `platform`, `imported_rows`, `status` |

### 4.3 Financial Data

| Table | What it stores | Key columns |
|-------|---------------|-------------|
| `transactions` | Every income and expense event | `type`, `amount`, `date`, `source`, `category`, `is_reconciled` |
| `invoices` | Invoices created in Finvio or imported | `invoice_number`, `customer_name`, `amount`, `status`, `paid_at` |
| `customers` | Customer records synced from Stripe / Lemon Squeezy | `name`, `email`, `mrr`, `status`, `source` |
| `subscriptions` | Active/cancelled subscription records | `amount`, `interval`, `status`, `source`, `customer_id` |
| `expense_reports` | Employee expense submissions | `submitter_name`, `amount`, `category`, `status`, `receipt_url` |
| `projects` | Project budget tracking | `name`, `budget`, `client`, `status` |

### 4.4 Computed Metrics and Reporting

| Table | What it stores | Key columns |
|-------|---------------|-------------|
| `monthly_snapshots` | Pre-computed financial metrics per month | `month`, `mrr`, `arr`, `burn_rate`, `cash_balance`, `runway_months` |
| `data_completeness` | Which data sources are connected per org | `stripe_connected`, `bank_connected`, `revenue_completeness` |
| `investor_updates` | AI-drafted investor update emails | `month`, `content`, `metrics_snapshot`, `sent_at` |

### 4.5 AI and Automation

| Table | What it stores | Key columns |
|-------|---------------|-------------|
| `chat_sessions` | Conversation containers | `title`, `user_id`, `org_id` |
| `chat_messages` | Individual messages (user + AI) | `role`, `content`, `intent`, `tokens_used`, `model_used` |
| `category_rules` | Automatic transaction categorization rules (system-wide) | `match_type`, `match_value`, `category` |
| `category_overrides` | Org-specific overrides for category rules | `description_pattern`, `category`, `org_id` |
| `workflow_runs` | History of automation runs | `workflow_id`, `status`, `summary_json`, `created_by` |

### 4.6 Security and Compliance

| Table | What it stores | Key columns |
|-------|---------------|-------------|
| `audit_log` | Record of who did what and when | `action`, `entity_type`, `entity_id`, `before_state`, `after_state`, `user_id`, `ip_address` |
| `voice_usage` | Voice/speech usage tracking per user | `user_id`, `date`, `duration_seconds` |

---

## 5. How Financial Data Gets In

There are three paths:

### Path 1: Scheduled Pull Sync (most common)

```
Every day at 2:00 AM UTC
         │
         ▼
  /api/cron/daily-sync
         │
         ├── For each connected org...
         │     └── For each active connection...
         │           └── Call provider API (e.g. Stripe /charges)
         │                 └── Normalize to Finvio schema
         │                       └── Upsert into transactions
         │                             (deduplication by source_ref_id)
         │
         └── Write to sync_logs (started_at, completed_at, records_synced)
```

**Deduplication:** Every transaction from an external source has a `source_ref_id` — the original ID from that platform (e.g. `ch_abc123` from Stripe). On each sync, Finvio uses `upsert` (insert-or-update by `source_ref_id`), so the same transaction is never created twice.

### Path 2: Webhooks (real-time)

Stripe, Mercury, and Lemon Squeezy can push events to Finvio immediately when something happens (new payment, transfer, subscription change).

```
Stripe / Mercury / Lemon Squeezy
         │
         │  HTTP POST to /api/webhooks/<provider>
         ▼
  Signature verification
  (HMAC-SHA256 check against webhook secret stored in connections table)
         │
         ├── Write raw event to webhook_events table
         │   (prevents duplicate processing — idempotent by event_id)
         │
         └── Apply change to transactions / subscriptions / customers
```

**Why is signature verification important?** It proves the event actually came from the platform, not from someone pretending to be Stripe. Without this check, anyone could POST fake data to Finvio.

### Path 3: CSV Import (manual)

Users can upload a CSV export from any platform. Finvio maps the columns, deduplicates against existing data, and inserts into `transactions`. The import record is saved to `csv_imports` for traceability.

---

## 6. How Credentials Are Stored

When you connect an account (e.g., authorize Stripe via OAuth), Finvio receives an **access token** — a string that lets us call Stripe's API on your behalf.

**These tokens are never stored in plain text.**

```
Raw token from OAuth:
  "sk_live_AbCdEfGh..."
          │
          ▼
  encrypt(token) using AES-256-GCM
          │
          ├── Random 12-byte IV (initialization vector)   ← different every time
          ├── 128-bit authentication tag                  ← proves the data wasn't tampered with
          └── Ciphertext
          │
          ▼
  Stored in connections.encrypted_access_token:
  "a3f2b1...:9d8e7c...:4b5a6f..."
   (IV hex)  (tag hex)  (ciphertext hex)
```

**The encryption key** (`ENCRYPTION_KEY`) is a 32-byte secret stored only in the server environment variables (`.env`). It is never committed to source code and never stored in the database. Without this key, the stored tokens are meaningless ciphertext.

**What this means practically:**
- Even if someone obtained a database backup, they could not extract usable API tokens without also having the encryption key.
- The encryption key and the database are stored in different systems (environment secrets vs. Supabase).

---

## 7. How Metrics Are Calculated

Metrics are computed **on demand** from the raw data already in the database. They are not pre-aggregated by default (except `monthly_snapshots`, which the Month-End Close workflow creates).

### MRR (Monthly Recurring Revenue)

```
                 Does the org have active subscriptions?
                          │
              ┌───────────┴───────────┐
             YES                      NO
              │                       │
              ▼                       ▼
  Sum subscriptions.amount      Fallback: sum income
  for active subscriptions      transactions for the month
  (annual ÷ 12, quarterly ÷ 3)  (excluding one_time revenue)
              │                       │
              └───────────┬───────────┘
                          ▼
                     MRR value
                  (+ warning if estimated)
```

Subscriptions are the authoritative source. The transaction fallback is used when no payment processor is connected — it shows a warning so the user knows the number is an estimate.

### Burn Rate

```
  Average monthly expenses over the last 3 months
  (from transactions WHERE type = 'expense' AND deleted_at IS NULL)
```

### Runway

```
  Cash balance (from bank transactions)  ÷  Burn rate
  = Months of runway remaining
```

### P&L (Profit & Loss)

```
  Revenue: SUM of income transactions grouped by category
  Expenses: SUM of expense transactions grouped by category
  Net income = Revenue − Expenses
  (filtered by date range, excludes deleted transactions)
```

---

## 8. AI Features and What Data They See

Finvio uses AI (OpenAI or Anthropic) in two places:

### 8.1 Transaction Categorization

When categorizing a transaction, **only the transaction description and type are sent to the AI model** — not the amount, date, customer name, account number, or any other identifying information.

```
What we send to the AI model:
  "Categorize this expense transaction: 'AWS EC2 charges'"
  "Valid categories: Software, Infrastructure, Marketing, ..."

What we do NOT send:
  ✗ Amount ($1,234.56)
  ✗ Account number
  ✗ Customer name
  ✗ Organization name
  ✗ Any other PII
```

The AI returns a category name. That category is saved to the `transactions` table with `category_method = 'ai'` so you can always see which transactions were AI-categorized vs. rule-based vs. manually set.

### 8.2 AI Advisor (Chat)

When you ask the AI advisor a question like "What is my burn rate this month?", the flow is:

```
Your question
      │
      ▼
Intent detection (local, no AI call yet)
  → "burn_rate" intent detected
      │
      ▼
Query the database for your org's data
  → getBurnRate(orgId) → reads transactions table
      │
      ▼
Summarize the relevant numbers
  → "Burn rate: $12,400, Runway: 8.2 months"
      │
      ▼
Send to AI model:
  [System prompt: you are a financial advisor for this company]
  [Injected data: burn rate = $12,400, runway = 8.2 months, ...]
  [User question: "What is my burn rate this month?"]
      │
      ▼
AI generates a plain-language response
      │
      ▼
Saved to chat_messages table (role, content, intent, tokens_used)
```

**The AI never has direct database access.** It only sees the specific numbers we pre-fetch and inject into the prompt. No raw transaction lists, customer emails, or account credentials are ever included in AI prompts.

Chat history is stored in `chat_sessions` and `chat_messages`, scoped to your org.

---

## 9. Audit Trail

### audit_log table

The `audit_log` table records significant actions — who did what, to which record, and what changed.

| Column | What it records |
|--------|----------------|
| `action` | What happened (`created`, `updated`, `deleted`, `connected`, etc.) |
| `entity_type` | What kind of record was affected (`transaction`, `invoice`, `connection`) |
| `entity_id` | The ID of the specific record |
| `before_state` | The record's data before the change (JSON snapshot) |
| `after_state` | The record's data after the change (JSON snapshot) |
| `user_id` | Which Finvio user made the change |
| `ip_address` | The IP address the request came from |
| `user_agent` | The browser or API client used |
| `created_at` | Exact timestamp |

### sync_logs table

Every sync run writes a record to `sync_logs`:
- Which provider was synced
- How many records were synced or skipped
- Whether it succeeded or failed
- Error message if failed
- Start and end timestamps

### workflow_runs table

Every automation run is recorded:
- Which workflow ran
- Who triggered it
- Start and end times
- Final status (completed / completed with warnings / failed)
- Full step-by-step result (stored as JSON in `summary_json`)

### webhook_events table

Every incoming webhook payload is saved verbatim before processing. This means:
- If a webhook fails to process, the raw event is preserved for reprocessing
- Duplicate events can be detected and skipped by `event_id`
- There is a permanent record of every event sent by external platforms

---

## 10. Data Deletion and Soft Deletes

### Transactions use soft deletes

When a transaction is "deleted" (either by the user or when disconnecting an integration), the row is **not removed from the database**. Instead, a `deleted_at` timestamp is set:

```sql
-- What a deleted transaction looks like:
id: "txn-abc-123"
amount: 500.00
description: "AWS"
deleted_at: "2026-05-15T10:30:00Z"   ← marked deleted, not removed
```

Every query that reads transactions automatically filters `WHERE deleted_at IS NULL`. This means:
- Deleted transactions are invisible in all reports and dashboards
- They can be recovered if needed (by an engineer with database access)
- The historical record is preserved for compliance purposes

### Full deletion on account closure

When a user requests account deletion (per the Privacy Policy), all associated data — transactions, connections, invoices, customers, etc. — is fully removed from the database within 90 days.

---

## 11. Access Control Layers

Finvio has four layers of access control:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: HTTPS / TLS 1.2+                                          │
│  All data in transit is encrypted. Applies to browser ↔ server,     │
│  server ↔ Supabase, server ↔ external APIs.                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│  Layer 2: Route-level authentication (proxy.ts middleware)           │
│  Every request to any non-public page checks: is there a valid       │
│  Supabase session cookie? If not, redirect to /login.               │
│  Public paths (/login, /privacy, /terms, /) bypass this check.      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│  Layer 3: Application-level org check                                │
│  Every API route resolves the user's org_id from org_members.        │
│  API calls always use the resolved org_id, never a client-supplied   │
│  one. Users cannot access another org by changing a URL parameter.  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│  Layer 4: Row Level Security (RLS) in PostgreSQL                     │
│  Database enforces org_id isolation at the query level.              │
│  Even a compromised application cannot read another tenant's data    │
│  because PostgreSQL rejects the query before returning results.      │
└─────────────────────────────────────────────────────────────────────┘
```

### Who at Finvio can access your data?

| Access level | Who has it | What they can do |
|---|---|---|
| **Anon key** (public) | Anyone with the app | Can only see data after passing Layers 1–4 above |
| **Service role key** | Finvio engineers (server-side only) | Can bypass RLS — used only for cron jobs and admin operations |
| **Database host (Supabase)** | Supabase (infrastructure provider) | Can access raw database backups; governed by Supabase's Data Processing Agreement |

Engineers who access production data directly are bound by confidentiality agreements. Any access for debugging or support purposes is noted in internal logs.

---

## 12. Security Summary for Auditors

This section is a condensed checklist for security reviews, compliance assessments, or integration partner approvals.

### Data storage

| Item | Status | Detail |
|---|---|---|
| Data at rest encryption | ✅ | AES-256 via Supabase (PostgreSQL hosted on AWS) |
| Credentials encrypted before storage | ✅ | AES-256-GCM with per-value random IV; application-layer encryption |
| Credentials stored as plaintext | ❌ Never | `encrypted_access_token` / `encrypted_refresh_token` columns only |
| Encryption key separate from data | ✅ | Key in environment secrets; data in Supabase |

### Data in transit

| Item | Status | Detail |
|---|---|---|
| TLS on all connections | ✅ | TLS 1.2+ on browser ↔ server, server ↔ Supabase, server ↔ external APIs |
| Webhook signature verification | ✅ | HMAC-SHA256 on all inbound webhooks (Stripe, Mercury, Lemon Squeezy) |

### Access control

| Item | Status | Detail |
|---|---|---|
| Multi-tenant isolation | ✅ | Row Level Security enforced at database level |
| Session management | ✅ | Supabase Auth (JWT); httpOnly cookies, Secure flag in production |
| CSRF protection on OAuth | ✅ | State parameter in all OAuth flows; verified on callback |

### Data minimization

| Item | Status | Detail |
|---|---|---|
| Minimum necessary scopes | ✅ | Read-only scopes where possible (Brex, Shopify, Gmail, Outlook) |
| PII excluded from AI prompts | ✅ | Only transaction descriptions sent; no amounts, names, or account numbers |
| No advertising use of data | ✅ | Data used solely to provide the Service |

### Auditability

| Item | Status | Detail |
|---|---|---|
| Audit log | ✅ | `audit_log` table; records action, before/after, user, IP, timestamp |
| Sync history | ✅ | `sync_logs` table; every sync recorded with outcome |
| Webhook history | ✅ | `webhook_events` table; raw payloads preserved |
| Soft deletes on transactions | ✅ | `deleted_at` flag; records not physically removed |
| User can disconnect at any time | ✅ | Settings → Connections → Disconnect |
| User data export on request | ✅ | Available via email to hello@finvio.ai (within 30 days) |
| Data deletion on closure | ✅ | Full deletion within 90 days of account termination |

### Infrastructure

| Item | Detail |
|---|---|
| Database host | Supabase (PostgreSQL on AWS) |
| Application host | Vercel (Next.js, serverless functions) |
| AI providers | OpenAI and/or Anthropic (configurable per org) |
| Data residency | US (AWS us-east-1 / Vercel default) |

---

*Last updated: 2026-06-01*
*For questions about this document: hello@finvio.ai*

---

## 13. Complete Table Schema — Column by Column

This section documents every table and every column in the database. For each column the type, purpose, and allowed values are explained in plain English.

> **Reading guide:** `PK` = primary key, `FK` = foreign key (links to another table), `nullable` = the field can be empty/null.

---

### `organizations`
*One row per company that uses Finvio. This is the root of all tenant data.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Unique identifier for the org. Every other table references this. |
| `name` | text | Company name, e.g. "Acme Corp". |
| `owner_id` | UUID FK → auth.users | The user who created the account. |
| `currency` | text | Default display currency, e.g. `"USD"`. Defaults to `"USD"`. |
| `fiscal_year_start` | integer nullable | Month the fiscal year starts (1 = January). Null means calendar year. |
| `industry` | text nullable | Industry tag for AI context, e.g. `"SaaS"`, `"E-commerce"`. |
| `created_at` | timestamptz | When the org was created. |
| `updated_at` | timestamptz | Last time any org setting was changed. |

---

### `org_members`
*Maps users to organizations. Supports multi-user orgs.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org this membership belongs to. |
| `user_id` | UUID FK → auth.users | Which Supabase Auth user. |
| `role` | text | User's role within the org. Currently `"owner"` or `"member"`. |
| `created_at` | timestamptz | When the user joined the org. |

*An org can have multiple members. Every user must appear in this table to access any org data.*

---

### `user_settings`
*Per-user preferences. One row per user.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `user_id` | UUID FK → auth.users | Which user. |
| `org_id` | UUID FK nullable → organizations | Org context for this setting row. |
| `theme` | text nullable | UI theme preference: `"light"` or `"dark"`. |
| `llm_provider` | text nullable | Which AI provider to use: `"openai"` or `"anthropic"`. |
| `llm_model` | text nullable | Specific model ID, e.g. `"gpt-4o-mini"`, `"claude-haiku-4-5"`. |
| `notification_prefs` | jsonb nullable | JSON blob of notification settings (email alerts, etc). |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

---

### `connections`
*One row per integration per org. Stores the credentials and sync state for each connected platform.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org owns this connection. |
| `provider` | text | Platform name: `"stripe"`, `"brex"`, `"mercury"`, `"shopify"`, `"quickbooks"`, `"paypal"`, `"plaid"`, `"lemonsqueezy"`, `"gmail"`, `"outlook"`. |
| `status` | text | `"active"`, `"disconnected"`, `"error"`, `"setup"`. |
| `account_name` | text nullable | Human-readable label for the connected account, e.g. `"Mercury — Checking"`. |
| `encrypted_access_token` | text nullable | OAuth access token or API key, AES-256-GCM encrypted. Format: `iv:tag:ciphertext` (hex). |
| `encrypted_refresh_token` | text nullable | OAuth refresh token or webhook secret, encrypted the same way. |
| `encrypted_item_id` | text nullable | Plaid-specific: encrypted Plaid item ID for bank link. |
| `sync_cursor` | text nullable | Pagination cursor from the last sync — where to resume the next pull. |
| `last_synced_at` | timestamptz nullable | Timestamp of the most recent successful sync. |
| `metadata` | jsonb nullable | Provider-specific extra data, e.g. `{"sandbox": true, "balance": 42000, "webhook_id": "wh_..."}`. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

*Unique constraint: one row per `(org_id, provider)` pair.*

---

### `sync_logs`
*Immutable history of every sync run. Never updated after writing.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `connection_id` | UUID FK nullable → connections | Which connection was synced. |
| `provider` | text | Platform name (redundant with connection for easy querying). |
| `sync_type` | text | `"pull"` (scheduled) or `"webhook"` (event-driven). |
| `status` | text | `"success"`, `"partial"`, `"failed"`. |
| `records_synced` | integer nullable | How many records were inserted or updated. |
| `records_skipped` | integer nullable | How many were skipped (duplicates, out of range, etc.). |
| `error_message` | text nullable | Full error text if the sync failed. |
| `started_at` | timestamptz | When the sync started. |
| `completed_at` | timestamptz nullable | When it finished (null if still running or crashed). |

---

### `webhook_events`
*Raw archive of every inbound webhook payload. Written before processing, never modified.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `provider` | text | `"stripe"`, `"mercury"`, `"lemonsqueezy"`. |
| `event_id` | text | The platform's own event ID (e.g. `evt_abc123` from Stripe). Used for deduplication. |
| `event_type` | text | Platform event name, e.g. `"charge.succeeded"`, `"invoice.payment_succeeded"`. |
| `payload` | jsonb | Full raw JSON body as received from the platform. |
| `status` | text nullable | Processing outcome: `"processed"`, `"skipped"` (duplicate), `"failed"`. |
| `error` | text nullable | Error message if processing failed. |
| `created_at` | timestamptz | When the event arrived. |
| `processed_at` | timestamptz nullable | When processing completed. |

*Unique constraint on `(provider, event_id)` — prevents the same event from being processed twice even if delivered more than once.*

---

### `csv_imports`
*Metadata about manual CSV file uploads. The actual imported rows go into `transactions`.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org uploaded the file. |
| `uploaded_by` | UUID nullable | Which user uploaded it. |
| `file_name` | text | Original filename, e.g. `"mercury-export-may.csv"`. |
| `file_type` | text | MIME type, e.g. `"text/csv"`. |
| `file_url` | text | Supabase Storage URL for the uploaded file. |
| `platform` | text nullable | Which platform the file came from: `"mercury"`, `"stripe"`, `"custom"`, etc. |
| `column_mapping` | jsonb nullable | The mapping the user configured: which CSV column maps to `date`, `amount`, etc. |
| `status` | text nullable | `"pending"`, `"processing"`, `"completed"`, `"failed"`. |
| `total_rows` | integer nullable | Total rows in the CSV. |
| `imported_rows` | integer nullable | Rows successfully imported. |
| `skipped_rows` | integer nullable | Rows skipped (duplicates or invalid). |
| `error_log` | jsonb nullable | Array of row-level errors, if any. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

---

### `transactions`
*The central table. Every income and expense event — from any source — lands here.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org this belongs to. |
| `type` | text | `"income"` or `"expense"`. |
| `amount` | numeric | Amount in the transaction's native currency. Always positive. |
| `amount_usd` | numeric nullable | Amount converted to USD at time of import (for multi-currency orgs). |
| `currency` | text | Currency code: `"USD"`, `"EUR"`, etc. |
| `date` | date | When the transaction occurred (not when it was imported). |
| `description` | text nullable | Original description from the source platform, e.g. `"AWS EC2 us-east-1"`. |
| `vendor` | text nullable | Cleaned vendor name, e.g. `"Amazon Web Services"`. |
| `source` | text | Where the data came from: `"stripe"`, `"mercury"`, `"brex"`, `"shopify"`, `"paypal"`, `"lemonsqueezy"`, `"plaid"`, `"quickbooks"`, `"manual"`, `"csv"`, `"gmail"`, `"outlook"`. |
| `source_ref_id` | text nullable | The platform's own ID for this transaction (used for deduplication). E.g. `"ch_abc123"` from Stripe. |
| `source_account` | text nullable | Which bank account or sub-account within the source. |
| `category` | text nullable | Assigned category, e.g. `"Infrastructure"`, `"Payroll"`, `"Subscription Revenue"`. |
| `subcategory` | text nullable | Optional finer-grained label within the category. |
| `category_method` | text nullable | How category was assigned: `"rule"` (automatic rule), `"ai"` (AI model), `"user"` (manually set). |
| `category_confidence` | text nullable | AI confidence level: `"high"`, `"medium"`, `"low"`. Only set when `category_method = 'ai'`. |
| `revenue_type` | text nullable | For income: `"recurring"`, `"one_time"`, `"project"`, `"milestone"`. |
| `recurrence` | text nullable | For expenses: `"monthly"`, `"quarterly"`, `"annual"`, `"one_time"`. Used in burn rate calculation. |
| `status` | text nullable | `"cleared"`, `"pending"`. |
| `is_reconciled` | boolean | Whether this transaction has been matched to another record (e.g. invoice). |
| `is_reviewed` | boolean | Whether a human has reviewed and approved this transaction. |
| `reconciled_with` | UUID FK nullable → transactions | ID of the counterpart transaction this is reconciled with. |
| `invoice_id` | UUID FK nullable → invoices | If this income transaction corresponds to an invoice, links here. |
| `customer_id` | UUID FK nullable → customers | Customer associated with this transaction. |
| `project_id` | UUID FK nullable → projects | Project this transaction is allocated to (for project P&L). |
| `receipt_url` | text nullable | Supabase Storage URL for an uploaded receipt image or PDF. |
| `notes` | text nullable | Free-text notes added by the user. |
| `tags` | text[] nullable | Array of user-defined tags, e.g. `["Q2", "marketing-campaign"]`. |
| `raw_metadata` | jsonb nullable | Original JSON payload from the source platform, preserved for reference. |
| `created_by` | UUID nullable | User ID who created this if manually entered. |
| `deleted_at` | timestamptz nullable | Soft delete timestamp. Non-null = deleted. All queries filter `WHERE deleted_at IS NULL`. |
| `created_at` / `updated_at` | timestamptz | Row timestamps. |

*Unique constraint: `(org_id, source, source_ref_id)` — prevents duplicate imports from the same platform.*

---

### `invoices`
*Invoices created in Finvio or imported from connected platforms.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `invoice_number` | text | Display number, e.g. `"INV-0042"`. |
| `source` | text nullable | `"finvio"` (created in the app), or platform name if imported. |
| `external_id` | text nullable | The platform's own invoice ID (for imported invoices). |
| `customer_name` | text nullable | Bill-to name. |
| `customer_email` | text nullable | Bill-to email. Finvio uses this to send the PDF. |
| `vendor_name` | text nullable | From-name on the invoice (usually the org's name). |
| `amount` | numeric | Subtotal before tax. |
| `tax_amount` | numeric nullable | Tax portion. |
| `total_amount` | numeric nullable | `amount + tax_amount`. |
| `currency` | text nullable | Currency code. |
| `status` | text | `"draft"`, `"sent"`, `"paid"`, `"overdue"`, `"cancelled"`. |
| `invoice_date` | date nullable | Date printed on the invoice. |
| `due_date` | date nullable | Payment due date. Overdue detection compares this to today. |
| `paid_at` | timestamptz nullable | When payment was received. |
| `line_items` | jsonb nullable | Array of `{description, quantity, unitPrice, amount}` objects. |
| `notes` | text nullable | Footer notes on the invoice. |
| `created_by` | UUID nullable | Which user created this invoice. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

---

### `customers`
*Customer records synced from Stripe, Lemon Squeezy, or added manually.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `source` | text nullable | `"stripe"`, `"lemonsqueezy"`, `"manual"`. |
| `external_id` | text nullable | Platform's customer ID, e.g. `"cus_abc123"` from Stripe. |
| `name` | text nullable | Customer's full name or company name. |
| `email` | text nullable | Customer's email address. |
| `status` | text nullable | `"active"` or `"inactive"`. Active = currently paying. |
| `mrr` | numeric nullable | This customer's monthly contribution to MRR. |
| `total_revenue` | numeric nullable | Lifetime revenue from this customer. |
| `plan` | text nullable | Subscription plan name, e.g. `"Pro"`, `"Enterprise"`. |
| `first_seen` | date nullable | First transaction date with this customer. |
| `last_seen` | date nullable | Most recent transaction date. |
| `churned_at` | date nullable | When this customer cancelled. |
| `metadata` | jsonb nullable | Extra platform-specific data. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

---

### `subscriptions`
*Individual subscription records — the primary source for MRR calculation.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `customer_id` | UUID FK nullable → customers | Which customer holds this subscription. |
| `source` | text | `"stripe"`, `"lemonsqueezy"`. |
| `external_id` | text nullable | Platform's subscription ID. |
| `plan_name` | text nullable | Name of the plan, e.g. `"Starter Monthly"`. |
| `amount` | numeric | Subscription price at the current `interval`. |
| `interval` | text nullable | Billing cadence: `"month"`, `"year"`. Annual subscriptions are divided by 12 when calculating MRR. |
| `status` | text | `"active"`, `"cancelled"`, `"past_due"`, `"trialing"`. Only `"active"` counts toward MRR. |
| `current_period_start` | date nullable | Start of the current billing period. |
| `current_period_end` | date nullable | End of the current billing period. |
| `cancelled_at` | timestamptz nullable | When cancelled. Used in churn rate calculation. |
| `metadata` | jsonb nullable | Extra platform data. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

---

### `expense_reports`
*Employee expense submissions. Separate from transactions — these go through an approval workflow.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `submitter_id` | UUID nullable | Which user submitted the expense. |
| `submitter_name` | text nullable | Display name of the submitter. |
| `title` | text | Short description, e.g. `"Client dinner — May"`. |
| `amount` | numeric | Amount claimed. |
| `currency` | text nullable | Currency. |
| `category` | text | Expense category. |
| `date` | date | Date the expense occurred. |
| `receipt_url` | text nullable | Supabase Storage URL for the receipt. |
| `notes` | text nullable | Submitter's notes. |
| `status` | text nullable | `"pending"`, `"approved"`, `"rejected"`. |
| `reviewed_by` | UUID nullable | User ID who approved or rejected it. |
| `reviewed_at` | timestamptz nullable | When it was reviewed. |
| `transaction_id` | UUID FK nullable → transactions | Once approved, linked to the resulting transaction. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

---

### `projects`
*Budget and P&L tracking at the project level.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `name` | text | Project name. |
| `client` | text nullable | Client name. |
| `description` | text nullable | Free text. |
| `status` | text | `"active"`, `"completed"`, `"on_hold"`, `"cancelled"`. |
| `budget` | numeric nullable | Total budgeted amount. |
| `currency` | text | Currency for this project's budget. |
| `start_date` / `end_date` | date nullable | Project timeline. |
| `metadata` | jsonb nullable | Extra fields. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

*Transactions can be linked to a project via `transactions.project_id`. Project P&L = sum of linked income minus sum of linked expenses.*

---

### `monthly_snapshots`
*Pre-computed metric snapshots per month. Written by the Month-End Close workflow.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `month` | date | First day of the month this snapshot covers, e.g. `"2026-05-01"`. |
| `mrr` | numeric nullable | MRR as of that month. |
| `arr` | numeric nullable | ARR = MRR × 12. |
| `burn_rate` | numeric nullable | Average monthly expenses. |
| `cash_balance` | numeric nullable | Cash position at month-end. |
| `net_income` | numeric nullable | Revenue − Expenses for the month. |
| `total_revenue` | numeric nullable | Sum of all income transactions for the month. |
| `total_expenses` | numeric nullable | Sum of all expense transactions for the month. |
| `active_customers` | integer nullable | Active customer count at month-end. |
| `new_customers` | integer nullable | Customers acquired during the month. |
| `churned_customers` | integer nullable | Customers lost during the month. |
| `churn_rate` | numeric nullable | Churn rate as a decimal, e.g. `0.03` = 3%. |
| `runway_months` | numeric nullable | Projected runway in months. |
| `computed_at` | timestamptz | When this snapshot was last computed. |

*Unique constraint: one row per `(org_id, month)`. Re-running month-end upserts over the existing row.*

---

### `category_rules`
*System-wide rules for automatically categorizing transactions by description matching.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID nullable FK → organizations | Null = applies to all orgs (system rule). Non-null = org-specific rule. |
| `match_type` | text | How to match: `"contains"`, `"starts_with"`, `"exact"`, `"regex"`. |
| `match_value` | text | The pattern to match against `transactions.description`, e.g. `"AWS"`, `"Stripe"`. |
| `category` | text | Category to assign when matched. |
| `subcategory` | text nullable | Optional subcategory. |
| `priority` | integer nullable | Higher number = applied first. |
| `is_active` | boolean | Whether this rule is enabled. |
| `created_at` | timestamptz | When the rule was created. |

---

### `category_overrides`
*Per-org rules that take priority over system `category_rules`.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org set this override. |
| `description_pattern` | text | String to match against the transaction description. |
| `category` | text | Category to assign. |
| `subcategory` | text nullable | Optional subcategory. |
| `created_at` | timestamptz | When set. |

*Applied before both system rules and AI. If a description matches an override, AI is never called for that transaction.*

---

### `chat_sessions`
*Container for a single conversation thread in the AI Advisor.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `user_id` | UUID FK → auth.users | Which user started the session. |
| `title` | text nullable | Auto-generated or user-set title, e.g. `"Burn rate analysis — May"`. |
| `created_at` / `updated_at` | timestamptz | Timestamps. `updated_at` reflects the last message. |

---

### `chat_messages`
*Individual messages within a session. Stores both user messages and AI responses.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `session_id` | UUID FK → chat_sessions | Which conversation. |
| `org_id` | UUID FK → organizations | Denormalized for efficient RLS filtering. |
| `role` | text | `"user"` or `"assistant"`. |
| `content` | text | The message text. |
| `intent` | text nullable | Detected intent, e.g. `"query_burn"`, `"create_invoice"`. See intent list in Section 8. |
| `data_context` | jsonb nullable | The financial data that was fetched and injected into the AI prompt for this message. |
| `function_calls` | jsonb nullable | Any structured actions the AI requested (e.g. create invoice, add expense). |
| `execution_result` | jsonb nullable | Result of executing those actions. |
| `model_used` | text nullable | Which AI model generated this response, e.g. `"gpt-4o-mini"`. |
| `tokens_used` | integer nullable | Token count for the AI call (for usage tracking). |
| `created_at` | timestamptz | When the message was sent. |

---

### `audit_log`
*Permanent record of significant actions. Rows are never updated or deleted.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org the action occurred in. |
| `user_id` | UUID nullable | Who performed the action. Null for system/automated actions. |
| `action` | text | What happened: `"created"`, `"updated"`, `"deleted"`, `"connected"`, `"disconnected"`, `"exported"`. |
| `entity_type` | text | What kind of object was affected: `"transaction"`, `"invoice"`, `"connection"`, `"user"`. |
| `entity_id` | UUID nullable | The ID of the specific record that was affected. |
| `before_state` | jsonb nullable | Snapshot of the record before the change. For `"created"` actions, this is null. |
| `after_state` | jsonb nullable | Snapshot of the record after the change. For `"deleted"` actions, this is null. |
| `ip_address` | text nullable | IP address of the request. |
| `user_agent` | text nullable | Browser or API client string. |
| `created_at` | timestamptz | When the action happened. |

---

### `workflow_runs`
*One row per automation run. Written when a workflow starts; updated when it finishes.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org triggered the run. |
| `workflow_id` | text | Identifier matching the workflow definition, e.g. `"month-end"`, `"bank-reconciliation"`. |
| `workflow_name` | text | Human-readable name, e.g. `"Month-End Close"`. |
| `status` | text | `"running"`, `"completed"`, `"completed_with_warnings"`, `"failed"`. |
| `started_at` | timestamptz | When the run began. |
| `completed_at` | timestamptz nullable | When it finished. Null if still running. |
| `created_by` | UUID FK nullable → auth.users | Which user triggered it. |
| `summary_json` | jsonb nullable | Full step-by-step result. Schema: `{steps: [{id, name, status, message, warnings}], summary: string, totalWarnings: number}`. |

---

### `data_completeness`
*One row per org. Summarizes which data sources are connected.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK (unique) → organizations | One row per org. |
| `stripe_connected` | boolean | Is Stripe active? |
| `bank_connected` | boolean | Is any bank (Plaid / Mercury / Brex) active? |
| `shopify_connected` | boolean | Is Shopify active? |
| `paypal_connected` | boolean | Is PayPal active? |
| `has_manual_entries` | boolean | Are there manually entered transactions? |
| `has_csv_imports` | boolean | Have any CSVs been imported? |
| `revenue_completeness` | text | `"high"` / `"medium"` / `"low"` — how reliable is revenue data. |
| `expense_completeness` | text | Same for expenses. |
| `last_assessed_at` | timestamptz | When completeness was last recalculated. |

---

### `investor_updates`
*Saved investor update drafts and sent history.*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Row identifier. |
| `org_id` | UUID FK → organizations | Which org. |
| `month` | text | Which month this update covers, e.g. `"2026-05"`. |
| `period` | text | Display label, e.g. `"May 2026"`. |
| `content` | text | Full email body, typically AI-drafted. |
| `metrics_snapshot` | jsonb nullable | The financial metrics included in the update at time of generation. |
| `status` | text nullable | `"draft"` or `"sent"`. |
| `sent_at` | timestamptz nullable | When it was sent. |
| `sent_to` | text[] nullable | Array of email addresses it was sent to. |
| `created_by` | UUID nullable | Which user generated it. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

---

### `voice_usage`
*Tracks voice/speech feature usage per user per day.*

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID PK part | Which user. |
| `date` | date PK part | Which day. |
| `duration_seconds` | numeric | Total seconds of voice usage on that day. |

*Composite primary key `(user_id, date)` — one row per user per day.*

---

## 14. Metric Calculation Deep Dive

This section documents exactly how each metric shown on the Finvio dashboard is computed — which tables are queried, what filters are applied, and the mathematical formula used.

---

### 14.1 MRR (Monthly Recurring Revenue)

**What it represents:** The normalized monthly revenue from recurring subscriptions.

**Calculation flow:**

```
Step 1 — Try subscriptions table (authoritative source)
────────────────────────────────────────────────────────
Query: subscriptions
  WHERE org_id = ?
    AND status = 'active'
    AND current_period_start <= first_day_of_next_month

For each subscription:
  if interval = 'year'  → contribution = amount / 12
  if interval = 'month' → contribution = amount

MRR = SUM of all contributions

If any active subscriptions found → return this value.
```

```
Step 2 — Fallback to transactions (when no payment processor is connected)
────────────────────────────────────────────────────────────────────────────
Query: transactions
  WHERE org_id = ?
    AND type = 'income'
    AND deleted_at IS NULL
    AND recurrence != 'one_time'   ← one-time revenue excluded from MRR
    AND date >= first_day_of_month
    AND date <  first_day_of_next_month

For each transaction:
  if recurrence = 'annual'    → contribution = amount / 12
  if recurrence = 'quarterly' → contribution = amount / 3
  if recurrence = 'monthly'   → contribution = amount
  if recurrence = null        → contribution = amount (backward compat)

MRR = SUM of all contributions
⚠ Warning shown: "MRR estimated from transactions"
```

**Tables used:** `subscriptions` (primary), `transactions` (fallback)

---

### 14.2 ARR (Annual Recurring Revenue)

ARR is not independently calculated. It is derived from MRR:

```
ARR = MRR × 12
```

**Tables used:** Same as MRR.

---

### 14.3 Burn Rate

**What it represents:** Average monthly cash outflow from recurring expenses.

```
Query: transactions
  WHERE org_id = ?
    AND type = 'expense'
    AND deleted_at IS NULL
    AND date >= 12 months ago        ← wide window to catch annual expenses

Group by recurrence tag, then normalize each group to a monthly rate:

┌─────────────────┬─────────────────────────────────────────────────────────┐
│ recurrence      │ Contribution to burn rate                                │
├─────────────────┼─────────────────────────────────────────────────────────┤
│ 'monthly'       │ SUM(amount for last 3 months) / number of months with    │
│                 │ monthly expenses (avoids dilution from empty months)      │
├─────────────────┼─────────────────────────────────────────────────────────┤
│ 'quarterly'     │ Group by quarter → average quarterly spend / 3           │
├─────────────────┼─────────────────────────────────────────────────────────┤
│ 'annual'        │ Group by year → average annual spend / 12                │
├─────────────────┼─────────────────────────────────────────────────────────┤
│ 'one_time'      │ Excluded entirely. One-time purchases don't recur.       │
│                 │ ⚠ Warning shown: "$X in one-time expenses excluded"      │
├─────────────────┼─────────────────────────────────────────────────────────┤
│ null            │ Excluded. Cannot assume frequency.                        │
│                 │ ⚠ Warning shown: "N expenses have no recurrence tag"     │
└─────────────────┴─────────────────────────────────────────────────────────┘

Burn Rate = monthly_contribution + quarterly_contribution + annual_contribution
```

**Tables used:** `transactions`

---

### 14.4 Cash Balance

**What it represents:** Current cash on hand.

```
Step 1 — Try live balance from bank connection metadata (most accurate)
────────────────────────────────────────────────────────────────────────
Query: connections
  WHERE org_id = ?
    AND provider IN ('plaid', 'mercury', 'brex')
    AND status = 'active'

Sum up connections.metadata->>'balance' for all active bank connections.
If any have a balance → return sum as cash balance.
```

```
Step 2 — Fallback to transaction arithmetic
────────────────────────────────────────────
Query: transactions
  WHERE org_id = ?
    AND deleted_at IS NULL
    (no date filter — all-time)

Cash = SUM(amount WHERE type = 'income') − SUM(amount WHERE type = 'expense')
⚠ Warning shown: "Cash balance estimated from transactions"
```

**Tables used:** `connections` (primary), `transactions` (fallback)

---

### 14.5 Net Burn

```
Net Burn = Burn Rate − MRR

Positive net burn → spending more than earning → burning cash
Negative net burn → earning more than spending → profitable
```

**Tables used:** Same as MRR + Burn Rate.

---

### 14.6 Runway

```
If Net Burn ≤ 0 → Runway = "infinite" (profitable, not burning)
If Cash ≤ 0    → Runway = 0

Otherwise:
  Runway (months) = FLOOR(Cash Balance / Net Burn)
```

**Tables used:** `connections`, `subscriptions`, `transactions`

---

### 14.7 Churn Rate

**What it represents:** Percentage of customers who cancelled in a given month.

```
Query 1: subscriptions
  WHERE org_id = ?
    AND status = 'active'
    AND started_at <= first_day_of_month
  → count = customers active at start of month

Query 2: subscriptions
  WHERE org_id = ?
    AND status = 'cancelled'
    AND cancelled_at >= first_day_of_month
    AND cancelled_at <  first_day_of_next_month
  → count = customers who churned during the month

Churn Rate = churned_count / start_count

Example: 3 churned out of 50 active → churn rate = 0.06 (6%)
```

**Tables used:** `subscriptions`

---

### 14.8 Active Customer Count

```
Query: customers
  WHERE org_id = ?
    AND status = 'active'
  COUNT(*)
```

**Tables used:** `customers`

---

### 14.9 P&L (Profit and Loss) Report

```
Query: transactions
  WHERE org_id = ?
    AND deleted_at IS NULL
    AND date >= first_day_of_month
    AND date <  first_day_of_next_month

Group by (type, category):
  income transactions  → Revenue lines
  expense transactions → Expense lines

Revenue line: { category: "Subscription Revenue", amount: 12400, count: 18 }
Expense line: { category: "Infrastructure",       amount:  3200, count:  7 }

Total Revenue  = SUM of all income amounts
Total Expenses = SUM of all expense amounts
Net Income     = Total Revenue − Total Expenses
```

**Tables used:** `transactions`

---

### 14.10 MRR Trend (6-Month Chart)

```
For each of the last 6 months (in parallel):
  Call getMRR(orgId, month)  ← same logic as 14.1 above

Returns array of: { month, mrr, arr }
Used to draw the MRR trend chart on the dashboard.
```

**Tables used:** `subscriptions`, `transactions`

---

### 14.11 Revenue by Type

```
Query: transactions
  WHERE org_id = ?
    AND type = 'income'
    AND deleted_at IS NULL
    AND date in target month

Group by revenue_type:
  'recurring'    → SUM
  'one_time'     → SUM
  'project'      → SUM
  'milestone'    → SUM
  null/other     → 'unclassified' SUM
```

**Tables used:** `transactions`

---

### 14.12 Data Completeness Score

```
Query: connections WHERE org_id = ?
  → build map of provider → status

Query: transactions WHERE org_id = ? AND source = 'manual' → count
Query: transactions WHERE org_id = ? AND source = 'csv' → count

Score calculation:
  Stripe active?          +30 points
  Bank active?            +30 points  (any of: plaid, mercury, brex)
  Shopify active?         +10 points
  PayPal active?          +10 points
  Manual entries exist?   +10 points
  CSV imports exist?      +10 points
  ─────────────────────────────────
  Max possible:           100 points

Revenue completeness:
  high   = Stripe connected
  medium = Shopify or PayPal connected
  low    = manual/CSV only

Expense completeness:
  high   = bank (Plaid/Mercury/Brex) connected
  medium = manual entries or CSV imports
  low    = nothing
```

**Tables used:** `connections`, `transactions`

---

### 14.13 Business Model Detection

```
Signal 1 — Active subscriptions:
  Query: subscriptions WHERE org_id = ? AND status = 'active' → count

Signal 2 — Revenue type distribution (last 90 days):
  Query: transactions
    WHERE org_id = ? AND type = 'income' AND deleted_at IS NULL
      AND date >= 90 days ago

  recurringRatio = count(revenue_type IN ('recurring','Subscription Revenue')) / total
  projectRatio   = count(revenue_type IN ('project','milestone')) / total

Decision:
  activeSubs > 0  OR recurringRatio > 0.30 → hasRecurring = true
  projectRatio > 0.25                       → hasProject = true

  hasRecurring AND hasProject → model = "mixed"
  hasRecurring only           → model = "saas"
  hasProject only             → model = "project_based"
  neither                     → model = "smb"
```

This affects how the dashboard displays metrics (SaaS shows MRR/ARR; project-based shows pipeline; SMB shows average monthly revenue).

**Tables used:** `subscriptions`, `transactions`

---

### 14.14 Revenue Forecast

Two forecast modes depending on detected business model:

**SaaS forecast:**
```
Inputs:
  currentMRR     (from subscriptions / transactions)
  burnRate       (from transactions)
  currentCash    (from connections.metadata or transactions)
  growthRate     (user-supplied, e.g. 10% per month)

For month i = 1 to N:
  projectedMRR      = currentMRR × (1 + growthRate)^i
  projectedExpenses = burnRate    (assumed constant)
  netCashFlow       = projectedMRR − projectedExpenses
  cash             += netCashFlow
  runway            = FLOOR(cash / max(projectedExpenses − projectedMRR, 0))
```

**SMB / project-based forecast:**
```
Inputs:
  Historical revenue per month for last 6 months
  → compute avg monthly growth rate from month-over-month changes
  → use most recent non-zero month as baseline

For month i = 1 to N:
  projectedRevenue = baseRevenue × (1 + avgGrowthRate)^i
  projectedExpenses = burnRate
  cash += projectedRevenue − projectedExpenses
```

**Tables used:** `subscriptions`, `transactions`, `connections`

---

### 14.15 Project P&L

```
For each project in projects WHERE org_id = ?:

  Query: transactions
    WHERE project_id = project.id
      AND deleted_at IS NULL

  collected  = SUM(amount WHERE type = 'income')
  expenses   = SUM(amount WHERE type = 'expense')
  outstanding = project.budget − collected   (if budget is set)
```

**Tables used:** `projects`, `transactions`

---

### 14.16 Transaction Categorization Pipeline

When a transaction arrives (from sync or manual entry) without a category, Finvio applies this pipeline:

```
New transaction (description, type, org_id)
        │
        ▼
Step 1: Check category_overrides
  WHERE org_id = ? AND description ILIKE '%' || description_pattern || '%'
  If match → assign category, mark category_method = 'rule', STOP

        │ no match
        ▼
Step 2: Check category_rules (org-specific first, then system-wide)
  WHERE (org_id = ? OR org_id IS NULL)
    AND is_active = true
  Apply match_type logic:
    'contains'   → description ILIKE '%match_value%'
    'starts_with'→ description ILIKE 'match_value%'
    'exact'      → description = match_value
    'regex'      → description ~ match_value
  Ordered by priority DESC
  If match → assign category, mark category_method = 'rule', STOP

        │ no match
        ▼
Step 3: AI categorization
  Send ONLY: description + type to AI model
  (no amounts, no account numbers, no customer names)
  AI returns a category from the allowed list
  Assign category, mark category_method = 'ai', confidence = 'low'
```

**Tables used:** `category_overrides`, `category_rules` (for rule matching); `transactions` (for the write)

---

### 14.17 AR Aging (Accounts Receivable)

Used by the AR Aging workflow and invoice views.

```
Query: invoices
  WHERE org_id = ?
    AND status IN ('sent', 'overdue')
    AND paid_at IS NULL

For each invoice:
  daysOverdue = today − due_date   (negative = not yet due)

Bucket assignment:
  daysOverdue ≤ 0  → "Current"
  1–30 days        → "1–30 days"
  31–60 days       → "31–60 days"
  61–90 days       → "61–90 days"
  > 90 days        → "90+ days"

High-risk customers: any customer with invoices ≥ 60 days overdue.
```

**Tables used:** `invoices`

---

*Last updated: 2026-06-01*
*For questions about this document: hello@finvio.ai*
