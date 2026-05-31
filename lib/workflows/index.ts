import { monthEndWorkflow } from './definitions/month-end'
import { bankReconciliationWorkflow } from './definitions/bank-reconciliation'
import { dailyAccountingWorkflow } from './definitions/daily-accounting'
import { categorizeTransactionsWorkflow } from './definitions/categorize-transactions'
import { arAgingWorkflow } from './definitions/ar-aging'
import { adjustingEntriesWorkflow } from './definitions/adjusting-entries'

export const WORKFLOW_REGISTRY = [
  categorizeTransactionsWorkflow,
  dailyAccountingWorkflow,
  arAgingWorkflow,
  bankReconciliationWorkflow,
  adjustingEntriesWorkflow,
  monthEndWorkflow,
]

export function getWorkflow(id: string) {
  return WORKFLOW_REGISTRY.find(w => w.id === id)
}

// To add a new workflow:
// 1. Create lib/workflows/definitions/my-workflow.ts
// 2. Import and add it to WORKFLOW_REGISTRY above

export { runWorkflow } from './engine'
export type {
  WorkflowDefinition,
  WorkflowResult,
  WorkflowStepResult,
  WorkflowContext,
  WorkflowStep,
  WorkflowParameterSchema,
} from './engine'
