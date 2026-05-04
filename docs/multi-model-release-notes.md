# Multi-Business-Model Support — What Changed and Why

Finvio was originally built around a SaaS mental model: MRR-first dashboard, runway as the primary health metric, and an AI advisor that spoke in ARR and churn. This excluded a large group of users — agencies, consultants, freelancers, and small business owners — whose finances don't fit that shape.

---

## Problems Addressed

**1. Dashboard showed irrelevant KPIs for non-SaaS users**
A freelance designer or a construction company has no MRR. Showing "MRR: $0" and "Runway: ∞" as primary cards gave no useful signal and made the product feel broken.

**2. Forecasting required an MRR growth rate**
The forecast slider assumed a recurring revenue baseline. For project-based businesses with lumpy, irregular income, entering a "monthly MRR growth rate" is meaningless.

**3. AI advisor used SaaS framing universally**
Asking "what's my revenue?" returned an MRR-framed answer. Generic revenue questions were routed through the `query_mrr` intent regardless of whether the user had any recurring revenue.

**4. No way to track project-level financials**
Agencies and consultants needed to see revenue, expenses, and outstanding balance per project — not just a global ledger.

**5. Income transactions had no type classification**
All income looked the same in the database. There was no way to distinguish a subscription renewal from a one-off client payment or a milestone invoice.

---

## Solutions Introduced

### Automatic Business Model Detection
A new `inferBusinessModel()` function reads existing data patterns (active subscriptions + revenue type distribution over the last 90 days) and classifies the business as `saas`, `smb`, `project_based`, or `mixed`. No user configuration required — it updates as the data changes.

### Adaptive Dashboard
KPI cards now render based on the detected model:
- **SaaS** — MRR, Cash, Runway, Customers (unchanged)
- **SMB** — Total Revenue, Gross Profit, Cash Balance, Avg Monthly Revenue
- **Project-based** — Total Revenue, Gross Profit, Cash Balance, Runway
- **Mixed** — All six in a wider grid

### Model-Aware Forecasting
For SaaS businesses the MRR growth rate slider works as before. For SMB and project-based businesses, the forecast derives a growth rate automatically from the last 6 months of actual revenue — no manual input needed.

### Revenue Type Classification
A `revenue_type` field (`recurring`, `one_time`, `project`, `milestone`) was added to income transactions and is set automatically whenever a category is assigned. This powers both the business model detection and a new "By Type" breakdown tab on the Revenue page.

### Context-Aware AI Advisor
The AI system prompt now includes a business-model-specific guidance paragraph before the financial data. Generic revenue questions ("what's my revenue?") route to a new `query_revenue` intent that returns total income — not MRR. The `query_mrr` intent only fires when the user explicitly says "MRR" or "monthly recurring revenue."

### Projects
A new Projects section lets users create projects, set budgets, and link transactions to them. Each project shows collected revenue, expenses, and outstanding balance — giving agencies and consultants a per-engagement P&L view.

---

## What Wasn't Changed

Existing SaaS users see no difference. The `getMRR()`, `getARR()`, `getBurnRate()`, and `getRunway()` functions are untouched. The dashboard defaults to the SaaS layout for new accounts. All new database columns are nullable, so existing data required no migration.
