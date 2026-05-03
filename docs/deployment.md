# Deployment Guide

## Prerequisites

- Vercel account (free tier works for development)
- Supabase project with all migrations applied
- At minimum: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

## Vercel deployment

### 1. Connect repo

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com) → Import project → select your repo
3. Framework preset: **Next.js** (auto-detected)

### 2. Set environment variables

In Vercel → Project Settings → Environment Variables, add all variables from [environment-variables.md](./environment-variables.md).

Mark all non-`NEXT_PUBLIC_` variables as **Server** only to prevent browser exposure.

### 3. Cron jobs

`vercel.json` at the project root configures two cron jobs:

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/daily-sync` | `0 2 * * *` (02:00 UTC) | Stripe + Plaid incremental sync for all orgs |
| `/api/cron/invoice-overdue` | `0 6 * * *` (06:00 UTC) | Mark sent invoices past due date as overdue |

Vercel Cron requires the Pro plan or higher. The routes authenticate using `Authorization: Bearer <CRON_SECRET>`.

### 4. Supabase setup

Run migrations in order via `supabase db push` or the Supabase MCP:
1. `001_initial_schema.sql`
2. `002_rls_policies.sql`
3. `003_auth_triggers.sql`
4. `004_seed_category_rules.sql`

Enable **Email** and **Magic Link** auth providers in Supabase Authentication settings.

Create storage buckets:
- `csv-imports` — public read, authenticated write
- `receipt-attachments` — authenticated read/write

### 5. Stripe webhook

In Stripe dashboard → Webhooks → Add endpoint:
- URL: `https://yourdomain.com/api/webhooks/stripe`
- Events: `charge.succeeded`, `charge.refunded`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `payout.paid`

Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel.

### 6. Verify deployment

1. Sign up with a new user → org auto-created → dashboard shows empty state ✓
2. Open AI advisor → ask "What's my MRR?" → responds with data warning ✓
3. Create a manual expense → appears in transactions ✓
4. Check Vercel logs for cron job execution (next morning)

## Local development

```bash
npm install
cp .env.local.example .env.local
# Fill in .env.local
npm run dev
```

App starts at `http://localhost:3000`.
