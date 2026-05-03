# Integration — Shopify

## Setup

1. Create a Shopify Partner app with the `read_orders` and `read_customers` scopes
2. Add `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, and `SHOPIFY_REDIRECT_URI` to environment variables
3. Set the redirect URI in your Shopify app settings to match `SHOPIFY_REDIRECT_URI`

## OAuth flow

1. User clicks Connect Shopify on the Connections page → enters their shop domain
2. `GET /api/connections/shopify?shop=mystore.myshopify.com` → redirects to Shopify OAuth
3. User authorizes → Shopify redirects to `GET /api/connections/shopify/callback`
4. Server exchanges code for access token → encrypted + stored in `connections`

## Order sync

**Route**: `POST /api/sync/shopify`

Pulls Shopify orders via the REST API (`/admin/api/2024-01/orders.json`). Paginated using `page_info` cursor.

Each fulfilled order creates an income transaction:
- `source: 'shopify'`
- `source_ref_id: 'shopify_{order_id}'` for idempotency
- `description: 'Shopify order #{order_number}'`
- Amount: `order.total_price`

## Data mapping

| Shopify field | FinPilot field |
|---|---|
| `order.id` | `source_ref_id` |
| `order.total_price` | `amount` |
| `order.processed_at` | `date` |
| `order.financial_status === 'paid'` | Only synced if paid |
| `order.customer.email` | `vendor` (customer email) |

Refunded orders: FinPilot checks `order.refunds` — if a refund exists, a corresponding expense transaction is created.
