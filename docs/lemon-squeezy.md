# Lemon Squeezy Integration

Finvio connects to your Lemon Squeezy store to automatically sync orders, subscriptions, and customer data into your financial dashboard.

---

## What gets synced

| Data | How it appears in Finvio |
|---|---|
| Paid orders | Income transactions (category auto-detected) |
| Refunded orders | Expense transactions (category: Refund Issued) |
| Subscription invoices (paid) | Income transactions (category: Subscription Revenue) |
| Refunded subscription invoices | Expense transactions (category: Refund Issued) |
| Subscriptions | Subscriptions table — tracked for MRR, status, plan name |
| Customers | Customers table — tracked for active customer count |

---

## Authentication

Lemon Squeezy uses **API key authentication** — there is no OAuth flow. You must generate an API key in your Lemon Squeezy dashboard and paste it into Finvio.

> **Why no "one-click" OAuth?** Lemon Squeezy does not offer OAuth for third-party apps. API key authorization is their only supported model.

---

## Setup guide

### Step 1 — Generate a Lemon Squeezy API key

1. Log in to [app.lemonsqueezy.com](https://app.lemonsqueezy.com)
2. Go to **Settings → API** (top-right user menu → Settings, then the API tab)
3. Click **+ New API key**
4. Give it a descriptive name (e.g., `Finvio`)
5. Copy the key — it is shown only once

> **Keep this key secret.** It grants full read/write access to your Lemon Squeezy account. Store it securely and never share it.

### Step 2 — Connect in Finvio

1. Go to **Connections** (`/connections`) in Finvio
2. Click **Connect Lemon Squeezy**
3. Paste your API key into the input field
4. Click **Connect Lemon Squeezy**

Finvio will:
- Validate the key against your store
- Automatically register a webhook to receive real-time events
- Run an initial sync (all paid orders + subscriptions)

### Step 3 — Verify data

After connecting, go to **Transactions** to see imported orders and subscription invoices, and **Revenue** to see subscription MRR.

---

## Environment variables

No server-side environment variables are required for Lemon Squeezy (unlike Stripe, which needs `STRIPE_CLIENT_ID`).

The only variable that affects Lemon Squeezy is:

```
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

This is used to auto-register the webhook URL. If this variable is missing or points to `localhost`, webhook registration will be skipped and you must register it manually (see below).

---

## Manual webhook setup (local dev or if auto-registration fails)

In production with `NEXT_PUBLIC_APP_URL` set, webhook registration is automatic.

For local development or if auto-registration fails:

1. Go to **app.lemonsqueezy.com → Settings → Webhooks**
2. Click **+ Add webhook**
3. Set the **URL** to: `https://your-domain.com/api/webhooks/lemonsqueezy`
4. Set the **Secret** to any strong random string (save it — you'll need it below)
5. Subscribe to these events:
   - `order_created`, `order_refunded`
   - `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`
   - `subscription_payment_success`, `subscription_payment_failed`, `subscription_payment_recovered`

> Currently there is no `LEMON_SQUEEZY_WEBHOOK_SECRET` environment variable because secrets are stored per-connection. If you need to hardcode the secret for manual webhook handling, contact your developer.

---

## Syncing data

### Automatic sync (webhooks)

After connecting, all new orders and subscription events arrive in real time via webhook. No manual action is needed.

### Manual sync

Click **Sync Now** on the Lemon Squeezy card on the Connections page to pull the latest data on demand.

---

## Data details

### Orders (one-time revenue)

- Only orders with `status = paid` are imported
- Refunded orders create an additional **Refund Issued** expense entry
- Amount is the order total (including tax, as Lemon Squeezy is a Merchant of Record and handles tax)
- Category is auto-detected from the order description; defaults to `One-time Revenue`

### Subscriptions

- All subscriptions are tracked regardless of status (active, cancelled, paused, etc.)
- Subscription MRR amount is populated from the most recent paid subscription invoice
- Billing interval (monthly vs annual) is inferred from the subscription's renewal date
- Status mapping:
  | Lemon Squeezy status | Finvio status |
  |---|---|
  | `on_trial` | `trialing` |
  | `active` | `active` |
  | `paused` | `paused` |
  | `past_due` | `past_due` |
  | `unpaid` | `past_due` |
  | `cancelled` | `cancelled` |
  | `expired` | `cancelled` |

### Subscription invoices

- Paid invoices are imported as **Subscription Revenue** income transactions
- Refunded invoices create a matching **Refund Issued** expense entry
- Duplicate prevention: each invoice is tracked by its ID — re-syncing never creates duplicates

### Disputes / chargebacks

Lemon Squeezy operates as a **Merchant of Record** — they handle all disputes and chargebacks on your behalf. This means disputes are Lemon Squeezy's liability, not yours, and there is no dispute data in the API. No dispute transactions will appear in Finvio.

---

## Disconnecting

1. Go to **Connections → Lemon Squeezy → Disconnect**
2. Choose whether to keep or remove imported data:
   - **Keep data**: Transactions remain in Finvio; subscriptions and customers are marked inactive
   - **Remove data**: All Lemon Squeezy transactions are deleted (soft-delete; can be restored by reconnecting)

---

## Rate limits

Lemon Squeezy's API enforces **60 requests per minute**. During an initial sync with many orders, Finvio automatically pauses between paginated requests to stay within this limit. Large stores (thousands of orders) may take several minutes to fully sync.

---

## API details (for developers)

| Detail | Value |
|---|---|
| Base URL | `https://api.lemonsqueezy.com/v1` |
| Auth | `Authorization: Bearer {api_key}` |
| Format | JSON:API (`application/vnd.api+json`) |
| Rate limit | 60 req/min |
| SDK | `@lemonsqueezy/lemonsqueezy.js` (official, TypeScript-native) |
| Webhook verification | HMAC-SHA256 via `X-Signature` header |
| Webhook event header | `X-Event-Name` |

### Key files

| File | Purpose |
|---|---|
| `lib/sync/lemonsqueezy.ts` | Core sync engine — validation, webhook registration, pull sync, individual record sync |
| `app/api/connections/lemonsqueezy/route.ts` | `POST` connect (validate + store key + register webhook + initial sync); `DELETE` disconnect |
| `app/api/sync/lemonsqueezy/route.ts` | `POST` manual on-demand sync |
| `app/api/webhooks/lemonsqueezy/route.ts` | `POST` real-time webhook ingestion + HMAC verification |

### Token storage

| Field in `connections` table | Stores |
|---|---|
| `encrypted_access_token` | AES-256-GCM encrypted Lemon Squeezy API key |
| `encrypted_refresh_token` | AES-256-GCM encrypted webhook signing secret |
| `metadata.store_id` | Lemon Squeezy store ID |
| `metadata.store_name` | Store display name |
| `metadata.webhook_id` | Registered webhook ID (if auto-registered) |

### Stripe acquisition note

Stripe acquired Lemon Squeezy in July 2024. As of mid-2026, Lemon Squeezy continues to operate independently at `api.lemonsqueezy.com` with no breaking API changes. Stripe is developing **Stripe Managed Payments** as a potential future migration path, but Lemon Squeezy remains fully operational with no announced deprecation date.
