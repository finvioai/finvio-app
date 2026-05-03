# Financial Metrics — How Numbers Are Calculated

All financial metrics are computed in [lib/metrics/index.ts](../../lib/metrics/index.ts). These are pure TypeScript functions — they query the database and return typed results. The LLM never calculates; it only interprets numbers that these functions produce.

---

## MRR (Monthly Recurring Revenue)

**Function:** `getMRR(orgId, month?)`

**Priority 1 — Subscription data (if exists):**
```sql
SELECT SUM(amount_monthly) FROM subscriptions
WHERE org_id = ? AND status = 'active'
```
`amount_monthly` is pre-computed during Stripe sync:
- Monthly subscription → `price.unit_amount / 100`
- Annual subscription → `price.unit_amount / 1200`

**Priority 2 — Fallback to income transactions:**
If no subscriptions exist, sums all income transactions for the given month:
```sql
SELECT SUM(amount) FROM transactions
WHERE org_id = ? AND type = 'income'
  AND date >= first_of_month AND date <= last_of_month
```

The fallback is less accurate (includes one-off payments) but ensures a number is always available even without Stripe connected.

---

## ARR (Annual Recurring Revenue)

**Function:** `getARR(orgId)`

```
ARR = MRR × 12
```

Simple multiplication. No separate query.

---

## Burn Rate

**Function:** `getBurnRate(orgId, months = 3)`

Average monthly expenses over the last N months:

```sql
SELECT SUM(amount) FROM transactions
WHERE org_id = ? AND type = 'expense'
  AND date >= N months ago
```

Result divided by N. Using 3-month average smooths out one-time large expenses (hardware purchase, annual software payment) that would make a single-month burn rate misleading.

---

## Cash Balance

**Function:** `getCashBalance(orgId)`

**Priority 1 — Plaid balance metadata:**
If Plaid is connected and the connection has balance data in `metadata.balance`, that value is used directly. This is the most accurate source (real bank balance).

**Priority 2 — Calculated from transactions:**
```
cashBalance = SUM(all income) - SUM(all expenses)
```

This is a ledger balance, not a bank balance. It will differ from the real bank balance if not all transactions are imported.

---

## Net Burn

**Function:** `getNetBurn(orgId)`

```
netBurn = burnRate - MRR
```

Positive netBurn = company is burning cash.  
Zero or negative netBurn = company is profitable or break-even (runway is infinite).

---

## Runway

**Function:** `getRunway(orgId)`

```
runway = cashBalance / netBurn   (in months, floored)
```

Edge cases:
- `netBurn <= 0` → returns `'infinite'` (the company isn't burning cash)
- `cashBalance <= 0` → returns `0` (already out of money)

---

## MRR Trend

**Function:** `getMRRTrend(orgId, months = 6)`

Returns an array of `{month, mrr, arr}` for the last N months. Each month is calculated independently using `getMRR(orgId, month)`. Used for the Revenue Trend bar chart on Dashboard and Revenue page.

---

## P&L Statement

**Function:** `getPnL(orgId, month)`

Fetches all transactions for the given month, groups them:

```typescript
{
  revenue: LineItem[],          // income transactions grouped by category
  expenses: LineItem[],         // expense transactions grouped by category
  totalRevenue: number,
  totalExpenses: number,
  netIncome: number             // totalRevenue - totalExpenses
}
```

Each `LineItem`:
```typescript
{ category: string, amount: number }
```

Sorted by amount descending within each group. Used by the Reports page and P&L export.

---

## Active Customers

**Function:** `getActiveCustomers(orgId)`

```sql
SELECT COUNT(*) FROM customers
WHERE org_id = ? AND status = 'active'
```

Counts rows in the `customers` table with active status. Populated from Stripe customer sync.

---

## Churn Rate

**Function:** `getChurnRate(orgId, month)`

```
churnRate = churned / startCount
```

- `startCount` = subscriptions active at the start of the month
- `churned` = subscriptions cancelled during the month (status changed to 'cancelled', current_period_end falls within the month)

Returns 0 if no subscriptions exist. Expressed as a decimal (0.05 = 5% churn).

---

## Forecast

**Function:** `getForecast(orgId, growthRate, forecastMonths)`

Projects financial position forward assuming a constant monthly MRR growth rate:

```typescript
for each month 1..N:
  projectedMRR = currentMRR × (1 + growthRate)^month
  projectedExpenses = burnRate  // assumed constant
  projectedCash = currentCash + (projectedMRR - burnRate) × month
  projectedRunway = projectedCash / (burnRate - projectedMRR)
```

Returns array of `{month, projectedMRR, projectedExpenses, projectedCash, projectedRunway}`.

Used by:
- Forecast page sliders (user sets growthRate and period)
- Scenarios page (Hire / Growth / Fundraise tabs model different growthRate assumptions)
- AI chat `query_forecast` intent (uses 5% default growth rate)

---

## Data Completeness

**Function:** `getDataCompleteness(orgId)`

Scores the quality of available data:

| Source | Points |
|--------|--------|
| Stripe connected (status='active') | 30 |
| Plaid connected (status='active') | 30 |
| Shopify connected (status='active') | 10 |
| PayPal connected (status='active') | 10 |
| Manual transactions exist | 10 |
| CSV import exists | 10 |

**Score interpretation:**
- Revenue completeness: `high` (≥30pts from income sources) / `medium` / `low`
- Expense completeness: `high` (≥30pts from expense sources) / `medium` / `low`

**Warnings generated:**
- "Bank account not connected — cash balance is estimated from transactions"
- "No revenue source connected — MRR may be incomplete"
- "No expense tracking connected — burn rate may be understated"

These warnings appear in the AI chat data warning banner and are included in the AI's system prompt context.

---

## Dashboard Aggregation

**Function:** `getDashboardMetrics(orgId)`

Fetches multiple metrics in parallel (using `Promise.all`) to minimize latency:

```typescript
const [mrr, cashBalance, burnRate, activeCustomers, mrrTrend, dataCompleteness, churnRate] =
  await Promise.all([getMRR, getCashBalance, getBurnRate, getActiveCustomers, getMRRTrend, getDataCompleteness, getChurnRate])
```

Then derives without re-querying:
```typescript
const arr = mrr * 12
const netBurn = burnRate - mrr
const runway = netBurn > 0 ? Math.floor(cashBalance / netBurn) : 'infinite'
```

---

## Status Matching Note

The metrics engine checks connection status using `status === 'active'` (not `'connected'`). The DB stores `'active'` for connected integrations. This is important: if you see metrics that don't reflect a connected integration, verify the `connections.status` value in the database.
