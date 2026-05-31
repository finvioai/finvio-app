'use client'

import { useState, useCallback, Fragment } from 'react'
import {
  CalendarCheck,
  ArrowLeftRight,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  RotateCcw,
  Zap,
  ChevronDown,
  ChevronRight,
  Tag,
  Users,
  BookOpen,
} from 'lucide-react'
import type { WorkflowMeta } from '@/lib/workflows/engine'
import type { WorkflowRunRecord, WorkflowStepState, WorkflowRunStatus, WorkflowRecommendation } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type CardStatus = 'idle' | 'running' | WorkflowRunStatus

interface AnimatedStep extends WorkflowStepState {
  visible: boolean
}

interface CardState {
  status: CardStatus
  steps: AnimatedStep[]
  summary?: string
  totalWarnings?: number
}

interface WorkflowsViewProps {
  workflows: WorkflowMeta[]
  lastRunByWorkflow: Record<string, WorkflowRunRecord>
  recentRuns: WorkflowRunRecord[]
  recommendations: WorkflowRecommendation[]
}

// ── Icons ────────────────────────────────────────────────────────────────────

const WORKFLOW_ICONS: Record<string, React.ElementType> = {
  'month-end': CalendarCheck,
  'bank-reconciliation': ArrowLeftRight,
  'daily-accounting': ClipboardList,
  'categorize-transactions': Tag,
  'ar-aging': Users,
  'adjusting-entries': BookOpen,
}

function StepIcon({ status, visible }: { status: AnimatedStep['status']; visible: boolean }) {
  if (!visible) return <div className="h-5 w-5 rounded-full border-2 border-gray-200 shrink-0" />

  switch (status) {
    case 'pending':
      return <div className="h-5 w-5 rounded-full border-2 border-gray-200 shrink-0" />
    case 'running':
      return <Loader2 className="h-5 w-5 animate-spin text-brand shrink-0" />
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500 shrink-0" />
    case 'approval_required':
      return <Clock className="h-5 w-5 text-blue-500 shrink-0" />
    default:
      return <div className="h-5 w-5 rounded-full border-2 border-gray-200 shrink-0" />
  }
}

// ── Status badge ─────────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: WorkflowRunRecord['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </span>
      )
    case 'completed_with_warnings':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
          <AlertTriangle className="h-3 w-3" />
          Warnings
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      )
    case 'running':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </span>
      )
    default:
      return null
  }
}

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: WorkflowRecommendation['priority'] }) {
  if (priority === 'high') {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        High priority
      </span>
    )
  }
  if (priority === 'medium') {
    return (
      <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
        Recommended
      </span>
    )
  }
  return null
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Month picker ──────────────────────────────────────────────────────────────

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-ink">Month</label>
      <input
        type="month"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-md border border-hairline bg-background px-2 py-1 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </div>
  )
}

// ── Workflow card ─────────────────────────────────────────────────────────────

interface WorkflowCardProps {
  workflow: WorkflowMeta
  lastRun?: WorkflowRunRecord
  recommendation?: WorkflowRecommendation
  cardState: CardState
  onRun: (workflowId: string, parameters: Record<string, unknown>) => void
}

