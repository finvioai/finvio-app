# Business Model Detection

Finvio automatically infers the type of business from data patterns rather than asking the user to self-identify. This inference drives the dashboard layout, forecast mode, and AI chat framing — one unified system that adapts to the actual revenue model.

---

## Why Not a Mode Toggle?

A user-selectable "SaaS / SMB / Freelancer" mode has two failure modes:

1. **Stale** — Users set it once and forget; their real business evolves
2. **Wrong** — Many businesses are genuinely mixed (a SaaS company with significant project consulting revenue)

Inferring from data avoids both problems. As data changes (e.g., subscriptions added), the model updates automatically on the next request.

---

## How It Works

**Function:** `inferBusinessModel(orgId)` in [lib/metrics/index.ts](../../lib/metrics/index.ts)

Not stored in the database. Computed fresh on each call. Called once per dashboard load, forecast load, and AI chat message.

### Signal 1 — Active subscriptions

Query the `subscriptions` table for rows with `status = 'active'` scoped to the org. Even a single active subscription is treated as a strong SaaS signal.

### Signal 2 — Revenue type distribution (last 90 days)

Query income transactions from the past 90 days and compute the ratio of each `revenue_type`:

```
recurringRatio   = count(revenue_type = 'recurring')   / total
projectRatio     = count(revenue_type = 'project' OR 'milestone') / total
oneTimeRatio     = count(revenue_type = 'one_time')    / total
```

For legacy transactions where `revenue_type IS NULL`, the category string is mapped through `CATEGORY_TO_REVENUE_TYPE` as a fallback.

### Inference thresholds

| Condition | Detected model |
|-----------|---------------|
| Active subscriptions exist OR `recurringRatio > 0.30` | `'saas'` |
| `projectRatio > 0.25` AND `recurringRatio ≤ 0.30` | `'project_based'` |
| `recurringRatio ≥ 0.20` AND `projectRatio ≥ 0.20` | `'mixed'` |
| None of the above | `'smb'` |

### Default for new orgs

New organizations with no income data return `{ model: 'saas' }`. This preserves the existing dashboard and AI behavior for accounts that haven't imported data yet, avoiding a confusing blank/SMB state on first login.

---

## How the Model Affects Each Surface

### Dashboard KPI cards

| Model | Card 1 | Card 2 | Card 3 | Card 4 |
|-------|--------|--------|--------|--------|
| `saas` | MRR | Cash Balance | Runway | Active Customers |
| `smb` | Total Revenue | Gross Profit | Cash Balance | Avg Monthly Revenue |
| `project_based` | Total Revenue | Gross Profit | Cash Balance | Runway |
| `mixed` | MRR | Total Revenue | Gross Profit | Cash Balance + Runway + Customers (6-card) |

The 6-month bar chart label changes from "MRR" to "Revenue" for non-SaaS models.

### Forecast

| Model | Baseline | Slider label | Projection function |
|-------|----------|-------------|---------------------|
| `saas` | Current MRR | MRR Growth Rate | `getForecast(orgId, growthRate, n)` |
| `smb` / `project_based` | Avg monthly revenue (3mo) | Revenue Growth Rate | `getHistoricalForecast(orgId, n)` |
| `mixed` | Both MRR and total revenue | MRR Growth Rate | Both functions, two chart lines |

`getHistoricalForecast()` derives growth rate from the last 6 months of actual total revenue rather than requiring a user-entered assumption. For businesses with irregular income this produces a more honest projection.

### AI chat framing

The system prompt includes a model-specific guidance paragraph before the data JSON:

- **SaaS** — Focus on MRR, ARR, runway, churn. Use SaaS terminology naturally.
- **SMB** — Focus on total revenue, gross profit, cash flow. Avoid MRR framing unless explicitly asked.
- **Project-based** — Focus on project margins, billing, cash collection.
- **Mixed** — Address both recurring and one-time streams when relevant.

Generic revenue questions ("what's my revenue?") route to the `query_revenue` intent (total revenue), not `query_mrr`. The `query_mrr` intent only fires when the user explicitly says "MRR" or "monthly recurring revenue".

### Revenue page

All businesses see the "By Type" tab showing a breakdown of income by `revenue_type` (recurring / one_time / project / milestone / unclassified). This tab is always visible — it shows meaningful data for every model.

---

## `revenue_type` — The Data Foundation

Business model detection depends on `revenue_type` being populated on income transactions. It is auto-set in two ways:

1. **At categorization time** — `categorize()` in `lib/categorization/rules.ts` calls `getRevenueType(category, transactionType)` and includes `revenue_type` in the returned object. All sync paths and the manual transaction API spread this value into the insert payload.

2. **On category change** — When a user updates a transaction's category via `PATCH /api/transactions`, the new `revenue_type` is looked up from `CATEGORY_TO_REVENUE_TYPE` and saved alongside the category update.

Transactions with `revenue_type = null` (legacy data imported before this feature) are handled with `?? 'unclassified'` in all analytics functions — they don't break detection, they just reduce the signal confidence.

---

## Limitations and Edge Cases

**Seasonal businesses** — A business with 3 months of project revenue and 9 months of quiet may appear as `'smb'` in the off-season. The 90-day window is intentionally short to reflect current activity rather than historical peaks.

**New org with subscriptions** — If a SaaS org just connected Stripe but hasn't synced any transactions, `recurringRatio` = 0 but `hasActiveSubscriptions` = true → correctly returns `'saas'`.

**Mixed at low transaction volume** — With fewer than ~10 income transactions, small counts can push ratios past thresholds that don't reflect the real business. The 90-day window mitigates this somewhat. For very new accounts, the `'saas'` default applies until enough data accumulates.

**No division-by-zero risk** — All ratio calculations check `total > 0` before dividing. If total is zero, all ratios default to 0 and the `'saas'` default applies.
