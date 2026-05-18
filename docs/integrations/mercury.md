# Mercury Integration

Connects your Mercury business bank account to automatically sync transactions, track your real cash balance, and reconcile bank deposits against payment processor payouts.

---

## What gets synced

| Mercury data | How it appears in Finvio |
|---|---|
| ACH credits, wire deposits, check deposits | Income transactions |
| ACH debits, card transactions, wire payments, fees | Expense transactions |
| Account balances (sum of all active accounts) | Cash balance / runway calculation |
| Internal transfers | **Skipped** — inter-account movements are not P&L events |
| Failed / cancelled / reversed transactions | **Skipped** |
| Processor payouts landing in Mercury (Stripe, etc.) | Imported and **automatically reconciled** against the matching payout — not double-counted |

---

## Authentication

Mercury uses **API token authentication**. You generate a read-only token in your Mercury dashboard and paste it into Finvio.

> **No OAuth?** Mercury offers OAuth for registered partner apps, but it requires an application and approval process with Mercury. A read-only API token is the self-serve path and fully sufficient for Finvio's needs.

---

## Setup guide

### Step 1 — Generate a Mercury API token

1. Log in to [mercury.com](https://mercury.com)
2. Click your name (top-right) → **Settings**
3. Go to the **API Tokens** tab
4. Click **+ New token**
5. Give it a name (e.g., `Finvio`) and select **Read-only** scope
6. Copy the token — **it is shown only once**

> **Why Read-only?** Finvio only reads your transaction data — it never initiates payments. Read-only tokens don't require IP whitelisting, making setup instant.

> **Keep this token secret.** It grants read access to all your Mercury accounts and transactions. Treat it like a password.

### Step 2 — Connect in Finvio

1. Go to **Connections** (`/connections`) in Finvio
2. Click **Connect Mercury**
3. Paste your API token
4. Choose your environment: **Production** (live account) or **Sandbox** (test account)
5. Click **Connect Mercury**

Finvio will:
- Validate the token against your Mercury account
- Detect all active accounts and sum their available balances
- Register a webhook to receive real-time transaction events
- Run an initial sync (last 90 days of transactions)

### Step 3 — Verify

- **Connections page**: Shows account name and last sync time with your live cash balance
- **Transactions page**: Mercury transactions appear tagged as source `mercury`
- **Dashboard**: Cash balance and runway now reflect your real Mercury bank balance

---

## Environment variables

Mercury doesn't require server-side environment variables. The only relevant variable is:

```
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

Used for auto-registering the Mercury webhook. If missing or pointed at localhost, webhook registration is skipped and you must register manually (see below).

---

## Manual webhook setup (local dev or if auto-registration fails)

In production, webhook registration is automatic.

For local development or if auto-registration fails:

1. Log in to Mercury → **Settings → Webhooks**
2. Click **+ Add endpoint**
3. **URL:** `https://your-domain.com/api/webhooks/mercury`
4. **Events:** `transaction.created`, `transaction.updated`, `account.created`
5. Set a **Secret** (any strong random string, e.g., `openssl rand -hex 24`)

> The webhook secret is stored encrypted per-connection. Currently there is no dedicated environment variable for the Mercury webhook secret — it's stored in `connections.encrypted_refresh_token`.

---

## Reconciliation

When Mercury and a payment processor (Stripe, PayPal, etc.) are both connected, the same money appears twice:
- As a **processor payout** (recorded when Stripe/PayPal settles to your bank)
- As a **Mercury bank credit** (the actual deposit arriving in your account)

Without reconciliation, this would double-count your revenue.

**Finvio automatically reconciles these pairs:**
1. When a Mercury credit transaction is imported, it checks for a matching processor payout with the same amount (±$0.01) within ±4 days
2. If a match is found, both transactions are flagged as `is_reconciled = true` and linked via `reconciled_with`
3. The reconciliation engine (`lib/sync/reconciliation.ts`) also runs a batch pass after every sync to catch any pairs missed during import

**What counts as a reconcilable payout:**
- Stripe payouts (`source_ref_id LIKE 'payout_%'`, `source = 'stripe'`)
- Future: PayPal settlement, Shopify payout — same pattern

**Result for your metrics:**
- Revenue figures come from the payment processor (authoritative, transaction-level)
- Cash balance comes from Mercury's live `availableBalance`
- Runway calculation uses the actual bank balance, not estimated cash from transactions

---

## Cash balance

Finvio sums the `availableBalance` across all your active Mercury accounts (excluding Treasury accounts during initial sync). This total is:
- Stored in `connections.metadata.balance`
- Used as the primary cash balance in Dashboard and runway calculations
- Refreshed after every sync and after every real-time transaction webhook

If you have both Mercury **and** Plaid connected, their balances are **summed** (they represent different bank accounts). The dashboard shows the total.

---

## Transaction categories

Mercury transactions are auto-categorized using the same rules engine as all other sources:
- Credit transactions → categorized as income (e.g., `Service Revenue`, `One-time Revenue`)
- Debit transactions → categorized as expenses (e.g., `Payroll`, `SaaS Tools`, `Office`)
- `mercuryCategory` from Mercury's merchant classification enriches the description for better AI categorization

You can override any auto-assigned category in the **Transactions** page.

---

## Data details

### Which transactions are skipped

| Reason | Condition |
|---|---|
| Internal transfer | `kind === 'internalTransfer'` |
| Failed / cancelled | `status` in `['cancelled', 'failed', 'reversed', 'blocked']` |
| Already imported | `source_ref_id = 'mercury_{id}'` exists and is active |
| Processor payout match | Matched to a Stripe/PayPal payout → imported as reconciled, not as new revenue |

### Transaction date

Finvio uses `postedAt` (cleared/settled) if available, otherwise `createdAt` (initiated). This ensures your P&L reflects when money actually moved, not just when it was initiated.

### Pending transactions

Pending transactions (`status = 'pending'`) are imported. If a pending transaction is later reversed or cancelled, the next sync will skip it (since the reversal changes the status to `reversed`/`cancelled`). For pending transactions that were already imported, you can manually delete them if needed.

### Mercury Treasury accounts

Treasury accounts (`type = 'mercury_treasury'`) are money-market accounts. They are excluded from the 90-day transaction sync to avoid importing yield/interest as operating income. Their balance is included in the cash balance sum if they have an `availableBalance`.

---

## Sandbox mode

Mercury has a full sandbox environment with pre-seeded test data:

- **Sign up:** Create a sandbox account at [app.mercury.com](https://app.mercury.com) (the onboarding marks it as sandbox)
- **Token generation:** Same flow as production — Settings → API Tokens
- **Token format:** `mercury_sandbox_...` (sandbox tokens work only with the sandbox API URL)

Select **Sandbox** in the Finvio connect modal to use the sandbox URL (`api-sandbox.mercury.com`).

---

## Disconnecting

1. Go to **Connections → Mercury → Disconnect**
2. Choose:
   - **Keep data**: Mercury transactions remain in Finvio (recommended for reporting continuity)
   - **Remove data**: Deletes all Mercury transactions (soft-delete)

On disconnect, Mercury webhooks continue sending to your endpoint but are ignored (no active connection found). If you want to deregister the webhook, delete it manually in Mercury Settings → Webhooks.

---

## Developer notes

### Key files

| File | Purpose |
|---|---|
| `lib/sync/mercury.ts` | Core: token validation, transaction sync, balance update, reconciliation logic, pull sync |
| `lib/sync/reconciliation.ts` | Batch reconciliation — matches Stripe/PayPal payouts against Plaid **and Mercury** bank deposits |
| `app/api/connections/mercury/route.ts` | `POST` connect; `DELETE` disconnect |
| `app/api/sync/mercury/route.ts` | `POST` manual on-demand sync |
| `app/api/webhooks/mercury/route.ts` | `POST` real-time webhook ingestion + HMAC-SHA256 verification |
| `lib/metrics/index.ts` | `getCashBalance` and `getDataCompleteness` updated to include Mercury |

### Token storage

| `connections` field | Contents |
|---|---|
| `encrypted_access_token` | AES-256-GCM encrypted Mercury API token |
| `encrypted_refresh_token` | AES-256-GCM encrypted webhook signing secret |
| `metadata.balance` | Latest summed `availableBalance` across accounts |
| `metadata.sandbox` | `true` if sandbox environment |
| `metadata.account_ids` | Array of Mercury account UUIDs |
| `metadata.webhook_id` | Registered webhook ID |

### Webhook verification

Mercury signs webhooks with HMAC-SHA256:
- **Header:** `x-mercury-signature`
- **Secret:** the per-connection webhook secret stored in `encrypted_refresh_token`
- **Body:** raw request body bytes (before JSON parsing)
- **Algorithm:** `crypto.createHmac('sha256', secret).update(body).digest('hex')`
- **Comparison:** `crypto.timingSafeEqual` to prevent timing attacks

### Mercury API reference

| Detail | Value |
|---|---|
| Production base URL | `https://api.mercury.com/api/v1` |
| Sandbox base URL | `https://api-sandbox.mercury.com/api/v1` |
| Auth | `Authorization: Bearer {api_token}` |
| Accounts endpoint | `GET /accounts` |
| Transactions endpoint | `GET /account/{accountId}/transactions` |
| Webhook registration | `POST /webhooks` |
| Rate limits | Not published — contact api@mercury.com for quotas |
| Official SDK | None — use REST API directly |
| Docs | https://docs.mercury.com |

### OAuth (future / partner path)

Mercury does offer OAuth 2.0 (Authorization Code + PKCE) for registered partner apps. If Finvio applies for Mercury partnership, this would allow a one-click "Authorize with Mercury" flow like Stripe. Contact Mercury at their developer page to apply. Until then, the API token flow is the supported path.
