# Integration — PayPal

## Setup

1. Create a PayPal app at [developer.paypal.com](https://developer.paypal.com)
2. Add `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, and `PAYPAL_REDIRECT_URI` to environment variables
3. `PAYPAL_BASE_URL`:
   - Sandbox: `https://api-m.sandbox.paypal.com`
   - Production: `https://api-m.paypal.com`

## OAuth flow

1. User clicks Connect PayPal → `GET /api/connections/paypal` → redirects to PayPal OAuth
2. User authorizes → PayPal redirects to `GET /api/connections/paypal/callback`
3. Server exchanges code for `access_token` + `refresh_token`
4. Both tokens are encrypted and stored in `connections`

The refresh token is used to silently renew the access token on each sync (PayPal access tokens expire in 8 hours).

## Transaction sync

**Route**: `POST /api/sync/paypal`

Uses PayPal's Reporting API (`/v1/reporting/transactions`) to pull settled transactions within a date range.

Each payment creates an income transaction:
- `source: 'paypal'`
- `source_ref_id: 'paypal_{transaction_id}'` for idempotency
- Only transactions with `transaction_status === 'S'` (success) are imported

If you disconnect with **Remove imported data** and reconnect, PayPal records are correctly re-imported — soft-deleted records are restored rather than skipped as false duplicates.

## Token refresh

On each sync, the server:
1. Decrypts the stored refresh token
2. Calls `POST /v1/oauth2/token` with `grant_type=refresh_token`
3. Re-encrypts and stores the new access token
4. Proceeds with the sync

If token refresh fails, the connection status is set to `error` and the sync aborts.
