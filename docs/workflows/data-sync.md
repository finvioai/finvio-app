# Data Sync — How Finvio Fetches Data

Finvio pulls financial data from four integration providers. Each provider has its own authentication model and sync logic, but they all write to the same `transactions` table using the same shape.

## Connection Model

All connections use **per-user (per-org) credentials** stored encrypted in the `connections` table. There are no platform-level API keys for any provider — each organization connects their own account.

```
connections table
├── org_id
├── provider ('stripe' | 'plaid' | 'shopify' | 'paypal')
├── status ('active' | 'setup' | 'disconnected')
├── encrypted_access_token    — AES-256-GCM encrypted
├── encrypted_refresh_token   — used by Plaid for the Plaid secret
├── encrypted_item_id         — used by Plaid for the item_id
├── account_name              — display name shown in UI
├── metadata (JSONB)          — provider-specific extras
├── sync_cursor               — Plaid: transactions cursor
└── last_synced_at
```

Encryption/decryption happens in [lib/encryption.ts](../../lib/encryption.ts) using AES-256-GCM with the `ENCRYPTION_KEY` env var.

---

## Stripe

**File:** [lib/sync/stripe.ts](../../lib/sync/stripe.ts)  
**Auth:** Per-org Stripe secret key (sk_live_* or sk_test_*)  
**Sync trigger:** Auto on connect + manual "Sync Now" + daily cron

### Credential Flow

```
User enters sk_* key in Connections modal
  → POST /api/connections/stripe validates key via stripe.accounts.retrieve(null)
  → encrypt(key) stored in encrypted_access_token
  → runStripePullSync() called immediately
```

`getStripeClientForOrg(orgId, supabase)` is used by all sync functions — it decrypts the stored key and creates a Stripe client. Falls back to `STRIPE_SECRET_KEY` env var if no DB key exists.

### What Gets Synced

**Charges** (`stripe.charges.list`, last 30 days):
- `status = 'succeeded'` → income transaction (source_ref_id: `charge.id`)
- `refunded = true` → also creates an expense transaction (source_ref_id: `refund_${charge.id}`)
- Amount converted from cents → dollars

**Customers** (`stripe.customers.list`):
- Upserted into `customers` table by `external_id = customer.id`
- Name, email, plan, status stored

**Subscriptions** (`stripe.subscriptions.list`):
- Upserted into `subscriptions` table by `external_id = subscription.id`
- `interval = 'month'` → `amount_monthly = price.unit_amount / 100`
- `interval = 'year'` → `amount_monthly = price.unit_amount / 1200`
- Used for MRR calculation

**Invoices** (via `invoice.paid` webhook or pull sync):
- Creates income transaction (source_ref_id: `invoice_${invoice.id}`)

**Payouts** (`stripe.payouts.list`):
- Creates income transaction (source_ref_id: `payout_${payout.id}`)
- These represent money arriving in your bank from Stripe

---

## Plaid

**File:** [lib/sync/plaid.ts](../../lib/sync/plaid.ts)  
**Auth:** Two-step flow — first save Plaid developer credentials, then link bank account via Plaid Link  
**Sync trigger:** Manual "Sync Now" + daily cron

### Two-Step Connection

**Step 1 — Save Plaid credentials (status = 'setup'):**
```
User enters Plaid client_id + secret in modal
  → POST /api/connections/plaid { action: 'setup', client_id, secret, plaid_env }
  → Validates by creating a test link token
  → encrypted_refresh_token = encrypt(secret)
  → metadata = { plaid_client_id, plaid_env }
  → status = 'setup'
```

**Step 2 — Link bank account (status = 'active'):**
```
Frontend opens Plaid Link using the stored credentials
  → POST /api/connections/plaid { action: 'exchange', publicToken }
  → exchangePublicToken() called
  → access_token received from Plaid, encrypted and stored
  → item_id stored in encrypted_item_id
  → status = 'active'
```

### Transaction Sync

Uses Plaid's **cursor-based incremental sync** (`transactionsSync` API):
- First sync: no cursor → gets all historical transactions
- Subsequent syncs: uses stored `sync_cursor` → only gets new/modified transactions
- Handles `added` and `modified` transactions in the same loop
- Skips `pending` transactions (not yet settled)
- After sync, stores new cursor in `connections.sync_cursor`

**Amount interpretation:**
- Plaid amount positive → debit from account → stored as `type = 'expense'`
- Plaid amount negative → credit to account → stored as `type = 'income'`

---

## PayPal

**File:** [lib/sync/paypal.ts](../../lib/sync/paypal.ts)  
**Auth:** Per-org PayPal REST API client credentials  
**Sync trigger:** Manual "Sync Now" + daily cron

### Credential Flow

```
User enters PayPal client_id + client_secret in modal
  → POST /api/connections/paypal validates via OAuth client_credentials grant
  → encrypted_access_token = encrypt(clientSecret)
  → account_name = clientId
  → metadata = { sandbox, paypal_client_id }
```

