# Workflow Automation System

## Purpose

Workflows are one-click automations that replace repetitive, error-prone manual accounting tasks. Instead of a bookkeeper navigating multiple screens, cross-referencing spreadsheets, and typing summaries, a workflow runs all those sub-tasks in sequence, records every result, and surfaces only the things that need human attention (warnings, anomalies, unreconciled items).

**Why they exist:** Small finance teams spend 2–4 hours per month on tasks like month-end close, bank reconciliation, and daily transaction review. Workflows reduce that to a 10–30 second click, with a full audit trail saved automatically.

**What they are NOT:** Workflows do not modify or delete data automatically. Every step either reads data and reports findings, or writes a snapshot/summary record. Steps that detect problems (uncategorized transactions, overdue invoices, failed syncs) surface warnings so the user can take action — they do not auto-fix.

---

## Current Workflows

### Month-End Close (`month-end`)
**Business purpose:** Closes out a calendar month so financial reports are accurate and complete.

At the start of each month, finance teams need to verify that all transactions are categorized, reconcile them against payment provider payouts, and produce a snapshot of key metrics (MRR, ARR, burn rate, P&L). Without this, monthly reports are unreliable and tax prep becomes painful. This workflow does all of that in one run.

**Steps and what they do:**
| Step | Business action |
|------|----------------|
| Check uncategorized transactions | Finds transactions not yet reviewed/categorized. Warns if any remain — these must be resolved before the month is truly closed. |
| Run reconciliation engine | Matches bank/Stripe transactions against invoices and payouts. Flags duplicates, unmatched items, and discrepancies. |
| Generate monthly snapshot | Writes a `monthly_snapshots` record with MRR, ARR, cash balance, burn rate, and P&L totals — the source of truth for monthly reports. |
| Generate P&L summary | Lists the top 3 revenue and expense categories, giving a plain-language financial summary for the month. |

---

### Bank Reconciliation (`bank-reconciliation`)
**Business purpose:** Verifies that every transaction in the system is matched and accounted for.

Reconciliation ensures the books match reality: every bank/Stripe transaction maps to an invoice or known payout, with no duplicates or ghost entries. This should run at least weekly for active businesses. Unreconciled transactions cause cash flow figures to be inaccurate.

**Steps and what they do:**
| Step | Business action |
|------|----------------|
| Find unreconciled transactions | Counts all `is_reconciled=false` transactions across all time — the baseline before running the engine. |
| Run reconciliation engine | Calls the reconciliation logic to match payouts, invoices, and flag duplicates. |
| Generate reconciliation summary | Re-counts unreconciled after the engine ran. Reports how many were resolved and how many still need manual attention. |

---

### Daily Accounting Review (`daily-accounting`)
**Business purpose:** A quick daily health check on the accounting system — data sync, outstanding items, overdue invoices.

This is designed to be run each morning. It surfaces anything that drifted overnight: failed data syncs from Stripe/banks, transactions that came in uncategorized, and invoices that have gone past due. Think of it as a daily standup for the finance system.

**Steps and what they do:**
| Step | Business action |
|------|----------------|
| Review recent sync activity | Checks `sync_logs` for the last 24 hours — reports which providers synced, how many records were imported, and any errors. A failed sync means data may be missing. |
| Check uncategorized transactions | Counts all unreviewed transactions across all time. A growing backlog means financial reports are becoming less accurate. |
| Check overdue invoices | Lists invoices in `sent` or `overdue` status with a past due date — these represent unpaid revenue that may need follow-up. |
| Generate daily summary | Marks the review complete with today's date and a plain-language status for the business. |

---

### Categorize Transactions (`categorize-transactions`)
**Business purpose:** Actually categorize the uncategorized transactions that every other workflow flags but none resolve.

Correct categorization is the foundation of every financial report. P&L accuracy, tax prep, budget vs. actual — all depend on transactions being in the right category. This workflow runs the full three-layer categorization stack (org overrides → category rules → AI fallback) against every unreviewed transaction, marks them as reviewed, and reports what still needs manual attention.

**Steps and what they do:**
| Step | Business action |
|------|----------------|
| Scan uncategorized transactions | Counts all transactions where `is_reviewed=false`. If zero, exits cleanly. |
| Apply category rules | Pre-fetches all org overrides + org-specific rules + system-wide rules in one round-trip. Applies them in memory to all uncategorized transactions. Bulk-updates matches with `category_method='rule'` and marks as reviewed. Processes up to 200 transactions per run. |
| AI-assisted categorization | For transactions that didn't match any rule, calls the LLM categorizer (same model as the chat advisor). Processes up to 40 transactions concurrently. Marks results with `category_method='ai'`. |
| Categorization summary | Re-counts still-uncategorized transactions and reports what remains. Warns if the run limit was hit (run again to continue). |

> **Note:** The workflow processes up to 200 rule-matched and 40 AI-assisted transactions per run. For a large initial backlog, run it 2–3 times until all transactions are cleared.

