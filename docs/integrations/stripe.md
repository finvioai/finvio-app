# Integration — Stripe

## Setup

1. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to environment variables
2. Go to Connections page → Connect Stripe
3. Create a webhook in Stripe dashboard pointing to `/api/webhooks/stripe`

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

## On-demand sync

**Route**: `POST /api/sync/stripe`

Triggers a full pull of the last 30 days of charges, customers, and subscriptions. Useful after initial connection. All operations are idempotent via `source_ref_id`.

## MRR calculation

Stripe subscriptions are the primary MRR source:
- Monthly subs: `amount` as-is
- Yearly subs: `amount / 12`

Falls back to summing income transactions if no subscription records exist.

## Reconciliation

Stripe `payout_*` transactions are matched against Plaid bank deposits with:
- Same amount (±$0.01)
- Arrival date within ±3 days of Plaid transaction date

Matched pairs are marked `is_reconciled = true` and Plaid deposits are excluded from income totals (Stripe is authoritative).
