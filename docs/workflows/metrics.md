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
If no subscriptions exist, sums income transactions for the month — with recurrence-aware normalisation:
- `one_time` income is **excluded** (a one-off payment is not recurring revenue)
- `annual` income is normalised: `amount ÷ 12`
- `quarterly` income is normalised: `amount ÷ 3`
- `monthly` and untagged (`null`) income is included at full amount

```sql
SELECT amount, recurrence FROM transactions
WHERE org_id = ? AND type = 'income' AND recurrence != 'one_time'
  AND date >= first_of_month AND date <= last_of_month
```

The fallback is still an estimate (non-subscription income may inflate MRR even when tagged monthly), but tagging income correctly makes it significantly more accurate. A warning is always shown when the fallback is in use.

---

## ARR (Annual Recurring Revenue)

**Function:** `getARR(orgId)`

```
ARR = MRR × 12
```

Simple multiplication. No separate query.

---

## Burn Rate

**Function:** `getBurnRate(orgId)`

Burn rate is the normalised monthly cost of running the business. It accounts for how often each expense actually recurs — a $1,200 annual AWS bill costs $100/month, not $1,200/month.

### Recurrence classification

Every expense transaction has an optional `recurrence` field set at the time of entry (via AI chat extraction or the manual expense form):

| Value | Meaning | How counted |
|-------|---------|-------------|
| `monthly` | Paid every month (SaaS, salaries, rent) | SUM ÷ distinct months with data (last 3 months) |
| `quarterly` | Paid every quarter (audits, quarterly fees) | avg quarterly spend ÷ 3 (last 12 months) |
| `annual` | Paid once a year (annual licences, insurance) | avg annual spend ÷ 12 (last 12 months) |
| `one_time` | Non-recurring (equipment, one-off contractor) | **Excluded** — shown as dashboard warning |
| `null` | Not tagged | **Excluded** — warning lists untagged expenses for the user to fix |

### Formula

```
burn_rate =
    SUM(monthly, last 3 months) ÷ count(distinct months with ≥1 monthly expense)
  + avg(quarterly spend per quarter, last 12 months) ÷ 3
  + avg(annual spend per year, last 12 months) ÷ 12
```

**Why is `null` now excluded instead of assumed monthly?**
Assuming an untagged expense recurs monthly is a guess that can significantly overstate burn rate. "Lunch" and "hosting" without a tag could be one-time, weekly, or annual — the system has no basis to decide. Excluding them and surfacing a warning gives founders accurate data and a prompt to fix the tag, rather than a silently wrong number.

**Why "divide by distinct months" instead of always ÷ 3?**
A fixed ÷ 3 divisor underestimates new subscriptions. A $20/month subscription added this month has only one data point — dividing by 3 would give $6.67. Dividing by the number of months that had the expense counts it at its full value immediately.

One-time expenses and untagged expenses are both excluded and reported separately so founders can see the spend without it distorting the recurring cost figure.

**Example:** $2,000/month payroll (monthly), $1,200/year AWS (annual), $800 laptop (one_time), $45 hosting (null/untagged).
- Monthly component: $6,000 ÷ 3 = $2,000
- Annual component: avg($1,200) ÷ 12 = $100
- One-time + untagged: excluded, each shown in a warning
- **Burn rate: $2,100/month**

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

## Business Model Inference

**Function:** `inferBusinessModel(orgId)`

Returns `{ model: BusinessModel, hasRecurring, hasProject, hasOneTime }`. Not stored in the DB — computed fresh from existing data each call.

**Signal hierarchy:**

1. **Active subscriptions** — query `subscriptions` table for `status = 'active'`. Even 1 active subscription is a strong SaaS signal.
2. **`revenue_type` distribution** — query income transactions from the last 90 days and compute ratios.
3. **Category fallback** — if `revenue_type` is null (legacy data), map `category` to a type using `CATEGORY_TO_REVENUE_TYPE`.

**Thresholds:**

| Condition | Model |
|-----------|-------|
| Active subscriptions exist OR `>30%` recurring ratio | `'saas'` |
| `>25%` project ratio AND recurring < 30% | `'project_based'` |
| Both recurring ≥ 20% AND project ≥ 20% | `'mixed'` |
| None of the above | `'smb'` |

**Default:** New orgs with no income data return `{ model: 'saas', ... }` — preserves current behavior for fresh accounts.

Used by: `getDashboardMetrics()`, `GET /api/metrics/forecast`, `fetchContextForIntent()` in the AI chat route.

---

## Total Revenue