---

### AR Aging Report (`ar-aging`)
**Business purpose:** A snapshot of who owes you money and how overdue each invoice is — the basis for collections decisions.

A single "overdue invoices" count buried in the daily review doesn't tell you what action to take. AR aging buckets invoices into standard 30/60/90/90+ day ranges, identifies customers with significant exposure, and flags accounts that have gone silent long enough to warrant a write-off conversation. This is the standard report accountants and CFOs use to manage receivables.

**Steps and what they do:**
| Step | Business action |
|------|----------------|
| Fetch open receivables | Queries all invoices with `status IN ('sent', 'overdue')`. Reports total count and total dollar value. |
| Age receivables by bucket | Distributes invoices into: Current (not yet due), 1–30 days, 31–60 days, 61–90 days, 90+ days. Reports count and amount per bucket. |
| Flag high-risk accounts | Isolates all invoices 60+ days overdue. Groups by customer to identify repeat exposure. Each customer with 60+ day overdue items generates a named warning. |
| AR aging summary | Computes total AR vs total overdue. Surfaces the single customer with the largest overdue balance. |

---

### Adjusting Entries Review (`adjusting-entries`)
**Business purpose:** Surface the accruals, prepaid amortizations, and deferred revenue items that must be booked before a close is complete in accounting terms.

A "close" that only reconciles transactions and snaps a P&L isn't actually closed — it's missing the adjusting entries that GAAP and most accounting standards require. Accrued expenses that haven't been invoiced yet, prepaid software licenses that cover multiple months, advance payments from customers — all of these need journal entries to match revenue and expense to the period they belong to. This workflow detects those gaps and flags them for human review before you run Month-End Close.

**Steps and what they do:**
| Step | Business action |
|------|----------------|
| Detect missing accruals | Finds expense transactions tagged as `recurrence='monthly'` in the prior month. Checks whether the same vendor/description appears in the target month. Flags anything missing as a probable accrual needed. Returns `approval_required` so it shows up as a human action item. |
| Check prepaid amortization | Finds expenses >$500 in categories like Insurance, Rent, SaaS, Software in the target month. Flags amounts >$2,000 as likely multi-month prepaids that should be split into monthly entries rather than expensed in a single period. |
| Check deferred revenue | Finds invoices that were paid in the target month but have an `invoice_date` in a future month — these are advance payments that should sit in deferred revenue until the service period starts. |
| Adjusting entries summary | Always returns `approval_required` — a deliberate checkpoint reminding the user to book the identified entries before running Month-End Close. |

> **Important:** This workflow identifies adjustments; it does not book them. Adjusting entries are created manually in Transactions after reviewing the flagged items. Run Month-End Close only after the adjustments are booked.

---

## Overview

Finvio's workflow system lets users run predefined accounting operations as tracked, audited jobs. Each workflow consists of sequential steps; the framework handles execution, error handling, warning accumulation, and history.

**Key design principle:** Adding a new workflow requires only one new definition file and one line in the registry. No new pages, no new API routes, no UI changes needed.

---

## Architecture

```
lib/workflows/
├── engine.ts               Core types + runWorkflow() executor
├── index.ts                Registry + getWorkflow() lookup
├── recommendations.ts      System state → recommended workflows
└── definitions/
    ├── categorize-transactions.ts  Categorize Transactions
    ├── daily-accounting.ts         Daily Accounting Review
    ├── ar-aging.ts                 AR Aging Report
    ├── bank-reconciliation.ts      Bank Reconciliation
    ├── adjusting-entries.ts        Adjusting Entries Review
    └── month-end.ts                Month-End Close

app/api/workflows/
├── run/route.ts            POST — execute workflow, returns full result
├── history/route.ts        GET  — last N runs for org
└── recommendations/route.ts GET — recommended workflows based on state

app/(dashboard)/workflows/
├── page.tsx                Server component (data fetch)
└── WorkflowsView.tsx       Client component (UI + animation)
```

---

## Engine

### Core Types

```typescript
// WorkflowContext — passed to every step
interface WorkflowContext {
  orgId: string
  supabase: SupabaseClient
  today: string                        // YYYY-MM-DD
  parameters: Record<string, unknown>  // workflow-specific params
}

// Step result
interface WorkflowStepResult {
  status: 'success' | 'warning' | 'failed' | 'approval_required'
  message: string
  warnings?: string[]
  data?: Record<string, unknown>
}

// Workflow definition
interface WorkflowDefinition {
  id: string
  name: string
  description: string
  category: 'accounting' | 'reconciliation' | 'reporting' | 'compliance'
  estimatedDuration: string
  parameters?: WorkflowParameterSchema[]  // optional parameter metadata
  steps: WorkflowStep[]
}
```

### Execution Rules

- Steps run **sequentially**
- Only `failed` stops execution — remaining steps are marked `pending`/skipped
- `warning` and `approval_required` both continue execution
- All warnings accumulate across all steps and appear in the final summary
- `approval_required` is designed for future human-in-the-loop steps; currently treated like `warning`
- Each step is wrapped in try/catch — uncaught errors become `failed`

