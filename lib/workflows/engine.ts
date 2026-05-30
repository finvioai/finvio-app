import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkflowRunStatus, StepStatus, WorkflowStepState } from '@/types'

export type { WorkflowRunStatus, StepStatus, WorkflowStepState }

export interface WorkflowContext {
  orgId: string
  supabase: SupabaseClient
  today: string                        // YYYY-MM-DD
  parameters: Record<string, unknown>  // generic, workflow-specific
}

export interface WorkflowStepResult {
  status: 'success' | 'warning' | 'failed' | 'approval_required'
  message: string
  warnings?: string[]
  data?: Record<string, unknown>
}

export interface WorkflowParameterSchema {
  key: string
  label: string
  type: 'month' | 'string' | 'boolean'
  required: boolean
  default?: unknown
}

export interface WorkflowStep {
  id: string
  name: string
  run: (ctx: WorkflowContext) => Promise<WorkflowStepResult>
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  category: 'accounting' | 'reconciliation' | 'reporting' | 'compliance'
  estimatedDuration: string
  parameters?: WorkflowParameterSchema[]
  steps: WorkflowStep[]
}

export type WorkflowMeta = Omit<WorkflowDefinition, 'steps'> & {
  steps: { id: string; name: string }[]
}

export interface WorkflowResult {
  status: WorkflowRunStatus
  steps: WorkflowStepState[]
  summary: string
  totalWarnings: number
  startedAt: string
  completedAt: string
}

export async function runWorkflow(
  definition: WorkflowDefinition,
  context: WorkflowContext
): Promise<WorkflowResult> {
  const startedAt = new Date().toISOString()
  const stepStates: WorkflowStepState[] = []
  let overallFailed = false

  for (const step of definition.steps) {
    if (overallFailed) {
      stepStates.push({
        id: step.id,
        name: step.name,
        status: 'pending',
        message: 'Skipped — previous step failed',
      })
      continue
    }

    let result: WorkflowStepResult
    try {
      result = await step.run(context)
    } catch (err) {
      result = {
        status: 'failed',
        message: err instanceof Error ? err.message : 'Unexpected error in step',
      }
    }

    stepStates.push({ id: step.id, name: step.name, ...result })

    // Only 'failed' stops execution; 'warning' and 'approval_required' continue
    if (result.status === 'failed') {
      overallFailed = true
    }
  }

  const allWarnings = stepStates.flatMap(s => s.warnings ?? [])
  const totalWarnings = allWarnings.length
  const hasWarnings =
    stepStates.some(s => s.status === 'warning' || s.status === 'approval_required') ||
    totalWarnings > 0

  const status: WorkflowRunStatus = overallFailed
    ? 'failed'
    : hasWarnings
    ? 'completed_with_warnings'
    : 'completed'

  const summary = buildSummary(definition.name, stepStates, status, allWarnings)

  return {
    status,
    steps: stepStates,
    summary,
    totalWarnings,
    startedAt,
    completedAt: new Date().toISOString(),
  }
}

function buildSummary(
  workflowName: string,
  steps: WorkflowStepState[],
  status: WorkflowRunStatus,
  allWarnings: string[]
): string {
  const lines: string[] = []

  if (status === 'completed') {
    lines.push(`${workflowName} completed successfully.`)
  } else if (status === 'completed_with_warnings') {
    lines.push(`${workflowName} completed with ${allWarnings.length} warning${allWarnings.length !== 1 ? 's' : ''}.`)
  } else {
    const failedStep = steps.find(s => s.status === 'failed')
    lines.push(`${workflowName} failed at "${failedStep?.name ?? 'unknown step'}".`)
  }

  const successMessages = steps
    .filter(s => s.status === 'success' && s.message)
    .map(s => s.message!)
  if (successMessages.length > 0) {
    lines.push(successMessages.join(' '))
  }

  if (allWarnings.length > 0) {
    lines.push(`Warnings: ${allWarnings.join(' | ')}`)
  }

  return lines.join('\n')
}
