# FinPilot — Product Overview

FinPilot is a SaaS financial intelligence platform for startups and SMBs. It ingests data from payment processors, banks, and e-commerce platforms and surfaces it through an AI advisor chat, dashboards, and automated reporting.

## Key features

| Feature | Description |
|---|---|
| AI Advisor | Chat interface powered by OpenAI or Anthropic; answers financial questions and can create records via confirmed write actions |
| Dashboard | Live KPI cards (MRR, ARR, Cash, Runway), 6-month revenue trend, data health score |
| Revenue Analytics | MRR trend, by-source breakdown, customer table |
| P&L Reports | Month-by-month profit & loss with vs-prior-month comparison and CSV export |
| Forecast | MRR growth rate + period sliders, break-even detection, cash projection chart |
| Scenarios | Hire / Growth / Fundraise scenario modeling with before/after runway comparison |
| Investor Updates | AI-generated draft updates with editable textarea and save-to-history |
| Integrations | Stripe (webhooks + sync), Plaid (bank link), Shopify (OAuth), PayPal (OAuth), CSV/XLSX import |
| Invoices | Create, send, mark paid → auto-creates income transaction |
| Expenses | Submit, approve/reject → auto-creates expense transaction |
| Audit Log | All writes recorded with before/after state, IP, user agent |
| Background Jobs | Vercel cron: daily sync + overdue invoice detection |
| Reconciliation | Automatic Stripe payout ↔ Plaid deposit matching (±3 day window) |

## Tech stack

- **Frontend**: Next.js 14 (App Router), React 19, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Next.js API Routes (Edge-compatible), Supabase (Postgres + Auth + Storage)
- **AI**: OpenAI SDK + Anthropic SDK — product-provided keys, user picks model in settings
- **Integrations**: Stripe SDK, Plaid SDK, Shopify REST API, PayPal REST API
- **Security**: AES-256-GCM token encryption, Supabase RLS, CRON_SECRET header auth
- **Infra**: Vercel (deployment + cron), Supabase (hosted Postgres)