### Parameters

Workflows accept generic parameters passed at runtime:

```typescript
POST /api/workflows/run
{
  "workflowId": "month-end",
  "parameters": {
    "month": "2026-04"   // YYYY-MM format
  }
}
```

Steps access parameters via `ctx.parameters.month` etc. The `WorkflowDefinition.parameters` array declares the schema for UI rendering.

---

## Workflow Recommendations

`lib/workflows/recommendations.ts` checks system state and returns prioritised suggestions:

| Condition | Workflow | Priority |
|-----------|---------|---------|
| Any uncategorized transactions (>20 = high) | Categorize Transactions | High / Medium |
| Any overdue invoices | Daily Accounting Review | High |
| Sync errors in last 24h | Daily Accounting Review | Medium |
| Any invoices 60+ days overdue | AR Aging Report | High |
| > 3 open invoices (no high-risk) | AR Aging Report | Medium |
| > 10 unreconciled transactions | Bank Reconciliation | Medium |
| No `monthly_snapshots` for previous month | Adjusting Entries Review | High |
| No `monthly_snapshots` for previous month | Month-End Close | High |

Recommendations appear as a banner at the top of the Workflows page. The `/api/workflows/recommendations` endpoint also exposes them programmatically.

---

## Database

`workflow_runs` table (migration: `supabase/migrations/20260531000000_workflow_runs.sql`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `org_id` | uuid | FK → organizations |
| `workflow_id` | text | e.g. `"month-end"` |
| `workflow_name` | text | Display name at time of run |
| `status` | text | `running \| completed \| completed_with_warnings \| failed` |
| `started_at` | timestamptz | Auto-set on insert |
| `completed_at` | timestamptz | Set after execution completes |
| `summary_json` | jsonb | `{ steps, summary, totalWarnings }` |
| `created_by` | uuid | FK → auth.users |

RLS: org members can select/insert/update their own org's rows.

> **Note:** Until the migration is applied and `types/database.ts` is regenerated, queries use an `any` cast. Regenerate types with `npx supabase gen types typescript --local > types/database.ts` after applying the migration.

---

## API Reference

### `POST /api/workflows/run`

Runs a workflow synchronously and returns the full result.

**Request:**
```json
{ "workflowId": "month-end", "parameters": { "month": "2026-04" } }
```

**Response:**
```json
{
  "runId": "uuid",
  "status": "completed_with_warnings",
  "steps": [
    { "id": "check-uncategorized", "name": "...", "status": "warning", "message": "...", "warnings": ["..."] },
    ...
  ],
  "summary": "Month-End Close completed with 1 warning.\n...",
  "totalWarnings": 1,
  "startedAt": "2026-05-31T10:00:00.000Z",
  "completedAt": "2026-05-31T10:00:18.000Z"
}
```

### `GET /api/workflows/history?limit=20`

Returns last N runs for the authenticated org.

### `GET /api/workflows/recommendations`

Returns prioritised workflow recommendations based on current system state.

---

## AI Integration

The AI advisor recognises workflow intents via keyword patterns in `lib/llm/intent.ts`:

- "run month-end close" → `run_workflow` intent
- "run bank reconciliation" → `run_workflow` intent
- "close the month" → `run_workflow` intent
- "automate accounting" → `run_workflow` intent

When detected, the AI describes the workflow and directs the user to `/workflows` to run it. The workflow page is the canonical execution point.

---

## Adding a New Workflow

1. Create `lib/workflows/definitions/my-workflow.ts`:

```typescript
import type { WorkflowDefinition } from '../engine'

export const myWorkflow: WorkflowDefinition = {
  id: 'my-workflow',
  name: 'My Workflow',
  description: 'What this workflow does.',
  category: 'accounting',
  estimatedDuration: '~20 seconds',
  steps: [
    {
      id: 'step-one',
      name: 'Step One',
      async run(ctx) {
        // ctx.orgId, ctx.supabase, ctx.today, ctx.parameters
        return { status: 'success', message: 'Step done.' }
      },
    },
  ],
}
```

2. Register it in `lib/workflows/index.ts`:

```typescript
import { myWorkflow } from './definitions/my-workflow'

export const WORKFLOW_REGISTRY = [
  monthEndWorkflow,
  bankReconciliationWorkflow,
  dailyAccountingWorkflow,
  myWorkflow,  // ← add here
]
```

That's it. The workflow card appears automatically on the Workflows page.

---

## Step Status Reference

| Status | Meaning | Stops execution? |
|--------|---------|-----------------|
| `success` | Step completed without issues | No |
| `warning` | Step completed but found issues | No |
| `approval_required` | Step needs human sign-off (future) | No |
| `failed` | Step encountered an error | Yes — remaining steps skipped |
| `pending` | Step was skipped due to prior failure | — |
