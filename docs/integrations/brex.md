# Brex Integration

Connects your Brex corporate card and banking account to automatically sync card transactions and cash account movements into Finvio's expense and income tracking.

---

## What gets synced

| Brex data | How it appears in Finvio |
|---|---|
| Card transactions (CLEARED) | Expense transactions |
| Cash account credits (ACH, wire, check deposits) | Income transactions |
| Cash account debits (ACH, wire, outgoing payments) | Expense transactions |
| Cash account card settlement batches | **Skipped** — avoids double-counting individual card charges |
| Pending / Declined card transactions | **Skipped** — only cleared transactions are imported |
| Account available balance | Cash balance / runway calculation |

---

## Authentication

Brex uses **OAuth 2.0 with PKCE** (Proof Key for Code Exchange). Finvio uses a one-click "Authorize with Brex" flow — no API tokens or secrets to copy.

**PKCE** means the authorization request is cryptographically bound to the device that started it. Even if someone intercepts the authorization code, they cannot exchange it for tokens without the code verifier stored in your browser session.

---

## Setup guide

### Step 1 — Register a Brex OAuth app (one-time platform setup)

> If you are a Finvio user connecting your Brex account, skip this step — the platform admin does it once.

1. Go to [developer.brex.com](https://developer.brex.com)
2. Create a new application
3. Set the **Redirect URI** to:
   ```
   https://your-domain.com/api/connections/brex/callback
   ```
4. Request the following scopes:
   - `openid`
   - `offline_access`
   - `transactions.readonly`
   - `accounts.readonly`
5. Copy the **Client ID** and **Client Secret** into your environment variables

### Step 2 — Connect in Finvio

1. Go to **Connections** (`/connections`) in Finvio
2. Click **Authorize with Brex**
3. You are redirected to Brex's authorization page — log in and approve access
4. You are redirected back to Finvio

Finvio will:
- Exchange the authorization code for access + refresh tokens (PKCE)
- Fetch your company name and cash account balances
- Run an initial sync (last 90 days of card and cash transactions)

### Step 3 — Verify

- **Connections page**: Shows your company name and last sync time with live cash balance
- **Transactions page**: Brex transactions appear tagged as source `brex`
- **Dashboard**: Cash balance and runway now reflect your Brex account balance

---

## Environment variables

```bash
BREX_CLIENT_ID=your_brex_app_client_id
BREX_CLIENT_SECRET=your_brex_app_client_secret
# Optional: override the callback URL (defaults to NEXT_PUBLIC_APP_URL/api/connections/brex/callback)
BREX_REDIRECT_URI=https://your-domain.com/api/connections/brex/callback
```

> **Brex does not have a sandbox environment** accessible to third parties. Use your live Brex account credentials to connect. For development, connect a real Brex account or mock the sync endpoint locally.

---

## Transaction types

### Card transactions

Synced from `GET /v2/transactions/card/primary`. These represent individual charges made on Brex corporate cards.

- **Type in Finvio**: always `expense`
- **Amount**: positive dollar value (cents ÷ 100)
- **Date**: `posted_at_date` if available, otherwise `initiated_at_date`
- **Description**: merchant `raw_descriptor` or transaction description
- **Skipped**: `PENDING` and `DECLINED` statuses
- **Source ref**: `brex_card_{id}`

### Cash account transactions

Synced from `GET /v2/transactions/cash`. These represent movements in the Brex business banking account.

- **Type in Finvio**: `income` (positive amount = credit) or `expense` (negative amount = debit)
- **Amount**: absolute dollar value (|cents| ÷ 100)
- **Date**: `date` field (settlement date)
- **Skipped**: `CARD` type entries (batch card statement settlements — already imported individually from the card endpoint)
- **Source ref**: `brex_cash_{id}`

---

## Cash balance

Finvio sums the `available_balance` across all active Brex cash accounts. This total is:
- Stored in `connections.metadata.balance`
- Used as part of the primary cash balance in Dashboard and runway calculations
- Refreshed after every sync

If you have Brex **and** Mercury and/or Plaid connected, their balances are **summed** (they represent different accounts). The dashboard shows the total.

---

## Token management

| Field | Contents |
|---|---|
| `encrypted_access_token` | AES-256-GCM encrypted current Brex access token |
| `encrypted_refresh_token` | AES-256-GCM encrypted Brex refresh token |
| `metadata.balance` | Latest `available_balance` sum across cash accounts |

**Access token lifetime**: Brex access tokens expire in ~1 hour. Finvio automatically refreshes them before every sync using the stored refresh token. If the refresh token is revoked (e.g., you disconnect in Brex's dashboard), the next sync will fail with a reconnect prompt.

---

## Reconciliation

Brex cash credits (ACH in, wire in) are included in the bank deposit pool for reconciliation against Stripe payouts. If Stripe is also connected:

1. The reconciliation engine (`lib/sync/reconciliation.ts`) matches Stripe payout transactions against Brex cash credit transactions by amount (±$0.01) within ±3 days
2. Matched pairs are flagged `is_reconciled = true` — preventing double-counting in P&L

Card transactions are not subject to reconciliation (they are direct expenses, not payments from customers).

---

## Disconnecting

1. Go to **Connections → Brex → Disconnect**
2. Choose:
   - **Keep data**: Brex transactions remain in Finvio (recommended)
   - **Remove data**: Deletes all Brex transactions (soft-delete)

After disconnecting in Finvio, also revoke the OAuth connection in your Brex dashboard under **Settings → Connected Apps** to prevent orphaned access.

---

## Developer notes

### Key files

| File | Purpose |
|---|---|
| `lib/sync/brex.ts` | Core: PKCE helpers, OAuth exchange, token refresh, card/cash sync, balance update |
| `app/api/connections/brex/route.ts` | `GET` initiate OAuth (sets PKCE state cookies); `DELETE` disconnect |
| `app/api/connections/brex/callback/route.ts` | `GET` OAuth callback — verifies state, exchanges code, runs initial sync |
| `app/api/sync/brex/route.ts` | `POST` manual on-demand sync |
| `lib/sync/reconciliation.ts` | Batch reconciliation extended to include Brex cash deposits |
| `lib/metrics/index.ts` | `getCashBalance` and `getDataCompleteness` updated to include Brex |

### OAuth flow (PKCE)

```
1. GET /api/connections/brex
   └─ generates state + code_verifier (random 32 bytes, base64url)
   └─ code_challenge = SHA256(code_verifier), base64url-encoded
   └─ sets cookies: brex_oauth_state, brex_code_verifier (httpOnly, 10min TTL)
   └─ redirects to https://accounts.brex.com/oauth2/v1/auth?...

2. User authorizes on Brex → redirects to /api/connections/brex/callback?code=...&state=...

3. GET /api/connections/brex/callback
   └─ validates state cookie (CSRF protection)
   └─ reads code_verifier from cookie
   └─ POST https://accounts.brex.com/oauth2/v1/token (code + code_verifier)
   └─ stores encrypted access_token + refresh_token
   └─ runs initial sync
   └─ clears PKCE cookies
   └─ redirects to /connections?connected=brex
```

### Brex API reference

| Detail | Value |
|---|---|
| Authorization URL | `https://accounts.brex.com/oauth2/v1/auth` |
| Token URL | `https://accounts.brex.com/oauth2/v1/token` |
| API base URL | `https://platform.brexapis.com` |
| Auth | `Authorization: Bearer {access_token}` |
| Token auth (exchange/refresh) | `Authorization: Basic {base64(client_id:client_secret)}` |
| Cash accounts | `GET /v2/accounts/cash` |
| Card transactions | `GET /v2/transactions/card/primary` |
| Cash transactions | `GET /v2/transactions/cash` |
| Company info | `GET /v1/company` |
| Pagination | Cursor-based (`next_cursor` field; pass as `cursor` query param) |
| Date filter | `start_date=YYYY-MM-DD` query param |
| Rate limits | Contact Brex support — not published |
| Sandbox | Not available to third parties |
| Docs | https://developer.brex.com |
