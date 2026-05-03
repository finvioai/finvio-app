# FinPilot — Full Application Developer Build Brief

> **For GitHub Copilot / AI Coding Agent**
> Read this entire document before writing a single line of code. Follow every instruction precisely.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [UI / Design Reference](#3-ui--design-reference)
4. [Supabase Setup — Database & Auth](#4-supabase-setup--database--auth)
5. [Database Schema (Full)](#5-database-schema-full)
6. [Row-Level Security (RLS)](#6-row-level-security-rls)
7. [Authentication](#7-authentication)
8. [Core Architecture Principles](#8-core-architecture-principles)
9. [Unified Financial Ledger](#9-unified-financial-ledger)
10. [Data Ingestion & Sync Strategy](#10-data-ingestion--sync-strategy)
11. [Transaction Categorization System](#11-transaction-categorization-system)
12. [Financial Metrics Engine](#12-financial-metrics-engine)
13. [Chat / AI Advisor System](#13-chat--ai-advisor-system)
14. [CSV & Manual Data Import](#14-csv--manual-data-import)
15. [Invoice System](#15-invoice-system)
16. [Application Pages & Features](#16-application-pages--features)
17. [Data Completeness System](#17-data-completeness-system)
18. [Security & Encryption](#18-security--encryption)
19. [LLM Provider Selection](#19-llm-provider-selection)
20. [Payments — LemonSqueezy (Reserved)](#20-payments--lemonsqueezy-reserved)
21. [Mobile Responsiveness](#21-mobile-responsiveness)
22. [Audit Trail](#22-audit-trail)
23. [Documentation Files to Generate](#23-documentation-files-to-generate)
24. [Folder Structure](#24-folder-structure)
25. [Environment Variables](#25-environment-variables)
26. [Clarifying Questions (Read Before Building)](#26-clarifying-questions-read-before-building)

---

## 1. Project Overview

**FinPilot** is a SaaS financial management and intelligence platform for startups and SMBs. It aggregates financial data from multiple sources (Stripe, Plaid bank connections, Shopify, PayPal, manual entry, and CSV imports) into a unified ledger, and provides:

- Real-time financial dashboards (MRR, ARR, burn rate, runway, P&L)
- AI-powered financial advisor chat (intent detection → DB queries → deterministic calculations → LLM response)
- Invoice management (internal MVP, extensible to Stripe later)
- Expense management and approval workflow
- Cash flow forecasting with scenario modeling
- Investor update generation
- Scenario modeling (hire, growth, fundraise)
- Data import (CSV, Excel) for unsupported platforms

**What FinPilot is NOT:** A traditional RAG system. It is a structured data query system. The LLM never calculates financial numbers.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| UI Components | shadcn/ui + Radix UI |
| Charts | Recharts or Tremor |
| Backend | Next.js API Routes (server-side only for external API calls) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + magic link, Google OAuth optional) |
| ORM | Supabase JS client + raw SQL for complex queries |
| File Uploads | Supabase Storage |
| External Connections | Stripe API, Plaid API, Quickbooks |
| LLM | Configurable — OpenAI, Anthropic Claude, or others (see Section 19) |
| Encryption | AES-256 via Node.js `crypto` module |
| Payments | LemonSqueezy (reserved — do NOT build yet, see Section 20) |
| Deployment | Vercel |
| Scheduled Jobs | Vercel Cron Jobs or Supabase Edge Functions |

This is not a BYO API for llm api, we are providing that ai llm layer by the product itself.

---

## 3. UI / Design Reference

> The developer has provided screenshots from a previously built version of FinPilot (images attached). Use these **only as a rough reference for layout and feature scope**. The actual production build must be **significantly more polished** than the reference screenshots.

### Design System Guidelines

- **Primary color:** Blue (`#2563EB` / Tailwind `blue-600`)
- **Background:** Off-white / very light gray (`#F8FAFC`)
- **Sidebar:** White with subtle border
- **Cards:** White, rounded-xl, subtle shadow (`shadow-sm`)
- **Typography:** Clean sans-serif (Inter or Geist)
- **Status badges:** Green for Approved/Active, Orange/Yellow for Pending, Red for Rejected/Overdue
- **Charts:** Blue bars for revenue, green for profit, gray for expenses
- **Spacing:** Generous padding — cards should breathe

### Layout

- **Desktop:** Fixed left sidebar (240px) + main content area
- **Mobile:** Bottom navigation or hamburger menu (fully responsive — see Section 21)
- **Dashboard:** 4-column KPI card row → wider cards row → charts + activity feed below
- **Tables:** Clean, bordered, with status badges and action buttons per row

### Key UI Screens (from reference images)

| Screen | Key Elements |
|---|---|
| Dashboard | MRR, Cash Balance, Runway, Active Customers KPI cards; ARR progress bar; Action Items; Quick Actions; Revenue Trend chart; Recent Activity feed |
| Revenue | MRR, ARR, Active Customers, Churn Rate cards; MRR Trend chart (bar); By Source tab |
| Expenses | Table: Report title, Submitter, Category, Date, Amount, Status (Pending/Approved); Submit Expense button |
| Invoices | Table: Invoice #, Vendor, Amount, Status, Due Date; New Invoice button |
| P&L Report | Month selector; Total Revenue, Total Expenses, Net Income KPIs; P&L Statement table with This Month / Last Month; Expense Breakdown tab; CSV and PDF export |
| Forecast | MRR Growth Rate slider; Forecast Period slider; Projected metrics; Revenue vs Expenses Projection bar chart |
| AI Advisor | Chat interface; suggested quick prompts; Try These sidebar panel |
| Scenario Modeling | Current Baseline bar; Hire / Growth / Fundraise tabs; Input form; Before/After comparison cards |
| Investor Updates | Key metrics display; AI-generated draft (editable); Draft / Send buttons |
| Connections | Revenue (Stripe, Shopify, PayPal), Banking (Plaid, Mercury, Brex), Accounting (QuickBooks, Xero, FreshBooks) integration cards with Connect/Disconnect/Sync buttons |

---

## 4. Supabase Setup — Database & Auth

> **INSTRUCTION FOR CODING AGENT:** Use the Supabase MCP to create all tables, policies, and configuration directly. Do not ask the developer to do this manually.Supabase MCP is already conneted with the project (finpilot-mvp), and the auto RLS has turned on. (means Every table needs explicit policies)

### Steps the Agent Must Perform via Supabase MCP

1. Connect to the Supabase project via MCP
2. Run all SQL from Section 5 to create tables
3. Run all RLS policies from Section 6
4. Enable Auth providers (see Section 7)
5. Create Supabase Storage buckets: `csv-imports`, `receipt-attachments`
6. Set up Edge Functions if needed for scheduled sync

---

## 5. Database Schema (Full)

> Create all tables below. All tables must have `created_at` and `updated_at` timestamps. Use UUIDs as primary keys throughout.

```sql
-- ============================================================
-- USERS / ORGANIZATIONS
-- ============================================================

-- organizations: one org per account (multi-user teams later)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  industry TEXT,claude finance
  currency TEXT NOT NULL DEFAULT 'USD',
  fiscal_year_start INT DEFAULT 1, -- month number (1=Jan)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- org_members: team access (future multi-user)
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner | admin | member | viewer
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- user_settings: per-user preferences
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  org_id UUID REFERENCES organizations(id),
  llm_provider TEXT DEFAULT 'openai', -- openai | anthropic | etc
  llm_model TEXT DEFAULT 'gpt-4o',
  theme TEXT DEFAULT 'light',
  notification_prefs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INTEGRATIONS / CONNECTIONS
-- ============================================================

-- connections: external platform credentials (ENCRYPTED)
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- stripe | plaid | shopify | paypal | mercury | brex | quickbooks | xero | freshbooks
  status TEXT NOT NULL DEFAULT 'disconnected', -- connected | disconnected | error | syncing
  encrypted_access_token TEXT,      -- AES-256 encrypted
  encrypted_refresh_token TEXT,     -- AES-256 encrypted
  encrypted_item_id TEXT,           -- Plaid item_id encrypted
  account_name TEXT,                -- display name e.g. "Mercury ••4821"
  metadata JSONB DEFAULT '{}',      -- provider-specific non-sensitive data
  last_synced_at TIMESTAMPTZ,
  sync_cursor TEXT,                 -- for incremental sync (e.g. Stripe starting_after)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, provider)
);

-- sync_logs: record of every sync attempt
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES connections(id),
  provider TEXT NOT NULL,
  sync_type TEXT NOT NULL, -- webhook | scheduled | on_demand | csv_import
  status TEXT NOT NULL, -- running | success | partial | failed
  records_synced INT DEFAULT 0,
  records_skipped INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- UNIFIED FINANCIAL LEDGER (CORE TABLE)
-- ============================================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Core fields
  type TEXT NOT NULL,         -- income | expense
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  amount_usd NUMERIC(15,2),   -- normalized for multi-currency calcs
  date DATE NOT NULL,
  description TEXT,

  -- Source tracking
  source TEXT NOT NULL,       -- stripe | plaid | shopify | paypal | manual | csv
  source_ref_id TEXT,         -- external ID (Stripe charge_id, Plaid transaction_id, etc.)
  source_account TEXT,        -- e.g. "Mercury ••4821"

  -- Categorization
  category TEXT,              -- Infrastructure | Marketing | SaaS | Contractors | Payroll | Revenue | etc.
  subcategory TEXT,
  category_method TEXT,       -- rule | ai | user
  category_confidence TEXT,   -- high | medium | low
  is_reviewed BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'cleared', -- pending | cleared | reconciled | excluded

  -- Reconciliation
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_with UUID REFERENCES transactions(id), -- link Stripe income to bank deposit

  -- Metadata
  vendor TEXT,
  customer_id UUID,           -- link to customers table if revenue
  invoice_id UUID,            -- link to invoices table if applicable
  receipt_url TEXT,           -- Supabase Storage URL
  notes TEXT,
  tags TEXT[],
  raw_metadata JSONB DEFAULT '{}', -- full original payload stored

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicates
  UNIQUE(org_id, source, source_ref_id)
);

-- Index for performance
CREATE INDEX idx_transactions_org_date ON transactions(org_id, date DESC);
CREATE INDEX idx_transactions_org_type ON transactions(org_id, type);
CREATE INDEX idx_transactions_org_category ON transactions(org_id, category);
CREATE INDEX idx_transactions_source_ref ON transactions(source, source_ref_id);
CREATE INDEX idx_transactions_is_reviewed ON transactions(org_id, is_reviewed) WHERE is_reviewed = false;

-- ============================================================
-- CUSTOMERS / SUBSCRIPTIONS
-- ============================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id TEXT,           -- Stripe customer_id, etc.
  source TEXT,                -- stripe | shopify | manual
  name TEXT,
  email TEXT,
  status TEXT DEFAULT 'active', -- active | churned | trial
  plan TEXT,
  mrr NUMERIC(10,2) DEFAULT 0,
  total_revenue NUMERIC(15,2) DEFAULT 0,
  first_seen DATE,
  last_seen DATE,
  churned_at DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  external_id TEXT,           -- Stripe subscription_id
  source TEXT NOT NULL,
  status TEXT NOT NULL,       -- active | cancelled | past_due | trialing | paused
  plan_name TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  interval TEXT,              -- month | year
  current_period_start DATE,
  current_period_end DATE,
  cancelled_at DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  source TEXT DEFAULT 'internal', -- internal | stripe
  external_id TEXT,              -- Stripe invoice_id if synced externally

  -- Parties
  vendor_name TEXT,              -- for AP invoices (we owe them)
  customer_name TEXT,            -- for AR invoices (they owe us)
  customer_email TEXT,

  -- Financials
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(15,2),

  -- Status & Dates
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid | overdue | cancelled | rejected | open | pending | approved
  invoice_date DATE,
  due_date DATE,
  paid_at DATE,

  -- Content
  line_items JSONB DEFAULT '[]', -- [{description, quantity, unit_price, amount}]
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE SEQUENCE invoice_number_seq START 1;

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE expense_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  submitter_id UUID REFERENCES auth.users(id),
  submitter_name TEXT,
  category TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | approved | rejected
  receipt_url TEXT,
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES transactions(id), -- linked to ledger after approval
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CATEGORIZATION RULES
-- ============================================================

CREATE TABLE category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL, -- contains | exact | starts_with | regex
  match_value TEXT NOT NULL, -- e.g. "AWS", "Google Ads"
  category TEXT NOT NULL,
  subcategory TEXT,
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Global default rules (org_id IS NULL = system-wide)
INSERT INTO category_rules (id, org_id, match_type, match_value, category, priority) VALUES
  (gen_random_uuid(), NULL, 'contains', 'AWS', 'Infrastructure', 100),
  (gen_random_uuid(), NULL, 'contains', 'Google Cloud', 'Infrastructure', 100),
  (gen_random_uuid(), NULL, 'contains', 'Vercel', 'Infrastructure', 100),
  (gen_random_uuid(), NULL, 'contains', 'Stripe', 'Payment Processing', 100),
  (gen_random_uuid(), NULL, 'contains', 'Google Ads', 'Marketing', 100),
  (gen_random_uuid(), NULL, 'contains', 'Facebook Ads', 'Marketing', 100),
  (gen_random_uuid(), NULL, 'contains', 'Slack', 'SaaS', 90),
  (gen_random_uuid(), NULL, 'contains', 'Figma', 'SaaS', 90),
  (gen_random_uuid(), NULL, 'contains', 'Linear', 'SaaS', 90),
  (gen_random_uuid(), NULL, 'contains', 'Notion', 'SaaS', 90);

-- User-defined mapping overrides (for AI re-classification)
CREATE TABLE category_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, description_pattern)
);

-- ============================================================
-- CSV IMPORTS
-- ============================================================

CREATE TABLE csv_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,          -- Supabase Storage URL
  file_type TEXT NOT NULL,         -- csv | xlsx
  platform TEXT,                   -- bank_statement | shopify | custom | etc.
  status TEXT DEFAULT 'pending',   -- pending | mapping | processing | done | failed
  column_mapping JSONB DEFAULT '{}', -- {"date": "Date", "amount": "Amount", ...}
  total_rows INT,
  imported_rows INT DEFAULT 0,
  skipped_rows INT DEFAULT 0,
  error_log JSONB DEFAULT '[]',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- FINANCIAL SNAPSHOTS (for fast dashboard queries)
-- ============================================================

CREATE TABLE monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,             -- First day of month: 2026-04-01
  mrr NUMERIC(15,2) DEFAULT 0,
  arr NUMERIC(15,2) DEFAULT 0,
  total_revenue NUMERIC(15,2) DEFAULT 0,
  total_expenses NUMERIC(15,2) DEFAULT 0,
  net_income NUMERIC(15,2) DEFAULT 0,
  new_customers INT DEFAULT 0,
  churned_customers INT DEFAULT 0,
  active_customers INT DEFAULT 0,
  churn_rate NUMERIC(5,4) DEFAULT 0,
  cash_balance NUMERIC(15,2),
  burn_rate NUMERIC(15,2),
  runway_months NUMERIC(10,2),
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, month)
);

-- ============================================================
-- CHAT SYSTEM
-- ============================================================

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,          -- user | assistant | system
  content TEXT NOT NULL,
  intent TEXT,                 -- detected intent: query | create_expense | create_invoice | add_income | forecast | unknown
  function_calls JSONB,        -- structured actions the LLM requested
  execution_result JSONB,      -- result of executed actions
  data_context JSONB,          -- aggregated metrics injected into this message (for audit)
  model_used TEXT,             -- e.g. gpt-4o
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,        -- create_expense | approve_expense | create_invoice | add_income | delete_transaction | etc.
  entity_type TEXT NOT NULL,   -- transaction | invoice | expense_report | connection | etc.
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DATA COMPLETENESS TRACKER
-- ============================================================

CREATE TABLE data_completeness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  stripe_connected BOOLEAN DEFAULT false,
  bank_connected BOOLEAN DEFAULT false,
  shopify_connected BOOLEAN DEFAULT false,
  paypal_connected BOOLEAN DEFAULT false,
  has_manual_entries BOOLEAN DEFAULT false,
  has_csv_imports BOOLEAN DEFAULT false,
  revenue_completeness TEXT DEFAULT 'low',   -- high | medium | low
  expense_completeness TEXT DEFAULT 'low',
  last_assessed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INVESTOR UPDATES
-- ============================================================

CREATE TABLE investor_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL,        -- e.g. "April 2026"
  month DATE NOT NULL,
  status TEXT DEFAULT 'draft', -- draft | sent
  content TEXT NOT NULL,       -- markdown content
  metrics_snapshot JSONB,      -- metrics at time of generation
  sent_at TIMESTAMPTZ,
  sent_to TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- WEBHOOK EVENTS (idempotency store)
-- ============================================================

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,      -- stripe | plaid
  event_id TEXT NOT NULL,      -- provider's event ID
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'received', -- received | processed | failed | skipped
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, event_id)   -- idempotency
);
```

---

## 6. Row-Level Security (RLS)

> **Enable RLS on ALL tables. No exceptions.** Users must only be able to access data for their organization.

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_completeness ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Helper function: get the org_id for the current user
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM user_settings WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies: transactions
CREATE POLICY "Users access own org transactions"
  ON transactions FOR ALL
  USING (org_id = get_user_org_id());

-- RLS Policies: invoices
CREATE POLICY "Users access own org invoices"
  ON invoices FOR ALL
  USING (org_id = get_user_org_id());

-- RLS Policies: expense_reports
CREATE POLICY "Users access own org expenses"
  ON expense_reports FOR ALL
  USING (org_id = get_user_org_id());

-- RLS Policies: connections
CREATE POLICY "Users access own org connections"
  ON connections FOR ALL
  USING (org_id = get_user_org_id());

-- RLS Policies: chat
CREATE POLICY "Users access own chat sessions"
  ON chat_sessions FOR ALL
  USING (org_id = get_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users access own chat messages"
  ON chat_messages FOR ALL
  USING (org_id = get_user_org_id());

-- Apply similar policies to all remaining tables following the same pattern.
-- category_rules: allow reading system-wide rules (org_id IS NULL) + own org rules
CREATE POLICY "Users read category rules"
  ON category_rules FOR SELECT
  USING (org_id IS NULL OR org_id = get_user_org_id());

CREATE POLICY "Users manage own category rules"
  ON category_rules FOR ALL
  USING (org_id = get_user_org_id());
```

---

## 7. Authentication

> Configure Supabase Auth via the MCP or dashboard.

- **Enable providers:** Email/Password, Magic Link
- **Optional:** Google OAuth (configure later if needed)
- **Email confirmation:** Enable in production; disable for dev testing
- **JWT expiry:** 3600 seconds (1 hour), refresh token rotation enabled

### Post-Sign-Up Trigger

Create a Supabase database trigger that automatically:
1. Creates a new `organizations` record for the user
2. Creates a `user_settings` record
3. Creates a `data_completeness` record

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create organization
  INSERT INTO organizations (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'), NEW.id)
  RETURNING id INTO new_org_id;

  -- Create user settings
  INSERT INTO user_settings (user_id, org_id)
  VALUES (NEW.id, new_org_id);

  -- Create org member record
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  -- Create data completeness tracker
  INSERT INTO data_completeness (org_id)
  VALUES (new_org_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## 8. Core Architecture Principles

> These principles are NON-NEGOTIABLE. Read and internalize before writing any business logic.

1. **NOT a RAG system.** Do NOT use embeddings, vector search, or semantic similarity for financial data.

2. **Structured data query system:**
   ```
   User input → Intent detection → SQL queries → Deterministic calculations → Context injection → LLM response
   ```

3. **LLM NEVER calculates financial numbers.** All metrics (MRR, ARR, burn rate, runway, P&L) are computed in backend TypeScript functions. The LLM only formats and explains pre-computed results.

4. **DB is the single source of truth.** All external data (Stripe, Plaid) is stored in the `transactions` table before being used anywhere.

5. **Never fetch external APIs (Stripe, Plaid, etc.) on every chat request or page load.** Data must already be in the DB.

6. **All external API calls are server-side only.** Never expose tokens to the frontend.

---

## 9. Unified Financial Ledger

All financial data flows into the `transactions` table regardless of source:

```
Stripe charges          → type: income,  source: stripe
Stripe refunds          → type: expense, source: stripe  (negative, category: Refund)
Plaid bank credits      → type: income,  source: plaid
Plaid bank debits       → type: expense, source: plaid
Manual income entry     → type: income,  source: manual
Manual expense entry    → type: expense, source: manual
CSV import (income row) → type: income,  source: csv
CSV import (expense row)→ type: expense, source: csv
Shopify orders          → type: income,  source: shopify
PayPal settlements      → type: income,  source: paypal
```

### Reconciliation Rule

When both Stripe and Plaid are connected, Stripe revenue deposits will appear in both. Implement reconciliation:

- Match Plaid bank deposits to Stripe payouts by amount + date window (±3 days)
- Mark matched records with `is_reconciled = true` and `reconciled_with = <other_id>`
- Exclude reconciled bank deposits from income calculations (use Stripe as authoritative for revenue)
- Log reconciliation events in `sync_logs`

### Idempotency

Always use the `UNIQUE(org_id, source, source_ref_id)` constraint. Use `INSERT ... ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` with care. Never create duplicate records.

---

## 10. Data Ingestion & Sync Strategy

### Stripe Integration

**Events to handle via webhook:**
- `charge.succeeded` → income transaction
- `charge.refunded` → expense transaction (refund)
- `invoice.paid` → income transaction
- `customer.subscription.created/updated/deleted` → update subscriptions table
- `customer.created/updated` → update customers table
- `payout.paid` → record payout (for reconciliation)

**Scheduled sync (daily):**
- Pull last 30 days of charges, invoices, customers, subscriptions
- Use `sync_cursor` (Stripe's `starting_after` pagination) for incremental sync
- Store full payload in `raw_metadata`

**Webhook endpoint:** `POST /api/webhooks/stripe`
- Verify Stripe signature before processing
- Use `webhook_events` table for idempotency (check `event_id` before processing)
- Process asynchronously (acknowledge immediately, process in background)

### Plaid Integration

**Data pulled:**
- Bank account balances → update `connections.metadata`
- Transactions (income + expenses) → `transactions` table
- Account names → stored in `connections.account_name`

**Sync strategy:**
- On-demand sync when user visits dashboard and data is stale (>1 hour)
- Daily scheduled sync
- Do NOT use Plaid webhooks in MVP unless straightforward to implement

### On-Demand Sync

Trigger sync when:
- User clicks "Sync Now" on connections page
- User visits dashboard and `last_synced_at` is > 1 hour ago (show stale indicator)
- After CSV import completes

### Shopify / PayPal

- OAuth-based connection
- Pull orders/transactions on connection + daily scheduled sync
- Map to `transactions` table with `source: shopify` or `source: paypal`

---

## 11. Transaction Categorization System

Three-layer system applied in order:

### Layer 1: Rule-Based (instant, deterministic)

```typescript
// lib/categorization/rules.ts
export async function applyRules(
  description: string,
  orgId: string
): Promise<{ category: string; confidence: 'high' } | null> {
  // 1. Check org-specific overrides first (highest priority)
  // 2. Check org-specific category_rules
  // 3. Check system-wide rules (org_id IS NULL)
  // 4. Return null if no match
}
```

### Layer 2: AI Fallback

Only called when Layer 1 returns null. Send ONLY the transaction description (no amounts, no sensitive data) to the LLM with a structured prompt:

```
You are a financial transaction categorizer. Given this transaction description, return the most appropriate category.
Categories: Infrastructure, Marketing, SaaS, Contractors, Payroll, Meals, Travel, Office, Payment Processing, Revenue, Refund, Other
Return ONLY a JSON object: { "category": "...", "confidence": "high|medium|low" }
Description: "{description}"
```

- Store result with `category_method: 'ai'`
- Store confidence score
- Mark `is_reviewed: false` → goes into review queue

### Layer 3: User Correction

- User corrects category in review queue UI
- Save correction to `category_overrides` table
- Re-apply to all similar future transactions automatically
- Update `category_method: 'user'`, `is_reviewed: true`

### Review Queue

- UI shows all transactions where `is_reviewed = false`
- Sortable by confidence level (low confidence first)
- Bulk categorization support (select multiple → assign category)
- After review, mark `is_reviewed = true`

---

## 12. Financial Metrics Engine

> All calculations in this section must live in `lib/metrics/` as pure TypeScript functions. NEVER compute these inside the LLM.

```typescript
// lib/metrics/index.ts

export async function getMRR(orgId: string, month?: Date): Promise<number>
// Sum of all active subscription amounts for the given month
// Fall back to: sum of income transactions in the month if no subscription data

export async function getARR(orgId: string): Promise<number>
// getMRR() * 12

export async function getBurnRate(orgId: string, months: number = 3): Promise<number>
// Average monthly expenses over last N months
// Only count expense transactions

export async function getNetBurn(orgId: string): Promise<number>
// getBurnRate() - getMRR()

export async function getRunway(orgId: string): Promise<number | 'infinite'>
// cashBalance / netBurn
// If netBurn <= 0, return 'infinite' (profitable)

export async function getCashBalance(orgId: string): Promise<number>
// Latest bank balance from Plaid connection metadata
// OR: sum of all income - sum of all expenses if no bank connected

export async function getMRRTrend(orgId: string, months: number = 6): Promise<MonthlyMRR[]>
// Array of { month: Date, mrr: number } for the last N months

export async function getPnL(orgId: string, month: Date): Promise<PnLReport>
// Returns: { revenue: LineItem[], cogs: LineItem[], grossProfit, expenses: LineItem[], netIncome }

export async function getChurnRate(orgId: string, month: Date): Promise<number>
// churned_customers / start_of_month_customers

export async function getActiveCustomers(orgId: string): Promise<number>

export async function getForecast(
  orgId: string,
  growthRate: number,
  months: number
): Promise<ForecastMonth[]>
// Deterministic projection: currentMRR * (1 + growthRate)^n

export async function getDataCompleteness(orgId: string): Promise<DataCompleteness>
// Returns per-source connection status and derived completeness level
```

All functions must:
- Query only from `transactions`, `subscriptions`, `customers`, and `monthly_snapshots`
- Return strongly typed results
- Include `dataWarnings: string[]` if completeness is low (e.g. "No bank data connected. Runway estimate may be incomplete.")

---

## 13. Chat / AI Advisor System

### Architecture

```
User message
    ↓
[Intent Detection] — classify: query | create_expense | create_invoice | add_income | forecast | unknown
    ↓
[READ FLOW]                          [WRITE FLOW]
Fetch aggregated metrics from DB     LLM extracts structured parameters
Compute via metrics engine           → Validation layer
    ↓                                → Confirmation prompt to user
Inject sanitized context             → Execute if confirmed
into LLM prompt                      → Write to DB
    ↓                                → Return confirmation
LLM formats response
    ↓
Return to user
```

### Intent Detection

Detect intent server-side before calling LLM (use keyword matching + a lightweight LLM call):

| Intent | Trigger keywords |
|---|---|
| `query_runway` | runway, how long, months left |
| `query_mrr` | MRR, revenue, monthly recurring |
| `query_burn` | burn rate, spending, expenses per month |
| `query_pnl` | profit, loss, P&L, net income |
| `query_forecast` | forecast, projection, next N months |
| `query_customers` | customers, churn, active users |
| `create_expense` | add expense, log expense, record expense |
| `create_invoice` | create invoice, new invoice, send invoice |
| `add_income` | add income, log revenue, record payment |
| `unknown` | anything else → general chat with context |

### Context Injection (READ FLOW)

For `query_*` intents, fetch fresh metrics and inject as system context:

```typescript
// NEVER send raw transaction data to LLM
// Only send aggregated, sanitized metrics

const context = {
  mrr: await getMRR(orgId),
  arr: await getARR(orgId),
  burnRate: await getBurnRate(orgId),
  runway: await getRunway(orgId),
  cashBalance: await getCashBalance(orgId),
  activeCustomers: await getActiveCustomers(orgId),
  churnRate: await getChurnRate(orgId, currentMonth),
  dataWarnings: completeness.warnings,
  // NO account numbers, NO raw transaction IDs, NO tokens
};

const systemPrompt = `
You are FinPilot, an AI financial advisor for startups.
You have access to the following verified financial data for this company:

${JSON.stringify(context, null, 2)}

Rules:
- Use ONLY the numbers provided above. Do not calculate or derive new numbers.
- If data is missing or incomplete, acknowledge the limitation.
- Be concise, clear, and actionable.
- Format currency values clearly.
- If data warnings exist, mention them.
`;
```

### Function Calling (WRITE FLOW)

Use structured output / function calling:

```typescript
// Supported write actions in MVP
const WRITE_ACTIONS = {
  create_expense: {
    params: { title: string, amount: number, category: string, date: string, notes?: string }
  },
  add_income: {
    params: { description: string, amount: number, category: string, date: string, source?: string }
  },
  create_invoice: {
    params: { vendor_or_customer: string, amount: number, due_date: string, notes?: string }
  }
};

// CRITICAL: Never execute directly from LLM output
// Always:
// 1. Parse LLM structured output
// 2. Validate all fields (amount > 0, valid date, category in allowed list)
// 3. Show confirmation card to user: "I'll create this expense: [details]. Confirm?"
// 4. Only write to DB after user confirms
// 5. Log to audit_log
```

### Chat Memory

- Store last 10 messages per session in `chat_messages`
- Send only last 5 messages as conversation history to LLM
- Financial data is ALWAYS fetched fresh from DB, not from chat history
- Each message stores `data_context` (what metrics were injected) for auditability

### Suggested Prompts

Pre-populate the chat interface with suggested prompts:
- "What's my current runway?"
- "Show my MRR for the last 6 months"
- "Create an invoice for $5,000 to Acme Corp"
- "Log a $299 expense for Vercel Pro subscription"
- "Can I afford to hire 2 engineers at $150k each?"
- "What's my burn rate this month?"
- "Break down my spending by category"

---

## 14. CSV & Manual Data Import

### Manual Entry

Provide forms for:
- **Add Expense:** title, amount, category, date, receipt upload, notes
- **Add Income:** description, amount, category, date, source platform, notes

Both write directly to `transactions` table with `source: 'manual'`.

### CSV Import System

**Supported file types:** `.csv`, `.xlsx`

**Import flow:**

1. User uploads file → stored in Supabase Storage (`csv-imports` bucket)
2. System parses file headers and shows first 5 rows as preview
3. **Column mapping step:** user maps their columns to our fields:
   - Required: `date`, `amount`
   - Optional: `description`, `category`, `type` (income/expense)
4. User selects import type: `bank_statement` | `revenue_export` | `expense_export` | `custom`
5. For `bank_statement`: user specifies whether positive = income or expense (varies by bank)
6. System processes rows:
   - Parse amount (handle commas, currency symbols, negative values)
   - Parse date (try multiple formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
   - Apply categorization rules
   - Insert into `transactions` with `source: 'csv'`
   - Use `source_ref_id: {import_id}_{row_index}` for idempotency
7. Show import summary: imported, skipped, errors
8. After import: trigger review queue for uncategorized transactions

**Error handling:**
- Skip rows with unparseable amounts/dates
- Log errors to `csv_imports.error_log`
- Continue processing remaining rows (don't fail entire import on one bad row)

---

## 15. Invoice System

### MVP Scope: Internal Invoices Only

- Invoices are stored in the `invoices` table
- Not integrated with Stripe invoice sending in MVP
- Future extension point: add Stripe invoice creation later

### Invoice Lifecycle

```
draft → sent → paid
              ↓
           overdue (if past due_date and not paid)
draft/sent → cancelled
```

### Invoice Number Generation

Use `INV-{RANDOM_8_CHAR_ALPHANUM}` format (matching reference UI: `INV-MOIMXKI3`).

### Features

- Create invoice (from UI or via AI chat)
- List invoices with filter by status
- View invoice detail
- Mark as paid
- Download as PDF (use a simple template)
- Edit draft invoices
- Status badge display

### Overdue Detection

Run a daily scheduled job (Vercel Cron) to:
- Find all invoices where `status = 'sent'` and `due_date < today`
- Update `status = 'overdue'`
- Add to action items on dashboard

---

## 16. Application Pages & Features

> Build all pages listed. Tax Center is EXCLUDED.

### `/dashboard`
- KPI cards: MRR, Cash Balance, Runway, Active Customers
- ARR with progress bar toward goal
- Action Items (pending taxes, uncategorized transactions)
- Quick Actions (chat shortcuts)
- Revenue Trend chart (monthly bar chart, last 6 months)
- Recent Activity feed (last 5 invoice/transaction events)
- Data health indicator (completeness %)

### `/revenue`
- KPI cards: MRR, ARR, Active Customers, Churn Rate
- MRR Trend tab: horizontal bar chart by month
- By Source tab: breakdown by Stripe / Shopify / PayPal / Manual
- Customer table: name, plan, MRR, status

### `/expenses`
- Table: expense reports list with filter/search
- Status filter (All, Pending, Approved, Rejected)
- Submit Expense button → modal form
- Approve/Reject actions (for admin/owner)
- Category breakdown chart

### `/invoices`
- Table: invoices with filter/search
- Status filter
- New Invoice button → form
- Bulk actions (mark paid, delete drafts)

### `/reports` (P&L Report)
- Month selector
- KPI: Total Revenue, Total Expenses, Net Income
- P&L Statement table (This Month vs Last Month with % change)
- Expense Breakdown tab (pie/bar chart by category)
- Export: CSV and PDF buttons

### `/forecast`
- MRR Growth Rate slider (0–25%)
- Forecast Period slider (3–12 months)
- Output KPIs: Break-Even, Projected MRR, Projected Expenses, Projected Cash
- Revenue vs Expenses Projection chart (monthly, green revenue / gray expenses)

### `/advisor` (AI Chat)
- Full-page chat interface
- Message input at bottom
- Suggested prompt cards
- "Try These" sidebar panel with categorized suggestions
- Confirmation cards for write actions
- Chat session history in sidebar

### `/scenarios`
- Current Baseline bar (MRR, Burn, Cash, Runway)
- Three tabs: Hire / Growth / Fundraise
  - **Hire:** Role + Annual Salary inputs → Before/After comparison
  - **Growth:** Growth rate input → Projected MRR/runway
  - **Fundraise:** Amount raised → Projected runway extension
- Safe/Risky/Caution indicator

### `/investor-updates`
- KPI summary cards
- AI-generated draft (editable textarea)
- Draft / Regenerate / Send (email) buttons
- History of past updates

### `/connections`
- Revenue: Stripe, Shopify, PayPal
- Banking: Plaid, Mercury (Direct), Brex (Direct)
- Accounting: QuickBooks, Xero, FreshBooks
- Each card: Connect / Disconnect / Sync Now / last synced timestamp
- Connection status badge

### `/import`
- Drag-and-drop CSV/XLSX upload
- Column mapping UI
- Import type selector
- Preview table
- Import progress & summary

### `/settings`
- Organization settings (name, currency, fiscal year)
- LLM provider selector (see Section 19)
- Notification preferences
- Profile settings

---

## 17. Data Completeness System

Track which data sources are connected and derive completeness level:

| Sources Connected | Revenue Completeness | Expense Completeness |
|---|---|---|
| Stripe only | high | low |
| Bank only | medium | high |
| Stripe + Bank | high | high |
| Manual/CSV only | medium | medium |
| Nothing | low | low |

Show completeness indicator on dashboard:
- Green (≥70%): "Data looks complete"
- Yellow (40–70%): "Some data sources missing"
- Red (<40%): "Limited data — connect more sources for accurate insights"

When AI responds with metrics, prepend warnings from `completeness.warnings` if applicable:
> "Note: Your runway estimate is based on revenue data only. Connecting a bank account will improve accuracy."

---

## 18. Security & Encryption

### Token Encryption

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32-byte hex key

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(Buffer.from(encryptedHex, 'hex')) + decipher.final('utf8');
}
```

- Always encrypt before storing to `connections` table
- Decrypt only in server-side API routes when needed for external API calls
- NEVER log decrypted tokens
- NEVER pass tokens to frontend
- NEVER include tokens in LLM context

### Additional Security

- All API routes must validate user session (Supabase server-side auth)
- Validate `org_id` against user's organization on every request
- Rate limit chat API: max 30 requests/minute per user
- Sanitize all user inputs before DB queries
- Use parameterized queries (Supabase client does this by default)

---

## 19. LLM Provider Selection

> Users (and developers) should be able to select which LLM provider powers the AI features.

### Settings UI

In `/settings`, provide a **AI Model** section:
- Provider dropdown: OpenAI | Anthropic | (extensible)
- Model dropdown (populates based on provider):
  - OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo
  - Anthropic: claude-opus-4-20250514, claude-sonnet-4-20250514, claude-haiku-4-5-20251001
- API key input (encrypted, stored in `connections` table with `provider: 'openai'` or `provider: 'anthropic'`)

### LLM Adapter

```typescript
// lib/llm/adapter.ts

interface LLMAdapter {
  chat(messages: ChatMessage[], systemPrompt: string): Promise<string>;
  extractStructuredOutput(prompt: string, schema: object): Promise<object>;
}

export function getLLMAdapter(provider: string, model: string, apiKey: string): LLMAdapter {
  if (provider === 'openai') return new OpenAIAdapter(model, apiKey);
  if (provider === 'anthropic') return new AnthropicAdapter(model, apiKey);
  throw new Error(`Unsupported provider: ${provider}`);
}
```

- Each adapter implements the same interface
- Adding new providers only requires a new adapter class
- Default for new users: OpenAI gpt-4o (or whichever key the developer configures in env)
- Developer can set a global default LLM key via env vars; users override with their own key

### Environment Variables for LLM

```env
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_MODEL=gpt-4o
OPENAI_API_KEY=sk-...       # Developer default key (users can override)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 20. Payments — LemonSqueezy (Reserved)

> **DO NOT BUILD THIS YET.** This section documents the intended integration for future implementation.

**Plan:**
- FinPilot will use LemonSqueezy as the payment gateway
- Users must have an active subscription to access the application
- Pricing tiers TBD (Starter / Growth / Scale)
- Webhooks from LemonSqueezy will update user subscription status in `organizations` table

**Future fields to add to `organizations`:**
```sql
lemonsqueezy_customer_id TEXT,
lemonsqueezy_subscription_id TEXT,
subscription_status TEXT DEFAULT 'trial', -- trial | active | cancelled | expired
subscription_plan TEXT,
trial_ends_at TIMESTAMPTZ,
```

**For now:** All users have full access. Add a `TODO: LemonSqueezy gate` comment in the auth middleware.

---

## 21. Mobile Responsiveness

> The application must be fully usable on mobile devices.

- **Sidebar:** Hidden on mobile. Show hamburger menu that opens a slide-in drawer.
- **Bottom navigation:** Optional alternative on mobile (Dashboard, Revenue, Expenses, Advisor).
- **KPI cards:** Stack vertically on mobile (full-width).
- **Tables:** Horizontally scrollable on mobile, or switch to card-list view.
- **Charts:** Responsive width (use `ResponsiveContainer` from Recharts).
- **Modals/forms:** Full-screen on mobile.
- **Chat:** Full-screen with sticky input bar at bottom.
- **Breakpoints:** Use Tailwind's `sm`, `md`, `lg` breakpoints consistently.

---

## 22. Audit Trail

Log every write action to `audit_log`:

```typescript
// lib/audit.ts
export async function logAuditEvent({
  orgId,
  userId,
  action,
  entityType,
  entityId,
  beforeState,
  afterState,
  request
}: AuditEventParams) {
  await supabase.from('audit_log').insert({
    org_id: orgId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_state: beforeState ?? null,
    after_state: afterState ?? null,
    ip_address: request?.headers?.['x-forwarded-for'] ?? null,
    user_agent: request?.headers?.['user-agent'] ?? null,
  });
}
```

Actions to log: `create_expense`, `approve_expense`, `reject_expense`, `create_invoice`, `update_invoice`, `pay_invoice`, `add_income`, `delete_transaction`, `connect_integration`, `disconnect_integration`, `csv_import`, `ai_write_action`.

---

## 23. Documentation Files to Generate

> Create all of the following `.md` files in a `/docs` folder. Each must be detailed and accurate.

| File | Contents |
|---|---|
| `docs/README.md` | Project overview, what FinPilot is, tech stack summary, quick start |
| `docs/ARCHITECTURE.md` | Full system architecture: frontend, backend, DB, AI, sync pipeline, data flow diagrams |
| `docs/SETUP.md` | Step-by-step dev environment setup: cloning, env vars, Supabase setup, first run |
| `docs/DATABASE.md` | All tables, columns, relationships, indexes, RLS policies explained |
| `docs/AUTH.md` | How Supabase Auth works in FinPilot: sign up flow, session management, RLS |
| `docs/AI_CHAT.md` | Full explanation of chat system: intent detection, read flow, write flow, function calling, validation, context injection, memory, safety rules |
| `docs/DATA_INGESTION.md` | How data flows in from Stripe, Plaid, Shopify, PayPal, CSV, manual; sync strategy; reconciliation; idempotency |
| `docs/CATEGORIZATION.md` | 3-layer categorization system in detail: rule-based → AI fallback → user correction; review queue; re-classification |
| `docs/FINANCIAL_METRICS.md` | How every metric is computed: MRR, ARR, burn rate, runway, P&L, churn; deterministic engine; no LLM calculations |
| `docs/SECURITY.md` | Token encryption, RLS, server-side API calls, audit trail, rate limiting |
| `docs/CSV_IMPORT.md` | CSV/XLSX import flow: upload, mapping, parsing, normalization, error handling, idempotency |
| `docs/INVOICES.md` | Invoice lifecycle, statuses, numbering, PDF export, future Stripe extension |
| `docs/FORECAST.md` | How cash flow forecasting and scenario modeling works |
| `docs/LLM_PROVIDERS.md` | How to configure and switch LLM providers; adapter pattern; adding new providers |
| `docs/PAYMENTS.md` | LemonSqueezy integration plan (future); what needs to be built when ready |
| `docs/LOGINS.md` | All accounts, credentials, and configuration needed (fill in during setup): Supabase URL/keys, Stripe test keys, Plaid sandbox keys, LLM API keys |
| `docs/TROUBLESHOOTING.md` | Common issues and fixes: sync errors, auth issues, import failures, API rate limits |

---

## 24. Folder Structure

```
finpilot/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login, signup, reset)
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/              # Protected app pages
│   │   ├── layout.tsx            # Sidebar layout
│   │   ├── dashboard/page.tsx
│   │   ├── revenue/page.tsx
│   │   ├── expenses/page.tsx
│   │   ├── invoices/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── forecast/page.tsx
│   │   ├── advisor/page.tsx
│   │   ├── scenarios/page.tsx
│   │   ├── investor-updates/page.tsx
│   │   ├── connections/page.tsx
│   │   ├── import/page.tsx
│   │   └── settings/page.tsx
│   └── api/                      # API Routes
│       ├── auth/[...supabase]/route.ts
│       ├── webhooks/
│       │   ├── stripe/route.ts
│       │   └── plaid/route.ts
│       ├── sync/
│       │   ├── stripe/route.ts
│       │   └── plaid/route.ts
│       ├── chat/route.ts
│       ├── transactions/route.ts
│       ├── invoices/route.ts
│       ├── expenses/route.ts
│       ├── import/route.ts
│       ├── metrics/route.ts
│       └── cron/
│           ├── daily-sync/route.ts
│           └── invoice-overdue/route.ts
├── components/
│   ├── ui/                       # shadcn/ui base components
│   ├── layout/                   # Sidebar, Header, MobileNav
│   ├── dashboard/                # Dashboard-specific components
│   ├── charts/                   # Chart wrappers
│   ├── chat/                     # Chat components
│   ├── tables/                   # Data tables
│   └── modals/                   # Modal dialogs
├── lib/
│   ├── supabase/                 # Supabase clients (server + browser)
│   ├── metrics/                  # Financial metrics engine
│   ├── categorization/           # 3-layer categorization system
│   ├── llm/                      # LLM adapters + chat orchestration
│   ├── sync/                     # Stripe/Plaid/Shopify sync logic
│   ├── encryption.ts             # AES-256 encrypt/decrypt
│   ├── audit.ts                  # Audit logging
│   └── csv-parser.ts             # CSV/XLSX import logic
├── types/
│   └── index.ts                  # TypeScript types for all DB entities
├── docs/                         # Documentation (see Section 23)
├── supabase/
│   ├── migrations/               # SQL migration files
│   └── seed.sql                  # Sample data for development
├── public/
└── .env.local.example            # All required env vars documented
```

---

## 25. Environment Variables

Create `.env.local.example` with all of the following (fill with real values in `.env.local`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # Server-side only, never expose to frontend

# Encryption
ENCRYPTION_KEY=                    # 64-char hex string (32 bytes) — generate with: openssl rand -hex 32

# Stripe
STRIPE_SECRET_KEY=                 # sk_test_... for dev, sk_live_... for prod
STRIPE_WEBHOOK_SECRET=             # whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Plaid
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox                  # sandbox | development | production

# LLM — Developer defaults (users can override with their own keys in settings)
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_MODEL=gpt-4o
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=                   # Random string for session security

# LemonSqueezy (reserved — fill when ready to build)
# LEMONSQUEEZY_API_KEY=
# LEMONSQUEEZY_STORE_ID=
# LEMONSQUEEZY_WEBHOOK_SECRET=
```

---

## 26. Clarifying Questions (Read Before Building)

> Before generating final implementation, the agent should consider these edge cases. Where the answer is not specified here, use reasonable defaults and document the assumption in the relevant docs file.

**Refunds & Disputes:**
- Stripe refunds → create expense transaction with `category: 'Refund'`, negative impact on MRR
- Disputed charges → keep as income until dispute resolved; add `status: 'disputed'` flag
- Partial refunds → create separate refund transaction for the partial amount

**Invoice Lifecycle:**
- AP invoices (vendor bills) → expense side; `vendor_name` filled, `customer_name` null
- AR invoices (customer invoices) → income side; `customer_name` filled, `vendor_name` null
- Overdue → checked daily by cron job

**Categorization Structure (default categories):**
- Income: `Subscription Revenue`, `One-time Revenue`, `Consulting`, `Refund Received`, `Other Income`
- Expense: `Infrastructure`, `SaaS Tools`, `Marketing`, `Contractors`, `Payroll`, `Meals & Entertainment`, `Travel`, `Office`, `Payment Processing`, `Legal & Professional`, `Refund Issued`, `Other Expense`

**CSV Formats:**
- Support comma-separated and semicolon-separated
- Support Excel date formats and text dates
- Detect and strip BOM characters
- Support negative amounts for expenses (bank statement style)
- Support debit/credit columns (two-column bank format)

**User Roles (MVP):**
- `owner`: full access, can connect integrations, approve expenses
- `member`: can submit expenses, view data (no admin actions)
- Multi-user teams: architecture is ready (org_members table) but UI for inviting team members can be a future feature

**Failure Scenarios:**
- Stripe API down: show last synced data with stale indicator; queue sync retry
- Plaid API down: same pattern
- LLM API down: return error message in chat; do not attempt to answer from stale data
- CSV import fails mid-way: mark rows as processed, log errors, allow re-import of failed rows

**Partial Data Users (Global Support):**
- Sri Lanka / markets without Plaid: rely entirely on Stripe + CSV import + manual
- No bank API needed for core features; runway calculated from Stripe + manual expense entries
- All pages must render meaningfully with zero connected integrations (show empty states with clear CTAs to connect or import)

---

> **Final Note to Coding Agent:**
> Build this system to production-grade quality. The screenshots provided show an early rough version — the real product should be cleaner, more polished, and more thoughtfully engineered than what's shown. Follow all architecture principles without shortcuts. Generate all documentation files as you build. Ask for clarification on anything not specified here rather than making silent assumptions.