function WorkflowCard({ workflow, lastRun, recommendation, cardState, onRun }: WorkflowCardProps) {
  const [monthParam, setMonthParam] = useState(() => {
    const now = new Date()
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const m = now.getMonth() === 0 ? 12 : now.getMonth()
    return `${y}-${String(m).padStart(2, '0')}`
  })
  const [showDetails, setShowDetails] = useState(false)

  const Icon = WORKFLOW_ICONS[workflow.id] ?? Zap
  const isRunning = cardState.status === 'running'
  const isActive = cardState.status !== 'idle'
  const hasMonthParam = workflow.parameters?.some(p => p.type === 'month')

  const handleRun = () => {
    const parameters: Record<string, unknown> = {}
    if (hasMonthParam) parameters.month = monthParam
    onRun(workflow.id, parameters)
  }

  const categoryColors: Record<string, string> = {
    accounting: 'bg-brand-tint text-brand',
    reconciliation: 'bg-purple-100 text-purple-700',
    reporting: 'bg-sky-100 text-sky-700',
    compliance: 'bg-orange-100 text-orange-700',
  }

  return (
    <div
      className={`rounded-xl border bg-white p-6 transition-shadow ${
        recommendation?.priority === 'high'
          ? 'border-brand/40 shadow-sm shadow-brand/10'
          : 'border-hairline'
      }`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gradient text-navy-foreground shadow-brand-glow">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy">{workflow.name}</h3>
            <span
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryColors[workflow.category] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {workflow.category}
            </span>
          </div>
        </div>
        {recommendation && <PriorityBadge priority={recommendation.priority} />}
      </div>

      {/* Description */}
      <p className="mt-4 text-sm leading-relaxed text-muted-ink">{workflow.description}</p>

      {/* Recommendation reason */}
      {recommendation && (
        <p className="mt-2 text-xs text-brand font-medium">⚠ {recommendation.reason}</p>
      )}

      {/* Metadata row */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-ink/70">
        <span>{workflow.estimatedDuration}</span>
        {lastRun && !isActive && (
          <span>Last run {formatRelativeTime(lastRun.started_at)}</span>
        )}
        {lastRun && !isActive && <RunStatusBadge status={lastRun.status} />}
      </div>

      {/* Month picker (for workflows that accept a month parameter) */}
      {hasMonthParam && !isActive && (
        <div className="mt-4">
          <MonthPicker value={monthParam} onChange={setMonthParam} />
        </div>
      )}

      {/* Progress panel */}
      {isActive && (
        <div className="mt-5 space-y-3">
          {cardState.steps.map(step => (
            <div
              key={step.id}
              className={`flex items-start gap-3 transition-opacity duration-300 ${step.visible ? 'opacity-100' : 'opacity-0'}`}
            >
              <StepIcon status={step.status} visible={step.visible} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-navy">{step.name}</p>
                {step.visible && step.message && (
                  <p className="mt-0.5 text-xs text-muted-ink">{step.message}</p>
                )}
                {step.visible && step.warnings && step.warnings.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {step.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-yellow-700">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}

          {/* Summary */}
          {cardState.summary && (
            <div
              className={`mt-4 rounded-lg p-3 text-xs leading-relaxed ${
                cardState.status === 'completed'
                  ? 'bg-green-50 text-green-800'
                  : cardState.status === 'completed_with_warnings'
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              <button
                className="flex w-full items-center justify-between font-medium"
                onClick={() => setShowDetails(v => !v)}
              >
                <span>
                  {cardState.status === 'completed' && '✓ Workflow complete'}
                  {cardState.status === 'completed_with_warnings' && '⚠ Completed with warnings'}
                  {cardState.status === 'failed' && '✕ Workflow failed'}
                </span>
                {showDetails ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              {showDetails && (
                <pre className="mt-2 whitespace-pre-wrap font-sans">{cardState.summary}</pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-5 flex items-center gap-3">
        {isActive && cardState.status !== 'running' ? (
          <button
            onClick={handleRun}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-off-white px-5 text-sm font-bold text-navy hover:bg-hairline transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Run Again
          </button>
        ) : (
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-gradient px-4 text-sm font-bold text-navy-foreground shadow-brand-glow transition-opacity disabled:opacity-60"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Run Workflow
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ── History table ─────────────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE = 10

function RunHistoryTable({ runs }: { runs: WorkflowRunRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-white py-12 text-center">
        <Clock className="mx-auto h-8 w-8 text-muted-ink/30" />
        <p className="mt-3 text-sm font-medium text-navy">No workflow runs yet</p>
        <p className="mt-1 text-xs text-muted-ink">Run a workflow above to see history here.</p>
      </div>
    )
  }

  const totalPages = Math.ceil(runs.length / HISTORY_PAGE_SIZE)
  const pageRuns = runs.slice(page * HISTORY_PAGE_SIZE, (page + 1) * HISTORY_PAGE_SIZE)

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-white">
      <table className="w-full">
        <thead className="border-b border-hairline bg-off-white">
          <tr>
            {['Workflow', 'Status', 'Started', 'Duration', 'Warnings', ''].map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-ink"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRuns.map(run => {
            const isExpanded = expandedId === run.id
            const durationMs =
              run.completed_at
                ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
                : null
            const durationStr = durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : '—'
            const warnings = run.summary_json?.totalWarnings ?? 0
            const steps = run.summary_json?.steps ?? []
            const summary = run.summary_json?.summary

            return (
              <Fragment key={run.id}>
                <tr
                  className="border-b border-hairline/70 hover:bg-off-white transition-colors cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : run.id)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-navy">{run.workflow_name}</td>
                  <td className="px-4 py-3">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-ink">{formatDate(run.started_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-ink">{durationStr}</td>
                  <td className="px-4 py-3 text-xs text-muted-ink">
                    {warnings > 0 ? (
                      <span className="font-medium text-yellow-700">{warnings}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-ink">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-ink" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-ink" />
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-hairline/70 bg-off-white/60">
                    <td colSpan={6} className="px-6 py-4">
                      {steps.length > 0 ? (
                        <div className="space-y-2.5">
                          {steps.map(step => (
                            <div key={step.id} className="flex items-start gap-3">
                              <StepIcon status={step.status} visible={true} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-navy">{step.name}</p>
                                {step.message && (
                                  <p className="mt-0.5 text-xs text-muted-ink">{step.message}</p>
                                )}
                                {step.warnings && step.warnings.length > 0 && (
                                  <ul className="mt-1 space-y-0.5">
                                    {step.warnings.map((w, i) => (
                                      <li key={i} className="text-xs text-yellow-700">{w}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          ))}
                          {summary && (
                            <div
                              className={`mt-3 rounded-lg p-3 text-xs leading-relaxed ${
                                run.status === 'completed'
                                  ? 'bg-green-50 text-green-800'
                                  : run.status === 'completed_with_warnings'
                                  ? 'bg-yellow-50 text-yellow-800'
                                  : 'bg-red-50 text-red-800'
                              }`}
                            >
                              <pre className="whitespace-pre-wrap font-sans">{summary}</pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-ink">No step details available for this run.</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
          <span className="text-xs text-muted-ink">
            Showing {page * HISTORY_PAGE_SIZE + 1}–{Math.min((page + 1) * HISTORY_PAGE_SIZE, runs.length)} of {runs.length} runs
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage(p => p - 1); setExpandedId(null) }}
              disabled={page === 0}
              className="inline-flex h-7 items-center rounded-md border border-hairline px-3 text-xs font-medium text-navy hover:bg-off-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-muted-ink">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => { setPage(p => p + 1); setExpandedId(null) }}
              disabled={page >= totalPages - 1}
              className="inline-flex h-7 items-center rounded-md border border-hairline px-3 text-xs font-medium text-navy hover:bg-off-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Recommendations banner ────────────────────────────────────────────────────

function RecommendationsBanner({
  recommendations,
}: {
  recommendations: WorkflowRecommendation[]
}) {
  const high = recommendations.filter(r => r.priority === 'high')
  if (high.length === 0) return null

  return (
    <div className="rounded-xl border border-brand/20 bg-brand-tint/40 p-4">
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <div>
          <p className="text-sm font-semibold text-navy">
            {high.length} workflow{high.length !== 1 ? 's' : ''} recommended
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {high.map(r => (
              <li key={r.workflowId} className="text-xs text-muted-ink">
                <span className="font-medium text-navy">{r.workflowName}:</span> {r.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function WorkflowsView({
  workflows,
  lastRunByWorkflow,
  recentRuns,
  recommendations,
}: WorkflowsViewProps) {
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(
      workflows.map(w => [
        w.id,
        { status: 'idle', steps: w.steps.map(s => ({ id: s.id, name: s.name, status: 'pending' as const, visible: false })) },
      ])
    )
  )
  const [runHistory, setRunHistory] = useState<WorkflowRunRecord[]>(recentRuns)

  const handleRun = useCallback(
    async (workflowId: string, parameters: Record<string, unknown>) => {
      const workflow = workflows.find(w => w.id === workflowId)
      if (!workflow) return

      // Set running state with all steps as pending + invisible
      setCardStates(prev => ({
        ...prev,
        [workflowId]: {
          status: 'running',
          steps: workflow.steps.map(s => ({
            id: s.id,
            name: s.name,
            status: 'pending' as const,
            visible: false,
          })),
        },
      }))

      try {
        const res = await fetch('/api/workflows/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflowId, parameters }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }))
          setCardStates(prev => ({
            ...prev,
            [workflowId]: {
              status: 'failed',
              steps: workflow.steps.map(s => ({
                id: s.id,
                name: s.name,
                status: 'failed' as const,
                message: err.error ?? 'Failed to run workflow',
                visible: true,
              })),
              summary: err.error ?? 'Workflow failed to start.',
            },
          }))
          return
        }

        const data = await res.json()
        const resultSteps: WorkflowStepState[] = data.steps ?? []

        // Animate steps sequentially — reveal each with 250ms delay
        for (let i = 0; i < resultSteps.length; i++) {
          await new Promise<void>(resolve => setTimeout(resolve, i === 0 ? 0 : 300))
          setCardStates(prev => {
            const current = prev[workflowId]
            const updatedSteps = current.steps.map((s, idx) => {
              if (idx < i + 1) {
                return { ...resultSteps[idx], visible: true }
              }
              return s
            })
            return { ...prev, [workflowId]: { ...current, steps: updatedSteps } }
          })
        }

        // Small delay then show final status + summary
        await new Promise<void>(resolve => setTimeout(resolve, 200))
        setCardStates(prev => ({
          ...prev,
          [workflowId]: {
            status: data.status as WorkflowRunStatus,
            steps: resultSteps.map(s => ({ ...s, visible: true })),
            summary: data.summary,
            totalWarnings: data.totalWarnings,
          },
        }))

        // Prepend to run history
        if (data.runId) {
          const newRun: WorkflowRunRecord = {
            id: data.runId,
            workflow_id: workflowId,
            workflow_name: workflow.name,
            status: data.status,
            started_at: data.startedAt,
            completed_at: data.completedAt,
            summary_json: {
              steps: resultSteps,
              summary: data.summary,
              totalWarnings: data.totalWarnings,
            },
          }
          setRunHistory(prev => [newRun, ...prev])
        }
      } catch {
        setCardStates(prev => ({
          ...prev,
          [workflowId]: {
            status: 'failed',
            steps: workflow.steps.map(s => ({
              id: s.id,
              name: s.name,
              status: 'failed' as const,
              message: 'Network error — could not reach the server.',
              visible: true,
            })),
            summary: 'Workflow failed due to a network error.',
          },
        }))
      }
    },
    [workflows]
  )

  const recommendationMap = Object.fromEntries(recommendations.map(r => [r.workflowId, r]))

  return (
    <div className="min-h-screen bg-off-white p-6 md:p-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Workflows</h1>
        <p className="mt-1 text-sm text-muted-ink">
          Automate your accounting operations with one click.
        </p>
      </div>

      {/* Recommendations banner */}
      {recommendations.length > 0 && (
        <div className="mb-6">
          <RecommendationsBanner recommendations={recommendations} />
        </div>
      )}

      {/* Workflow cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {workflows.map(workflow => (
          <WorkflowCard
            key={workflow.id}
            workflow={workflow}
            lastRun={lastRunByWorkflow[workflow.id]}
            recommendation={recommendationMap[workflow.id]}
            cardState={cardStates[workflow.id]}
            onRun={handleRun}
          />
        ))}
      </div>

      {/* Run history */}
      <div className="mt-10">
        <h2 className="mb-4 text-base font-bold text-navy">Run History</h2>
        <RunHistoryTable runs={runHistory} />
      </div>
    </div>
  )
}
