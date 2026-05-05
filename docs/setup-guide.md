# Finvio — Complete Setup Guide

End-to-end instructions for getting Finvio running locally and deploying to production on Vercel + Supabase.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and install](#2-clone-and-install)
3. [Supabase — project setup](#3-supabase--project-setup)
4. [Environment variables](#4-environment-variables)
5. [Encryption key](#5-encryption-key)
6. [AI keys (OpenAI / Anthropic)](#6-ai-keys-openai--anthropic)
7. [QuickBooks integration](#7-quickbooks-integration)
8. [Stripe integration](#8-stripe-integration)
9. [Plaid integration](#9-plaid-integration)
10. [Shopify integration](#10-shopify-integration)
11. [PayPal integration](#11-paypal-integration)
12. [Voice input](#12-voice-input)
13. [Run locally](#13-run-locally)
14. [Deploy to Vercel](#14-deploy-to-vercel)
15. [Switching from local to production](#15-switching-from-local-to-production)
16. [Checklist — things to update when changing domains](#16-checklist--things-to-update-when-changing-domains)

---

## 1. Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier for basic hosting; Pro required for cron jobs)
- Git

---

## 2. Clone and install

```bash
git clone <your-repo-url>
cd finvio-app
npm install
cp .env.local.example .env.local
```

---

## 3. Supabase — project setup

### 3.1 Create a project

1. Go to [supabase.com](https://supabase.com) → New project
2. Pick a name, region, and strong database password
3. Wait ~2 minutes for provisioning

### 3.2 Get your credentials

In the Supabase dashboard → **Project Settings → API**:

| What | Where in dashboard | Env var |
|---|---|---|
| Project URL | API → Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Anon/public key | API → Project API keys → `anon` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Service role key | API → Project API keys → `service_role` | `SUPABASE_SERVICE_ROLE_KEY` |

> **Security:** The service role key bypasses Row Level Security. Keep it server-side only — it must never appear in frontend code or be prefixed with `NEXT_PUBLIC_`.

### 3.3 Apply migrations

Run all SQL files in `supabase/migrations/` in order via the Supabase SQL Editor (dashboard → SQL Editor → paste and run each file) or via the Supabase CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

The project ref is the alphanumeric string in your Supabase project URL: `https://supabase.com/dashboard/project/<ref>`.

### 3.4 Auth configuration

In Supabase dashboard → **Authentication → Providers**:

- Enable **Email** provider
- Optionally enable **Magic Link** (passwordless)

In **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` for local, `https://yourdomain.com` for production
- **Redirect URLs**: add `http://localhost:3000/**` and `https://yourdomain.com/**`

### 3.5 Storage buckets

In Supabase dashboard → **Storage → New bucket**, create:

| Bucket name | Public | Purpose |
|---|---|---|
| `csv-imports` | No | CSV/XLSX uploads for manual import |
| `expense-receipts` | No | Receipt PDFs and images |

---

## 4. Environment variables

Copy the example file and fill in values as you complete each section below:

```bash
cp .env.local.example .env.local
```

All variables and their purpose are documented in [environment-variables.md](./environment-variables.md). The sections below explain how to obtain each credential from the respective service.

---

## 5. Encryption key

OAuth tokens (QuickBooks, Stripe, etc.) are encrypted at rest using AES-256-GCM. Generate a key once and keep it consistent across environments:

```bash
openssl rand -hex 32
```

Set the output as `ENCRYPTION_KEY` in `.env.local`. In Vercel, set the same value in Environment Variables.

> **Important:** If you change this key, all stored tokens become unreadable. Users will need to reconnect their integrations.

---

## 6. AI keys (OpenAI / Anthropic)

Finvio uses OpenAI by default. Anthropic is optional.

### OpenAI

1. Go to [platform.openai.com](https://platform.openai.com) → API keys → Create new key
2. Set as `OPENAI_API_KEY`
3. Set `DEFAULT_LLM_PROVIDER=openai` and `DEFAULT_LLM_MODEL=gpt-4o` (or `gpt-4o-mini` for lower cost)

The AI advisor uses this key for all chat responses. Voice input uses the same key for Whisper transcription (`whisper-1`) on Brave/Firefox.

### Anthropic (optional)

1. Go to [console.anthropic.com](https://console.anthropic.com) → API keys
2. Set as `ANTHROPIC_API_KEY`
3. Change `DEFAULT_LLM_PROVIDER=anthropic` and `DEFAULT_LLM_MODEL=claude-sonnet-4-6` to switch

---

## 7. QuickBooks integration

### 7.1 Create a developer app

1. Go to [developer.intuit.com](https://developer.intuit.com) → Sign in or create a free account
2. **Dashboard → Create an app → QuickBooks Online and Payments**
3. Give it a name (e.g. "Finvio Dev")
4. Select scope: **`com.intuit.quickbooks.accounting`**

### 7.2 Get credentials

Under **Development → Keys & credentials**:

| Credential | Env var |
|---|---|
| Client ID | `QB_CLIENT_ID` |
| Client Secret | `QB_CLIENT_SECRET` |

### 7.3 Register redirect URIs

This is the critical step. Intuit validates that the `redirect_uri` sent during OAuth **exactly matches** a registered URI. Finvio reads this URI from `QB_REDIRECT_URI` — the code never builds it dynamically.

In your Intuit app → **Development → Keys & credentials → Redirect URIs**:

Add the URIs for each environment you use:

| Environment | URI to add |
|---|---|
| Local (port 3000) | `http://localhost:3000/api/connections/quickbooks/callback` |
| Local (port 3004) | `http://localhost:3004/api/connections/quickbooks/callback` |
| Production (Vercel) | `https://finvio-app.vercel.app/api/connections/quickbooks/callback` |

You can have multiple URIs registered — Intuit allows it. Add all that you use.

### 7.4 Set env vars

```env
QB_CLIENT_ID=your_client_id
QB_CLIENT_SECRET=your_client_secret
QB_ENVIRONMENT=sandbox
QB_REDIRECT_URI=http://localhost:3000/api/connections/quickbooks/callback
```

**To switch to production** — change only `QB_REDIRECT_URI` and `QB_ENVIRONMENT`. Nothing else needs to change.

### 7.5 Sandbox test company

In the [Intuit developer sandbox](https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes/manage-your-sandboxes), create a test company. You'll connect it through the Finvio Connections page during testing.

---

## 8. Stripe integration

### 8.1 Create or use an existing Stripe account

Go to [dashboard.stripe.com](https://dashboard.stripe.com).

### 8.2 Get API keys

In Stripe dashboard → **Developers → API keys**:

| Key | Env var |
|---|---|
| Publishable key (`pk_test_…`) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Secret key (`sk_test_…`) | `STRIPE_SECRET_KEY` |

Use test keys locally (`pk_test_`, `sk_test_`). Switch to live keys in production.

### 8.3 Set up a webhook (production only)

Stripe webhooks deliver real-time payment events to Finvio for auto-syncing.

1. Stripe dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
3. Events to listen for:
   - `charge.succeeded`
   - `charge.refunded`
   - `invoice.paid`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payout.paid`
4. Copy the **Signing secret** (`whsec_…`) → set as `STRIPE_WEBHOOK_SECRET`

For local webhook testing, use the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This prints a local signing secret — use it as `STRIPE_WEBHOOK_SECRET` during development.

### 8.4 Note on individual user Stripe connections

The Connections page lets individual users paste their own Stripe secret key. The platform-level `STRIPE_SECRET_KEY` is used only for cron sync jobs when an org's own key is unavailable. This is separate from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

---

## 9. Plaid integration

Plaid requires you to register a developer app — individual users don't provide Plaid keys.

### 9.1 Create an app

1. Go to [dashboard.plaid.com](https://dashboard.plaid.com) → sign up / log in
2. Create a new app from the dashboard

### 9.2 Get credentials

In Plaid dashboard → **Team Settings → Keys**:

| Key | Env var |
|---|---|
| Client ID | `PLAID_CLIENT_ID` |
| Sandbox secret | `PLAID_SECRET` (for local dev) |
| Development/Production secret | `PLAID_SECRET` (for prod) |

### 9.3 Set env vars

```env
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox          # sandbox | development | production
```

### 9.4 Sandbox testing

In sandbox mode, Plaid provides test credentials. In the bank link flow, use:
- **Username:** `user_good`
- **Password:** `pass_good`

---

## 10. Shopify integration

### 10.1 Create a Shopify app

1. Go to [partners.shopify.com](https://partners.shopify.com) → Apps → Create app → Custom app
2. In App setup, set the **App URL** and **Allowed redirection URL(s)**:
   - Local: `http://localhost:3000/api/connections/shopify/callback`
   - Production: `https://yourdomain.com/api/connections/shopify/callback`

### 10.2 Get credentials

| Credential | Env var |
|---|---|
| Client ID (API key) | `SHOPIFY_API_KEY` |
| Client secret | `SHOPIFY_API_SECRET` |

```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
```

---

## 11. PayPal integration

### 11.1 Create an app

1. Go to [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → Create App
2. Choose **Merchant** app type

### 11.2 Get credentials

In your app → Sandbox credentials (for dev) or Live credentials (for prod):

| Credential | Env var |
|---|---|
| Client ID | `PAYPAL_CLIENT_ID` |
| Client Secret | `PAYPAL_CLIENT_SECRET` |

```env
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENV=sandbox          # sandbox | production
```

---

## 12. Voice input

Voice input has two paths:

| Path | Browser | Cost | Server needed? |
|---|---|---|---|
| Web Speech API | Chrome, Safari, Edge (non-Brave) | Free | No |
| Server Whisper (`whisper-1`) | Brave, Firefox | ~$0.006/min | Yes (`OPENAI_API_KEY`) |
| WASM local (Xenova/whisper-tiny) | Brave/Firefox over-quota | Free | No |

No extra setup is needed for voice. The `OPENAI_API_KEY` (set for AI chat) also covers Whisper.

### Optional quota limits

Set per-user limits on server Whisper to control cost:

```env
VOICE_DAILY_QUOTA_SECONDS=300     # 5 min/user/day
VOICE_MONTHLY_QUOTA_SECONDS=3600  # 1 hr/user/month
```

Over-quota users on capable devices are automatically routed to the in-browser WASM model. Low-end devices (< 4 CPU cores or < 4 GB RAM) over quota get a hard block with a clear error message — no silent server escape.

---

## 13. Run locally

```bash
npm run dev
```

App starts at `http://localhost:3000` (or whichever port Next.js picks — check the terminal output).

> If you use a non-3000 port, make sure `QB_REDIRECT_URI` matches that port and the same URI is registered in Intuit.

### Verify the setup

1. Visit `http://localhost:3000` — you should see the landing page
2. Sign up with an email — Supabase sends a confirmation link
3. After login, you should land on `/dashboard`
4. Visit `/connections` — QuickBooks, Stripe, etc. sections should appear (not "not configured")

---

## 14. Deploy to Vercel

### 14.1 Push to GitHub

```bash
git add .
git commit -m "Initial setup"
git push origin main
```

### 14.2 Import to Vercel

1. [vercel.com](https://vercel.com) → Add New Project → Import Git Repository
2. Select your repo
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy** (it will fail — env vars aren't set yet, that's fine)

### 14.3 Add environment variables

In Vercel → your project → **Settings → Environment Variables**, add every variable from `.env.local`. For variables that differ between local and production, use the correct production values:

| Variable | Local value | Production value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | same | same (one Supabase project) |
| `QB_REDIRECT_URI` | `http://localhost:3000/…/callback` | `https://finvio-app.vercel.app/…/callback` |
| `QB_ENVIRONMENT` | `sandbox` | `production` |
| `STRIPE_SECRET_KEY` | `sk_test_…` | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | local CLI secret | Vercel endpoint secret |
| `PLAID_ENV` | `sandbox` | `production` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://finvio-app.vercel.app` |

Mark every non-`NEXT_PUBLIC_` variable as **Server** scope.

### 14.4 Redeploy

After adding env vars, trigger a redeploy: **Vercel → Deployments → Redeploy**.

### 14.5 Update Supabase auth URLs

In Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://finvio-app.vercel.app`
- **Redirect URLs**: add `https://finvio-app.vercel.app/**`

### 14.6 Set up Stripe webhook for production

Follow [section 8.3](#83-set-up-a-webhook-production-only) using your Vercel domain.

### 14.7 Cron jobs

Vercel Cron requires the **Pro plan**. The jobs are configured in `vercel.json`:

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/daily-sync` | `0 2 * * *` (02:00 UTC) | Sync all integrations |
| `/api/cron/invoice-overdue` | `0 6 * * *` (06:00 UTC) | Mark overdue invoices |

Set `CRON_SECRET` to a random string (`openssl rand -hex 32`) in both `.env.local` and Vercel env vars. The cron routes check `Authorization: Bearer <CRON_SECRET>` on every request.

---

## 15. Switching from local to production

You should only need to change these things when switching from local testing to production:

### In Vercel / `.env.local`

| Variable | What to change |
|---|---|
| `QB_REDIRECT_URI` | Swap to the production Vercel URL |
| `QB_ENVIRONMENT` | `sandbox` → `production` |
| `STRIPE_SECRET_KEY` | `sk_test_…` → `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | Replace with the live webhook signing secret |
| `PLAID_ENV` | `sandbox` → `production` |
| `PLAID_SECRET` | Replace with the production Plaid secret |
| `NEXT_PUBLIC_APP_URL` | Swap to the production domain |

### In Intuit developer portal

No code change needed. Just ensure your production URL is registered as a Redirect URI. Both sandbox and production URIs can coexist in the same Intuit app's redirect URI list.

### In Supabase

Update **Site URL** and **Redirect URLs** in Authentication settings to your production domain.

### In Stripe

Add the production webhook endpoint (separate from the local/dev one).

---

## 16. Checklist — things to update when changing domains

When you move from `localhost` to a Vercel URL, or rename your Vercel project, update **all** of these:

- [ ] `QB_REDIRECT_URI` env var (local and Vercel)
- [ ] Intuit developer portal → Redirect URIs list (add the new domain)
- [ ] Supabase → Authentication → Site URL
- [ ] Supabase → Authentication → Redirect URLs
- [ ] Stripe → Webhooks → endpoint URL
- [ ] Shopify → App setup → Allowed redirection URL(s) (if using Shopify)
- [ ] PayPal → App → Return URL (if using PayPal)
- [ ] `NEXT_PUBLIC_APP_URL` env var

You do **not** need to change any code — all URLs are read from environment variables.
