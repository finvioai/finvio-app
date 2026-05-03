# Integration — Stripe

## Setup

Stripe uses a **per-user key model** — each organization enters their own Stripe secret key through the web UI. No server-side env var is needed for the user-facing integration.

1. Go to **Connections** page → **Connect Stripe**
2. Paste your Stripe secret key (`sk_live_…` or `sk_test_…`) from [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
3. Finvio validates the key against the Stripe API and stores it encrypted (AES-256-GCM) in the database
4. Click **Sync Now** to pull the last 30 days of charges, customers, and subscriptions
5. *(Optional)* Create a webhook in Stripe dashboard pointing to `/api/webhooks/stripe` and add `STRIPE_WEBHOOK_SECRET` to your env for real-time event sync

## Key storage

- User's Stripe secret key is stored in the `connections` table as `encrypted_access_token` (AES-256-GCM, requires `ENCRYPTION_KEY` env var)
- At sync time, the key is decrypted server-side and used to initialize the Stripe client
- The `STRIPE_SECRET_KEY` env var is a fallback for cron jobs / webhooks but is **not required** for the per-user UI connection flow

## Webhook ingestion

**Route**: `POST /api/webhooks/stripe`

- Verifies Stripe signature using `STRIPE_WEBHOOK_SECRET`
- Checks `webhook_events` table for duplicate event IDs (idempotency)
- Handles:

| Event | Action |
|---|---|
| `charge.succeeded` | Creates income transaction |
| `charge.refunded` | Creates refund expense transaction |
| `invoice.paid` | Creates income transaction for subscription invoices |
| `customer.subscription.created/updated` | Upserts subscription record |
| `customer.subscription.deleted` | Marks subscription cancelled |
| `customer.created/updated` | Upserts customer record |
| `payout.paid` | Creates income transaction (tagged for reconciliation) |

## On-demand sync

**Route**: `POST /api/sync/stripe`

Triggers a full pull of the last 30 days of charges, customers, and subscriptions. Useful after initial connection. All operations are idempotent via `source_ref_id`.

## MRR calculation

Stripe subscriptions are the primary MRR source:
- Monthly subs: `amount` as-is
- Yearly subs: `amount / 12`

Falls back to summing income transactions if no subscription records exist.

## Reconciliation

Stripe `payout_*` transactions are matched against Plaid bank deposits with:
- Same amount (±$0.01)
- Arrival date within ±3 days of Plaid transaction date

Matched pairs are marked `is_reconciled = true` and Plaid deposits are excluded from income totals (Stripe is authoritative).
