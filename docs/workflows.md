# Workflow Automation System

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
    ├── month-end.ts        Month-End Close
    ├── bank-reconciliation.ts  Bank Reconciliation
    └── daily-accounting.ts Daily Accounting Review

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

## Current Workflows

### Month-End Close (`month-end`)
**Category:** accounting | **Duration:** ~30 seconds  
**Parameter:** `month` (YYYY-MM, defaults to previous month)

| Step | What it does |
|------|-------------|
| Check uncategorized transactions | Counts `is_reviewed=false` transactions in the month — warns if any exist |
| Run reconciliation engine | Calls `reconcileOrgTransactions()` — matches payouts, invoices, flags duplicates |
| Generate monthly snapshot | Writes/updates `monthly_snapshots` row with MRR, ARR, cash, burn, P&L totals |
| Generate P&L summary | Surfaces top 3 revenue and expense categories for the month |

---

### Bank Reconciliation (`bank-reconciliation`)
**Category:** reconciliation | **Duration:** ~15 seconds

| Step | What it does |
|------|-------------|
| Find unreconciled transactions | Counts `is_reconciled=false` transactions across all time |
| Run reconciliation engine | Calls `reconcileOrgTransactions()` |
| Generate reconciliation summary | Re-counts unreconciled after engine ran; reports what remains |

---

### Daily Accounting Review (`daily-accounting`)
**Category:** accounting | **Duration:** ~10 seconds

| Step | What it does |
|------|-------------|
| Review recent sync activity | Queries `sync_logs` for the last 24 hours — reports providers, records, errors |
| Check uncategorized transactions | Counts all `is_reviewed=false` transactions |
| Check overdue invoices | Queries invoices in `sent`/`overdue` status with `due_date < today` |
| Generate daily summary | Marks review complete with today's date |

---

## Workflow Recommendations

`lib/workflows/recommendations.ts` checks system state and returns prioritised suggestions:

| Condition | Workflow | Priority |
|-----------|---------|---------|
| > 5 uncategorized transactions | Daily Accounting Review | High |
| Any overdue invoices | Daily Accounting Review | High |
| Sync errors in last 24h | Daily Accounting Review | Medium |
| > 10 unreconciled transactions | Bank Reconciliation | Medium |
| No `monthly_snapshots` row for previous month | Month-End Close | High |

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
