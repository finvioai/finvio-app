# Transaction Categorization

Every transaction in Finvio — whether it comes from Stripe, Plaid, PayPal, Shopify, CSV import, or manual entry — goes through the same categorization pipeline before it lands in the database.

## Entry Point

The single entry point is `categorize(description, type, orgId)` in [lib/categorization/rules.ts](../../lib/categorization/rules.ts). It returns:

```typescript
{
  category: string,                    // e.g. "Software & SaaS", "Payroll"
  subcategory?: string,
  confidence: 'high' | 'medium' | 'low',
  method: 'rule' | 'ai' | 'user',
  revenue_type?: RevenueType | null    // auto-set for income; always null for expenses
}
```

Every caller stores all three core fields (and `revenue_type` for income transactions) so you can later filter the review queue by confidence.

---

## The Three Layers

### Layer 1 — User-Saved Overrides (highest priority)

**Table:** `category_overrides`  
**Scope:** Per-organization  
**Match type:** Substring (case-insensitive)

When a user manually corrects a category on the Transactions page, `saveOverride()` stores the description pattern in this table. Future transactions whose description *contains* that pattern will match immediately — no rule lookup needed.

Example: A user corrects "VERCEL INC" → "Software & SaaS". From that point on, any transaction description containing "VERCEL INC" is categorized as "Software & SaaS" with `confidence: 'high'` and `method: 'user'`.

**Why this is first:** User corrections represent ground truth for this org. They override everything else.

### Layer 2a — Organization-Specific Rules

**Table:** `category_rules` where `org_id = <this org>`  
**Scope:** Per-organization  
**Match types:** `exact`, `keyword`, `regex`  
**Ordered by:** `priority DESC`

These are rules that the organization has configured for their specific business. Higher priority rules win. The three match types work as follows:

| Match type | Behavior |
|-----------|----------|
| `exact` | Full case-insensitive string equality |
| `keyword` | Description contains the match value (same as override, but with configurable priority) |
| `regex` | JavaScript-style regex test against description |

### Layer 2b — System-Wide Rules (fallback)

**Table:** `category_rules` where `org_id IS NULL`  
**Scope:** All organizations (seeded at deployment)  
**Match types:** Same as 2a

These are the built-in rules shipped with Finvio. They cover common SaaS vendors, payroll services, bank fees, utility payments, etc. They only apply when no org-specific rule matches.

RLS policy allows all authenticated users to SELECT rows where `org_id IS NULL`.

### Layer 3 — AI Fallback (lowest priority)

**File:** [lib/categorization/ai-fallback.ts](../../lib/categorization/ai-fallback.ts)  
**When used:** No rule matched in layers 1, 2a, or 2b

The AI receives only the transaction description and type (income/expense) — no amounts, dates, or org data. This keeps the prompt minimal and the result generalizable.

The LLM is asked to pick from the exact list of allowed categories (`INCOME_CATEGORIES` or `EXPENSE_CATEGORIES` from `types/index.ts`) and return structured JSON. If the LLM returns an unrecognized category or fails entirely, the fallback is "Other Income" or "Other Expense" depending on transaction type.

AI-categorized transactions always get `confidence: 'low'` and `method: 'ai'`, which puts them in the review queue.

---

## Confidence Levels

| Confidence | Source |
|-----------|--------|
| `high` | User override or user manually set during PATCH |
| `high` | Rule match (org-specific or system-wide) |
| `low` | AI fallback |

The Transactions page review queue surfaces all transactions with `is_reviewed = false`, sorted by confidence so low-confidence AI guesses appear first.

---

## Learning from Corrections

When a user changes a category on an existing transaction (`PATCH /api/transactions`):

1. The transaction is updated: `category_method = 'user'`, `category_confidence = 'high'`
2. `saveOverride(orgId, description, category, subcategory)` is called
3. The override is upserted in `category_overrides` — next time a matching description appears, it hits Layer 1 and gets auto-categorized correctly

This creates a self-improving loop: the more the user corrects, the fewer corrections are needed over time.

---

## Data Flow Diagram

```
New transaction description arrives
          │
          ▼
  Check category_overrides (org-specific substring match)
          │
     match? ──yes──► category = override value, confidence=high, method=user
          │
         no
          │
          ▼
  Check category_rules WHERE org_id = this_org (priority DESC)
          │
     match? ──yes──► category = rule value, confidence=high, method=rule
          │
         no
          │
          ▼
  Check category_rules WHERE org_id IS NULL (priority DESC)
          │
     match? ──yes──► category = rule value, confidence=high, method=rule
          │
         no
          │
          ▼
  Call LLM with description + type
          │
     valid? ──yes──► category = LLM pick, confidence=low, method=ai
          │
         no
          │
          ▼
  Fallback: "Other Income" or "Other Expense", confidence=low, method=ai
```

---

## Revenue Type Auto-Assignment

When a category is assigned to an income transaction (at any layer), the categorization engine automatically determines `revenue_type` using the `CATEGORY_TO_REVENUE_TYPE` mapping from `types/index.ts`:

| Income category | `revenue_type` |
|----------------|---------------|
| `Subscription Revenue` | `recurring` |
| `One-time Revenue` | `one_time` |
| `Service Revenue` | `one_time` |
| `Project Revenue` | `project` |
| `Contract Revenue` | `project` |
| `Consulting` | `project` |
| `Milestone Payment` | `milestone` |
| `Refund Received` | `one_time` |
| `Other Income` | `one_time` |

`revenue_type` is always `null` for expense transactions.

If a user later corrects the category on a transaction, `revenue_type` is updated accordingly via the same mapping — no manual `revenue_type` field is exposed in the UI.

---

## Where Categorization Is Called

| Caller | File |
|--------|------|
| Plaid sync (each new transaction) | `lib/sync/plaid.ts` |
| Stripe sync (charges, invoices, payouts) | `lib/sync/stripe.ts` |
| PayPal sync | `lib/sync/paypal.ts` |
| Shopify sync | `lib/sync/shopify.ts` |
| CSV/XLSX import (if no category column mapped) | `app/api/import/route.ts` |
| Manual transaction POST (if no category provided) | `app/api/transactions/route.ts` |
