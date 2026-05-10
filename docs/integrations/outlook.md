# Outlook Integration

Connects your Microsoft Outlook / Office 365 mailbox (read-only) so that financial emails — payment receipts, invoices, billing statements, subscription renewals — are automatically detected and added to your transaction ledger..

---

## How it works

The Outlook integration follows the same pipeline as Gmail. See [gmail.md](./gmail.md) for a full description of the email filtering, extraction, deduplication, invoice matching, and review queue behaviour. This document covers Outlook-specific details.

### 1. Connect (Microsoft OAuth 2.0)

Click **Authorize with Outlook** on the Connections page. You are redirected to Microsoft's OAuth consent screen where you grant read-only access to your mailbox. No write or send permissions are requested.

After authorization, Finvio:
- Stores your encrypted access and refresh tokens
- Runs an initial sync covering the last 90 days of emails

### 2. Incremental sync (delta tokens)

Unlike Gmail (which uses date-based filtering), Outlook uses Microsoft Graph's **delta sync** mechanism:

- On first sync: all messages from the last 90 days are fetched
- Subsequent syncs: Microsoft Graph returns only messages added or changed since the last sync, via a `@odata.deltaLink` stored in the connection's `sync_cursor`
- This makes incremental syncs very efficient — only new emails are fetched

### 3. Token rotation

Microsoft rotates refresh tokens on every use. Each time the sync runs:
1. The current refresh token is used to get a new access token
2. Microsoft issues a new refresh token alongside the new access token
3. Both are immediately encrypted and saved back to the database

If the refresh token is lost or expires (tokens expire after 90 days of inactivity), the connection status becomes invalid and the user must reconnect.

---

## Privacy

- **Read-only access only.** Finvio requests `Mail.Read` (delegated) — it can read messages, but cannot send, delete, or modify anything.
- **Minimal data stored.** Only subject, sender, date, and first 2,000 chars of body are processed. Full email content is not stored.
- **Tokens encrypted at rest.** Access and refresh tokens are encrypted with AES-256-GCM before database storage.

---

## Sync schedule

| Trigger | Behavior |
|---------|----------|
| On connect / reconnect | Full 90-day sync using date filter |
| Manual "Sync Now" | Delta sync (only new emails since last sync) |
| Daily cron (02:00 UTC) | Same as manual sync |

---

## Setup guide (developers)

### 1. Register an Azure app

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory → App registrations → New registration**
2. Name: e.g., `Finvio Outlook Integration`
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (for broad compatibility)
4. Redirect URI: Select **Web** platform and enter your callback URL:
   - Production: `https://your-app.vercel.app/api/connections/outlook/callback`
   - Local: `http://localhost:3004/api/connections/outlook/callback`
5. Click **Register**

### 2. Add API permissions

1. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**
2. Add: `Mail.Read`, `User.Read`, `offline_access`
3. Click **Grant admin consent** if required for your tenant

### 3. Create a client secret

1. **Certificates & secrets → New client secret**
2. Set an expiry (24 months recommended)
3. Copy the **Value** immediately (it won't be shown again)

### 4. Set environment variables

```bash
OUTLOOK_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # Application (client) ID
OUTLOOK_CLIENT_SECRET=your-client-secret-value
OUTLOOK_REDIRECT_URI=https://your-app.vercel.app/api/connections/outlook/callback
```

> **Local development:** Set `OUTLOOK_REDIRECT_URI=http://localhost:3004/api/connections/outlook/callback` and add this URL under **Authentication → Redirect URIs** in your Azure app.

---

## Limitations

- Same keyword and regex limitations as Gmail (see [gmail.md](./gmail.md#limitations))
- Microsoft refresh tokens expire after **90 days of inactivity** — if a user doesn't sync for 90 days, they must reconnect
- Delta tokens can become invalid if Microsoft resets the mailbox state — the sync falls back gracefully to a full re-sync in that case
- Graph API throttling: 10,000 requests per 10 minutes per app per tenant — large mailboxes may be rate-limited on first sync

---

## Disconnect

On the Connections page, click **Disconnect** next to Outlook. You will be asked whether to:

- **Keep imported data** — preserves all Outlook-sourced transactions in your ledger
- **Remove imported data** — soft-deletes all transactions with `source = 'outlook'`

Tokens, the delta cursor (`sync_cursor`), and `last_synced_at` are all cleared from the database. Reconnecting always starts with a fresh 90-day lookback, so previously removed data is correctly re-imported. To fully revoke app access at Microsoft's side, visit [myapps.microsoft.com](https://myapps.microsoft.com).
