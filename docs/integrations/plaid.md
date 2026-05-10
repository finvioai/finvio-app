# Integration — Plaid

## Setup

1. Add `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` to environment variables
2. Go to Connections page → Connect Bank Account
3. Plaid Link widget opens in a modal → user selects their bank and logs in

## Connection flow

1. Frontend calls `GET /api/connections/plaid` → receives a `link_token`
2. Plaid Link widget opens with the token
3. On success, frontend posts the `public_token` to `POST /api/connections/plaid`
4. Server exchanges `public_token` for `access_token` via Plaid API
5. `access_token` is AES-256-GCM encrypted and stored in `connections.encrypted_access_token`
6. Account name and last 4 digits are stored for display

## Transaction sync

**Route**: `POST /api/sync/plaid`

Uses Plaid's cursor-based `transactionsSync` API for efficient incremental updates. The cursor is persisted in `connections.sync_cursor` and reused on subsequent syncs.

- Pending transactions are skipped (Plaid marks them `pending: true`)
- Plaid amounts: positive = debit (expense), negative = credit (income)
- Each transaction goes through the 3-layer categorization engine
- If you disconnect with **Remove imported data** and reconnect, Plaid records are correctly re-imported — soft-deleted records are restored rather than skipped as false duplicates

## Reconciliation

Bank deposits that match Stripe payouts (same amount ±$0.01, within ±3 days) are marked reconciled and excluded from income calculations to avoid double-counting.

## Cash balance

The Plaid integration is the primary cash balance source. If connected, `getCashBalance()` uses account balance metadata from Plaid. Otherwise it falls back to cumulative income minus expenses from all transactions.

## Token security

- Access tokens are encrypted with AES-256-GCM before being stored
- Decryption only happens server-side in sync routes
- The key is stored in `ENCRYPTION_KEY` env var (never in the DB)
