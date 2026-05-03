# Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all required values before running locally.

## Required — Supabase

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key — safe to expose in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-only, never expose** |

## Required — Encryption

| Variable | Description |
|---|---|
| `ENCRYPTION_KEY` | 64-character hex string (32 bytes) used for AES-256-GCM token encryption. Generate with: `openssl rand -hex 32` |

## Required — AI (product-provided)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key — server-only. Users never see or enter this. |
| `ANTHROPIC_API_KEY` | Anthropic API key — server-only. Users never see or enter this. |

## Optional — Stripe

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_…` or `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret (`whsec_…`) from Stripe dashboard |

## Optional — Plaid

| Variable | Description |
|---|---|
| `PLAID_CLIENT_ID` | Plaid client ID |
| `PLAID_SECRET` | Plaid secret (sandbox or production) |
| `PLAID_ENV` | `sandbox` \| `development` \| `production` (default: `sandbox`) |

## Optional — Shopify

| Variable | Description |
|---|---|
| `SHOPIFY_CLIENT_ID` | Shopify app client ID |
| `SHOPIFY_CLIENT_SECRET` | Shopify app client secret |
| `SHOPIFY_REDIRECT_URI` | OAuth callback URL (`https://yourdomain.com/api/connections/shopify/callback`) |

## Optional — PayPal

| Variable | Description |
|---|---|
| `PAYPAL_CLIENT_ID` | PayPal app client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal app client secret |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` or `https://api-m.paypal.com` |
| `PAYPAL_REDIRECT_URI` | OAuth callback URL |

## Required — Vercel Cron

| Variable | Description |
|---|---|
| `CRON_SECRET` | Secret token Vercel sends in `Authorization: Bearer <secret>` header to cron routes. Generate with `openssl rand -hex 32`. |

## App config

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `https://app.finpilot.com`) — used for OAuth redirect URIs |
