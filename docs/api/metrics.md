# API — Metrics

All metrics endpoints require authentication. They call the `lib/metrics/index.ts` engine and return live data.

## GET /api/metrics/dashboard

Returns all KPIs needed for the main dashboard in a single request.

### Response

```json
{
  "mrr": 12500,
  "arr": 150000,
  "cashBalance": 85000,
  "runway": 14,
  "activeCustomers": 32,
  "burnRate": 8200,
  "netBurn": -4300,
  "churnRate": 0.02,
  "mrrTrend": [ { "month": "2025-12-01", "mrr": 9000, "arr": 108000 }, ... ],
  "dataCompleteness": { "overallScore": 70, "stripeConnected": true, ... },
  "dataWarnings": [],
  "recentTransactions": [ { ...transaction } ],
  "uncategorizedCount": 3,
  "overdueInvoices": 1
}
```

---

## GET /api/metrics/revenue

MRR trend, by-source breakdown, customer list.

### Response

```json
{
  "mrr": 12500,
  "arr": 150000,
  "activeCustomers": 32,
  "churnRate": 0.02,
  "mrrTrend": [ ... ],
  "bySource": { "stripe": 10000, "manual": 2500 },
  "customers": [ { ...customer } ]
}
```

---

## GET /api/metrics/pnl

Profit & loss for a specific month plus the prior month (for comparison).

### Query params

| Param | Type | Description |
|---|---|---|
| `month` | date | ISO first-of-month, e.g. `2026-05-01`. Defaults to current month. |

### Response

```json
{
  "current": {
    "month": "2026-05-01",
    "revenue": [ { "category": "SaaS Revenue", "amount": 12500, "transactionCount": 8 } ],
    "totalRevenue": 12500,
    "expenses": [ ... ],
    "totalExpenses": 8200,
    "netIncome": 4300,
    "dataWarnings": []
  },
  "previous": { ... }
}
```

---

## GET /api/metrics/forecast

Project MRR, expenses, and cash over a future period.

### Query params

| Param | Type | Description |
|---|---|---|
| `growthRate` | number | Monthly MRR growth rate as decimal. Clamped 0–0.5. Default 0.05 |
| `months` | integer | Forecast horizon. Clamped 1–24. Default 12 |

### Response

```json
{
  "forecast": [
    {
      "month": "2026-06-01",
      "projectedMRR": 13125,
      "projectedExpenses": 8200,
      "projectedCash": 90925,
      "projectedRunway": "infinite"
    },
    ...
  ],
  "currentMRR": 12500,
  "currentBurnRate": 8200,
  "currentCash": 85000
}
```
