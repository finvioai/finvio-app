# Integration — QuickBooks Online

## How it works

QuickBooks uses **platform OAuth 2.0** — Finvio registers one QuickBooks developer app, and each user authorizes their own QuickBooks company through it. Users do not need developer credentials; they just click "Authorize with QuickBooks" and log in.

## Setup (one-time, by the Finvio developer)

1. Register an app at [developer.intuit.com](https://developer.intuit.com)
2. Set the OAuth 2.0 redirect URI to `https://your-domain/api/connections/quickbooks/callback`
3. Add to environment:
   ```
   QB_CLIENT_ID=your_client_id
   QB_CLIENT_SECRET=your_client_secret
   QB_ENVIRONMENT=sandbox   # or production
   ```
4. Required OAuth scope: `com.intuit.quickbooks.accounting`

## User connection flow

1. Go to **Connections** → **Authorize with QuickBooks**
2. Redirected to QuickBooks sign-in — log in and click **Connect**
3. QuickBooks redirects back to Finvio with an authorization code
4. Finvio exchanges the code for access + refresh tokens, fetches your company name, and runs an initial sync automatically
5. You land back on the Connections page with a success message

## What gets synced

| QB entity | Maps to | Finvio transaction type |
|-----------|---------|------------------------|
| Purchase | Vendor payments, credit card charges | expense |
| Invoice (Balance = 0) | Paid customer invoices | income |
| SalesReceipt | Point-of-sale / immediate payments | income |

Lookback window: last 30 days per sync. Deduplication via `source_ref_id`:
- Purchases: `qb_purchase_{Id}`
- Invoices: `qb_invoice_{Id}`
- Sales receipts: `qb_receipt_{Id}`

If you disconnect with **Remove imported data** and reconnect, QuickBooks records are correctly re-imported — soft-deleted records are restored rather than skipped as false duplicates.

## On-demand sync

**Route**: `POST /api/sync/quickbooks`

Triggered by "Sync Now" on the Connections page, and automatically on first connect. All operations are idempotent.

## Token management

- Access tokens expire in ~1 hour. Every sync call automatically refreshes via the stored refresh token.
- Refresh tokens expire in ~100 days. If a refresh token expires, the user must reconnect (click "Authorize with QuickBooks" again).
- Both tokens are stored AES-256-GCM encrypted in the `connections` table:
  - `encrypted_access_token` — QB access token
  - `encrypted_refresh_token` — QB refresh token
  - `metadata.realm_id` — QuickBooks company ID (realmId)
  - `metadata.environment` — `sandbox` or `production`
  - `metadata.refresh_token_expires_at` — ISO timestamp for expiry tracking

## Disconnect

Clicking **Disconnect** on the Connections page calls `DELETE /api/connections/quickbooks`, which clears both tokens and sets status to `disconnected`. The user can choose to **Keep imported data** or **Remove imported data** (soft-deletes all `source = 'quickbooks'` transactions). Reconnecting will correctly re-import any removed data.

## IQL queries used

QuickBooks uses a SQL-like query language (IQL). Finvio queries:

```sql
-- Expenses
SELECT * FROM Purchase WHERE TxnDate >= '2024-04-01' MAXRESULTS 1000

-- Paid invoices (income)
SELECT * FROM Invoice WHERE TxnDate >= '2024-04-01' AND Balance = '0' MAXRESULTS 1000

-- Sales receipts (income)
SELECT * FROM SalesReceipt WHERE TxnDate >= '2024-04-01' MAXRESULTS 1000
```

All queries use `minorversion=65` for the latest stable API version.

## Sandbox vs production

Set `QB_ENVIRONMENT=sandbox` while testing. Sandbox uses QuickBooks test data and a different API base URL:
- Sandbox: `https://sandbox-quickbooks.api.intuit.com`
- Production: `https://quickbooks.api.intuit.com`

The authorization URL and token exchange URL are the same for both environments.
