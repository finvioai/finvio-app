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

AI keys are provided by the platform — users do not enter them. The AI model is fixed server-side; there is no user-facing model picker.

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key — server-only. Never exposed to users. |
| `ANTHROPIC_API_KEY` | Anthropic API key — server-only. Never exposed to users. |

## Optional — Stripe (server fallback / webhooks)

> **Note:** Individual users connect Stripe via the UI by entering their own secret key. These env vars are only needed for cron-based sync and webhook verification, not for the per-user connection flow.

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Fallback Stripe secret key for cron jobs / webhooks |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret (`whsec_…`) from Stripe dashboard |

## Optional — Plaid (platform credentials required)

> Plaid requires you to register a developer app at [plaid.com](https://plaid.com) and obtain platform credentials. These are shared across all users — individual users do not provide their own Plaid keys.

| Variable | Description |
|---|---|
| `PLAID_CLIENT_ID` | Plaid client ID from your Plaid developer dashboard |
| `PLAID_SECRET` | Plaid secret (sandbox or production) |
| `PLAID_ENV` | `sandbox` \| `development` \| `production` (default: `sandbox`) |

## Optional — Shopify (platform OAuth app required)

> Requires creating a Shopify app in the [Shopify Partner Dashboard](https://partners.shopify.com). The Connections page shows a setup notice if these are missing.

| Variable | Description |
|---|---|
| `SHOPIFY_API_KEY` | Shopify app client ID |
| `SHOPIFY_API_SECRET` | Shopify app client secret |
| `SHOPIFY_REDIRECT_URI` | OAuth callback URL (`https://yourdomain.com/api/connections/shopify/callback`) |

## Optional — PayPal (platform OAuth app required)

> Requires creating an app in the [PayPal Developer Portal](https://developer.paypal.com). The Connections page shows a setup notice if these are missing.

| Variable | Description |
|---|---|
| `PAYPAL_CLIENT_ID` | PayPal app client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal app client secret |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` or `https://api-m.paypal.com` |
| `PAYPAL_REDIRECT_URI` | OAuth callback URL |

## Required — QuickBooks (platform OAuth app)

> Register a QuickBooks app at [developer.intuit.com](https://developer.intuit.com). Each Finvio user then authorizes their own QuickBooks company through this one platform app. The redirect URI must be registered in the app settings.

| Variable | Description |
|---|---|
| `QB_CLIENT_ID` | QuickBooks app client ID from developer.intuit.com |
| `QB_CLIENT_SECRET` | QuickBooks app client secret |
| `QB_ENVIRONMENT` | `sandbox` (default) or `production` — controls which QB API endpoint is used |
| `QB_REDIRECT_URI` | Full callback URL registered in Intuit developer portal. Local: `http://localhost:3000/api/connections/quickbooks/callback`. Production: `https://yourdomain.com/api/connections/quickbooks/callback`. Both must be registered as allowed Redirect URIs in the Intuit app. |

The redirect URI is read directly from this variable in both the auth-initiation and token-exchange routes — **never hardcoded**. To switch environments, change this variable only.

**Required OAuth scopes:**
```
com.intuit.quickbooks.accounting
```

## Required — Vercel Cron

| Variable | Description |
|---|---|
| `CRON_SECRET` | Secret token Vercel sends in `Authorization: Bearer <secret>` header to cron routes. Generate with `openssl rand -hex 32`. |

## Optional — Voice quota (server Whisper)

| Variable | Default | Description |
|---|---|---|
| `VOICE_DAILY_QUOTA_SECONDS` | `300` | Max seconds of server-side Whisper per user per day (~$0.03/user/day at cap) |
| `VOICE_MONTHLY_QUOTA_SECONDS` | `3600` | Max seconds of server-side Whisper per user per month (~$0.36/user/month at cap) |

Over-quota users on capable devices are routed to in-browser WASM (Xenova/whisper-tiny). Low-end devices get a hard block.

## App config

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `https://app.finvio.ai`) — used for display only |
| `CRON_SECRET` | Secret token Vercel includes in `Authorization: Bearer` header on cron calls. Generate with `openssl rand -hex 32`. |
