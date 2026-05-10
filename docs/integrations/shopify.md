# Shopify Integration

Connects your Shopify store (read-only) so that paid orders are automatically imported as income transactions in your ledger.

---

## How it works

### 1. Connect (one-click OAuth)

Click **Connect Shopify** on the Connections page. Enter your store name (e.g. `my-store`) and click **Authorize with Shopify**. You are taken to Shopify's standard authorization screen — log in and approve access. No API tokens or developer steps required on your end.

After authorization, Finvio:
- Stores your encrypted access token
- Shows your store name on the Connections card

### 2. Sync

Each paid Shopify order becomes one income transaction:

| Shopify field | Finvio field |
|---------------|--------------|
| `order.id` | `source_ref_id` (`shopify_<id>`) |
| `order.name` | `description` (`Shopify Order #1234`) |
| `order.total_price` | `amount` |
| `order.created_at` | `date` |
| `order.currency` | `currency` |
| `order.financial_status = paid` | Only paid orders are synced |

Transactions land in the review queue (`is_reviewed: false`) and are auto-categorized.

### 3. Deduplication

`source_ref_id = shopify_<order_id>` prevents the same order from being imported twice regardless of how many times you sync.

---

## Sync schedule

| Trigger | Behavior |
|---------|----------|
| Manual "Sync Now" | Last 30 days of paid orders |
| Daily cron (02:00 UTC) | Same as manual |

> First sync is not triggered automatically on connect — click **Sync Now** after connecting to import your orders.

---

## Setup guide (developers)

Shopify OAuth requires a **Shopify Partner app**. This is a one-time setup per deployment — your users never see these steps.

### 1. Create a Shopify Partner app

1. Go to [partners.shopify.com](https://partners.shopify.com) → **Apps → Create app**
2. Choose **Public app** (works for any store) or **Custom app** (single-store only)
3. App name: anything (e.g. `Finvio`)

### 2. Configure the app

In your app's **App setup** tab:

- **Allowed redirection URL(s):**
  - Production: `https://your-app.vercel.app/api/connections/shopify/callback`
  - Local: `http://localhost:3000/api/connections/shopify/callback`

In **Configuration → Admin API scopes**, add only:
- `read_orders` — the only scope required; no customer-specific scopes are needed

### 3. Request protected customer data access (required for orders API)

Shopify considers the Orders API a protected customer data endpoint even when no customer fields are requested. You must complete this step or the sync will return 403.

1. Partner Dashboard → your app → **API access requests**
2. Under **Protected customer data access** → click **Request access**
3. Check **Analytics** and **App functionality**
4. Leave all customer field options (Name, Email, Phone, Address) **unchecked** — the sync uses GraphQL and requests no customer PII
5. Save — development access is granted immediately for dev stores; App Store review is only required for distributed apps

### 4. Set environment variables

```bash
SHOPIFY_API_KEY=your-api-key        # labeled "API key" in Partner Dashboard
SHOPIFY_API_SECRET=your-api-secret  # labeled "API secret key"
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

The redirect URI is built automatically from `NEXT_PUBLIC_APP_URL` — no separate env var needed.

---

## Technical notes

The sync uses the **GraphQL Admin API** (`/admin/api/2024-01/graphql.json`) rather than the REST orders endpoint. This is intentional: the REST endpoint unconditionally returns customer PII in its response, triggering Shopify's protected customer data restriction even when customer data isn't needed. The GraphQL query requests only `id`, `name`, `totalPriceSet`, and `createdAt` — no customer fields at all.

---

## Limitations

- **Last 30 days only** on each sync — older orders are not backfilled automatically (adjust the `sinceIso` window in `lib/sync/shopify.ts` if needed)
- **Paid orders only** — draft, pending, and refunded orders are not imported
- **Multi-currency** — `currencyCode` from the order is stored as-is; no conversion to a base currency is performed
- **Refund transactions** — not currently created as offsetting expense entries

---

## Disconnect

On the Connections page, click **Disconnect** next to Shopify. You can choose to:

- **Keep imported data** — Shopify-sourced transactions remain in your ledger
- **Remove imported data** — soft-deletes all transactions with `source = 'shopify'`

The access token is removed from the database in either case.
