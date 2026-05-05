# Finvio — Product Overview

Finvio is a financial intelligence platform for SaaS companies, SMBs, and project-based businesses (agencies, consultants, freelancers). It ingests data from payment processors, banks, and e-commerce platforms and surfaces it through an AI advisor chat, dashboards, and automated reporting — adapting its metrics, framing, and forecasting to match the actual revenue model of each business.

## Key features

| Feature | Description |
|---|---|
| AI Advisor | Chat interface powered by OpenAI or Anthropic; answers financial questions and can create records via confirmed write actions; frames responses based on detected business model; supports voice input (Web Speech API primary, OpenAI Whisper fallback) |
| Voice Input | Press-and-hold mic on mobile (walkie-talkie style, auto-sends on release); click-to-toggle on desktop with live word-by-word transcript overlay; Web Speech API is free with no server round-trip; Whisper fallback (`whisper-1`) used on unsupported browsers and on Brave (which blocks Web Speech API) at ~$0.006/min; Brave detected via `navigator.brave.isBrave()` and bypassed automatically |
| Dashboard | Adaptive KPI cards based on business model (MRR/ARR/Runway for SaaS; Revenue/Profit/Cash for SMB; Active Projects for project-based), 6-month revenue trend |
| Revenue Analytics | MRR trend, by-source breakdown, customer table, and revenue-by-type breakdown (recurring / one-time / project / milestone) |
| Revenue Classification | Transactions auto-tagged with `revenue_type` from category; powers business model detection and revenue breakdown analytics |
| Business Model Detection | Inferred dynamically from data patterns — no manual mode switch; adapts dashboard, forecast, and AI to the actual business type |
| P&L Reports | Month-by-month profit & loss with vs-prior-month comparison and CSV export |
| Forecast | Model-aware: MRR growth rate slider for SaaS; historical trend-based projection for SMB/project businesses |
| Projects | Project-level P&L tracking — budget vs collected vs expenses per project; transactions linked to projects |
| Scenarios | Hire / Growth / Fundraise scenario modeling with before/after runway comparison |
| Investor Updates | AI-generated draft updates with editable textarea and save-to-history |
| Integrations | Stripe, Plaid (bank link), Shopify, PayPal, QuickBooks Online (OAuth), CSV/XLSX import |
| Invoices | Create, send, mark paid → auto-creates income transaction |
| Expenses | Submit, approve/reject → auto-creates expense transaction; optional receipt/bill file attachment (PDF or image) stored in Supabase Storage and viewable inline on Expenses and Transactions pages |
| Receipt Uploads | File upload endpoint (`POST /api/receipts`) stores PDFs and images in `expense-receipts` Supabase Storage bucket; `receipt_url` linked on transactions and expense reports |
| Balance Sheet | Simplified balance sheet page showing cash position, accounts receivable, recurring liabilities, and estimated equity derived from transaction data |
| Landing Page | Public marketing landing page at `/` — unauthenticated visitors see the landing page; authenticated users are redirected to `/dashboard` |
| Audit Log | All writes recorded with before/after state, IP, user agent |
| Background Jobs | Vercel cron: daily sync + overdue invoice detection |
| Reconciliation | Automatic Stripe payout ↔ Plaid deposit matching (±3 day window) |

## Tech stack

- **Frontend**: Next.js 14 (App Router), React 19, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Next.js API Routes (Edge-compatible), Supabase (Postgres + Auth + Storage)
- **AI**: OpenAI SDK + Anthropic SDK — product-provided keys, model configured server-side (no user-facing model picker)
- **Integrations**: Stripe SDK, Plaid SDK, Shopify REST API, PayPal REST API, QuickBooks Online REST API
- **Security**: AES-256-GCM token encryption, Supabase RLS, CRON_SECRET header auth
- **Infra**: Vercel (deployment + cron), Supabase (hosted Postgres)