### Access Token Refresh

PayPal access tokens expire. Each sync call fetches a fresh token:
```
Base64(clientId:clientSecret) → POST /v1/oauth2/token (grant_type=client_credentials)
  → Bearer token for API calls
```

### Transaction Sync

- Fetches `/v1/reporting/transactions` with 30-day lookback
- Page size: 500 per request, paginated by `page` number
- Only imports transactions with `transaction_status = 'S'` (success)
- Positive amounts → income, negative → expense

---

## Shopify

**File:** [lib/sync/shopify.ts](../../lib/sync/shopify.ts)  
**Auth:** Per-org Shopify Admin API access token (custom app)  
**Sync trigger:** Manual "Sync Now" + daily cron

### Credential Flow

```
User creates Custom App in Shopify Admin → copies Admin API access token
  → POST /api/connections/shopify { shop, access_token }
  → Validates via GET /admin/api/2024-01/shop.json with X-Shopify-Access-Token header
  → encrypt(access_token) stored
  → account_name = shop.name
```

### Order Sync

- Fetches `/admin/api/2024-01/orders.json?financial_status=paid`
- 30-day lookback window
- Limit 250 per page, follows Link header pagination (`rel="next"`)
- All paid orders → `type = 'income'`

---

## Sync API Routes

Manual sync is triggered from the Connections page "Sync Now" button:

| Route | Calls |
|-------|-------|
| `POST /api/sync/stripe` | `runStripePullSync()` |
| `POST /api/sync/plaid` | `syncPlaidTransactions()` |
| `POST /api/sync/paypal` | `syncPayPalTransactions()` |
| `POST /api/sync/shopify` | `syncShopifyOrders()` |

All routes: auth check → fetch org → fetch active connection → call sync → return `{synced, skipped}`.

---

## Sync Logging

Every sync operation creates a row in `sync_logs`:

```
sync_logs
├── org_id
├── connection_id
├── provider
├── sync_type ('incremental' | 'full' | 'webhook')
├── status ('running' → 'success' | 'error')
├── records_synced
├── records_skipped
├── error_message
├── started_at
└── completed_at
```

The log is written at the start (`status = 'running'`), then updated at the end. If the sync throws, the log records the error message and `status = 'error'`.

---

## QuickBooks Online

**File:** [lib/sync/quickbooks.ts](../../lib/sync/quickbooks.ts)
**Auth:** Platform OAuth 2.0 — Finvio registers one QuickBooks developer app; each user authorizes their own QB company through it
**Sync trigger:** Auto on connect + manual "Sync Now" + daily cron

### Connection Flow

```
User clicks "Authorize with QuickBooks" on Connections page
  → GET /api/connections/quickbooks generates OAuth state (CSRF cookie) → redirects to QuickBooks
  → User logs in and authorizes their QB company
  → QuickBooks redirects to /api/connections/quickbooks/callback with code + realmId
  → Code exchanged for access_token + refresh_token (via QB token endpoint)
  → Tokens encrypted, company name fetched, stored in connections table
  → syncQuickBooksData() called immediately (auto-sync on connect)
  → User redirected to /connections?connected=quickbooks
```

Required env vars: `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `QB_ENVIRONMENT` (`sandbox`/`production`).  
Redirect URI to register: `https://your-domain/api/connections/quickbooks/callback`

### Token Refresh

QuickBooks access tokens expire after ~1 hour. Refresh tokens last ~100 days. Every sync call automatically refreshes the access token using the stored refresh token before making any API calls, then updates `encrypted_access_token` in the database.

### What Gets Synced

**Purchases** (expenses) via IQL query:
- `SELECT * FROM Purchase WHERE TxnDate >= '{30 days ago}' MAXRESULTS 1000`
- Mapped to expense transactions, vendor from `EntityRef.name`, description from first line item
- `source_ref_id: qb_purchase_{Id}`

**Paid Invoices** (income) via IQL query:
- `SELECT * FROM Invoice WHERE TxnDate >= '{30 days ago}' AND Balance = '0' MAXRESULTS 1000`
- Balance=0 means fully paid. Description includes customer name from `CustomerRef.name`
- `source_ref_id: qb_invoice_{Id}`

**Sales Receipts** (income — immediate payments):
- `SELECT * FROM SalesReceipt WHERE TxnDate >= '{30 days ago}' MAXRESULTS 1000`
- `source_ref_id: qb_receipt_{Id}`

---

## Daily Cron (Production)

**File:** `app/api/cron/daily-sync/route.ts`  
**Schedule:** `vercel.json` cron config

In production on Vercel, the cron job runs daily and calls the sync routes for all orgs that have active connections. On localhost, you need to trigger "Sync Now" manually or use the Stripe CLI for real-time webhooks.