**Function:** `getTotalRevenue(orgId, month?)`

```sql
SELECT SUM(amount) FROM transactions
WHERE org_id = ? AND type = 'income'
  AND date >= first_of_month AND date <= last_of_month
```

Defaults to the current calendar month. Returns `{ revenue, warnings }`. Warnings include "No income transactions found for this period" if the result is zero.

Unlike `getMRR()`, this includes all income regardless of `revenue_type` — one-time payments, project invoices, and recurring revenue are all summed together.

---

## Gross Profit

**Function:** `getGrossProfit(orgId, month?)`

```
grossProfit = totalRevenue - totalExpenses
```

Both sides are queried for the same month window. Returns `{ profit, warnings }`. `profit` can be negative (a loss).

---

## Average Monthly Revenue

**Function:** `getAvgMonthlyRevenue(orgId, months = 3)`

Computes total revenue for each of the last N complete calendar months, then averages — dividing only by the number of months that actually had revenue:

```
activeMonths = count(months where revenue > 0)
avg = SUM(monthlyRevenue[0..N-1]) / max(activeMonths, 1)
```

**Why not divide by N?** A business that started this month has two months of zero revenue in the lookback window. Dividing by 3 would report one-third of their real monthly revenue as their "average." Dividing by the count of months that actually had income gives the true average for the period the business has been operating.

Used by the Forecast page as the baseline for non-SaaS businesses (instead of current MRR). Defaults to a 3-month lookback.

---

## Revenue by Type

**Function:** `getRevenueByType(orgId, month?)`

Returns `{ recurring, one_time, project, milestone, unclassified }` — amounts bucketed by `revenue_type`. Transactions with `revenue_type = null` fall into `unclassified`.

Used by:
- Revenue page "By Type" tab (pie/donut chart)
- AI chat `query_revenue` intent context

---

## Historical Forecast (Non-SaaS)

**Function:** `getHistoricalForecast(orgId, forecastMonths)`

Unlike `getForecast()` which requires a user-provided MRR growth rate, this function derives the growth rate automatically from historical revenue trends:

1. Fetch total revenue for each of the last 6 complete months
2. Compute month-over-month growth rates (skipping months where the prior month had 0 revenue)
3. Average the growth rates → `derivedGrowthRate`
4. `baseRevenue` = the most recent month with revenue > 0 (avoids starting from $0 if the latest month is empty or just started)
5. Project forward: `projectedRevenue = baseRevenue × (1 + derivedGrowthRate)^n`

Returns `ForecastMonth[]` with `projectedRevenue` populated (same shape as `getForecast()` output, which sets `projectedMRR`).

Edge cases:
- Fewer than 2 months of data → uses 0% growth (flat projection)
- Negative average growth → still projects forward with the negative rate (honest forecast)
- All months have $0 revenue → `baseRevenue = 0`, flat $0 forecast

Used by the Forecast page when `businessModel !== 'saas'`.

---

## Project Summary

**Function:** `getProjectSummary(orgId)`

Fetches all projects for the org and augments each with financial totals from linked transactions:

```typescript
{
  ...project,           // all project fields
  collected: number,    // SUM(amount) for income transactions with project_id = project.id
  expenses:  number,    // SUM(amount) for expense transactions
  outstanding: number | null,  // budget - collected (null if no budget set)
}
```

Transactions are linked via `transactions.project_id`. Returns `ProjectSummary[]`.

Used by: AI chat `query_project` intent, Projects page, Dashboard "Active Projects" card (project_based and mixed models).

---

## Dashboard Aggregation

**Function:** `getDashboardMetrics(orgId)`

Fetches multiple metrics in parallel (using `Promise.all`) to minimize latency:

```typescript
const [mrr, cashBalance, burnRate, activeCustomers, mrrTrend, dataCompleteness,
       churnRate, businessModelResult, totalRevenue, grossProfit, avgMonthlyRevenue, revenueByType] =
  await Promise.all([...])
```

Then derives without re-querying:
```typescript
const arr = mrr * 12
const netBurn = burnRate - mrr
const runway = netBurn > 0 ? Math.floor(cashBalance / netBurn) : 'infinite'
```

Returns extended `DashboardMetrics` with all new fields: `businessModel`, `totalRevenue`, `grossProfit`, `avgMonthlyRevenue`, `revenueByType`.

---

## Status Matching Note

The metrics engine checks connection status using `status === 'active'` (not `'connected'`). The DB stores `'active'` for connected integrations. This is important: if you see metrics that don't reflect a connected integration, verify the `connections.status` value in the database.
