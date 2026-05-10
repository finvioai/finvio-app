# Stripe Integration

Connects your Stripe account (read-only) so that charges, invoices, subscriptions, and payouts are automatically synced to your transaction ledger.

---

## How it works

### 1. Connect (Stripe Connect OAuth)

Click **Authorize with Stripe** on the Connections page. You are redirected to Stripe's OAuth consent screen where you grant read-only access to your account. No write permissions are requested.

After authorization, Finvio:
- Stores your encrypted access token and the connected account ID
- Runs an initial sync covering the last 30 days of data

### 2. What is synced

| Stripe object | Direction | Transaction type |
|---------------|-----------|-----------------|
| Charge (paid) | → income | One-time revenue |
| Charge refund | → expense | Refund |
| Invoice (paid) | → income | Subscription billing |
| Payout | → income | Bank transfer from Stripe balance |
| Customer | → customers table | For MRR / churn metrics |
| Subscription | → subscriptions table | For MRR calculation |

### 3. Token storage

Stripe Connect issues an OAuth access token (`sk_live_...`) scoped to read-only access. Finvio:
- Encrypts the token with AES-256-GCM before storing it in the database
- Uses it directly as a Stripe API key to call the Stripe API on behalf of the connected account
- Also stores the `stripe_user_id` (connected account ID, e.g. `acct_...`) in `metadata`

### 4. Deduplication

All sync operations are idempotent via `source_ref_id` (the Stripe entity ID, e.g. `ch_...`):
- If a record already exists and is active, it is skipped
- If a record was soft-deleted (after a disconnect with "Remove imported data"), it is restored on reconnect rather than skipped as a false duplicate

---

## Privacy

- **Stripe Connect OAuth.** Finvio requests `read_write` scope (required by Stripe Connect — `read_only` is not available for standard Connect apps). Finvio only ever reads data; it does not create, update, or delete anything in your Stripe account.
- **Tokens encrypted at rest.** Access tokens are encrypted with AES-256-GCM before database storage.

---

## Sync schedule

| Trigger | Behavior |
|---------|----------|
| On connect / reconnect | Full 30-day lookback sync |
| Manual "Sync Now" | Last 30 days (idempotent — duplicates are skipped) |
| Daily cron (02:00 UTC) | Same as manual sync |
| Stripe webhook (optional) | Real-time event-driven sync |

---

## Setup guide (developers)

### 1. Enable Stripe Connect

1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com) → **Settings → Connect**
2. Enable OAuth for your platform
3. Under **Redirects**, add your callback URL:
   - Production: `https://finvio-app.vercel.app/api/connections/stripe/callback`
   - Local: `http://localhost:3004/api/connections/stripe/callback`
4. Copy the **client_id** (starts with `ca_`) — this is your `STRIPE_CLIENT_ID`

### 2. Set environment variables

```bash
STRIPE_CLIENT_ID=ca_...            # From Stripe Connect settings (client_id)
STRIPE_SECRET_KEY=sk_live_...      # Your platform's secret key (used for OAuth token exchange + webhooks)
STRIPE_REDIRECT_URI=https://finvio-app.vercel.app/api/connections/stripe/callback
```

> **Local development:** Set `STRIPE_REDIRECT_URI=http://localhost:3004/api/connections/stripe/callback` and add this URL under Connect settings → Redirects.

### 3. (Optional) Webhook for real-time sync

Create a webhook in the Stripe dashboard pointing to `/api/webhooks/stripe` and add `STRIPE_WEBHOOK_SECRET` to your env. The webhook handles the same events as the pull sync but in real-time.

---

## MRR calculation

Stripe subscriptions are the primary MRR source:
- Monthly subs: `amount` as-is
- Yearly subs: `amount / 12`

Falls back to summing income transactions if no subscription records exist.

---

## Reconciliation

Stripe `payout_*` transactions are matched against Plaid bank deposits with:
- Same amount (±$0.01)
- Arrival date within ±3 days of Plaid transaction date

Matched pairs are marked `is_reconciled = true` and Plaid deposits are excluded from income totals (Stripe is authoritative).

---

## Disconnect

On the Connections page, click **Disconnect** next to Stripe. You will be asked whether to:

- **Keep imported data** — preserves all Stripe-sourced transactions in your ledger
- **Remove imported data** — soft-deletes all transactions with `source = 'stripe'`

The encrypted access token is cleared from the database in either case. Reconnecting always starts with a fresh 30-day lookback, so previously removed data is correctly re-imported. To fully revoke app access at Stripe's side, visit [dashboard.stripe.com/settings/apps](https://dashboard.stripe.com/settings/apps).

---

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
