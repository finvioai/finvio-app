import { redirect } from 'next/navigation'
import { getSession, getOrgInfo } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { WORKFLOW_REGISTRY } from '@/lib/workflows'
import type { WorkflowMeta } from '@/lib/workflows/engine'
import { getWorkflowRecommendations } from '@/lib/workflows/recommendations'
import { WorkflowsView } from './WorkflowsView'
import type { WorkflowRunRecord } from '@/types'

export const metadata = { title: 'Workflows — Finvio' }

export default async function WorkflowsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const { orgId } = await getOrgInfo()
  if (!orgId) redirect('/login')

  const supabase = await createClient()

  const [{ data: rawRuns }, recommendations] = await Promise.all([
    supabase
      .from('workflow_runs')
      .select('id, workflow_id, workflow_name, status, started_at, completed_at, summary_json')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(50),
    getWorkflowRecommendations(orgId, supabase),
  ])

  const recentRuns = (rawRuns ?? []) as WorkflowRunRecord[]

  // Last completed run per workflow for card status display
  const lastRunByWorkflow: Record<string, WorkflowRunRecord> = {}
  for (const run of recentRuns) {
    if (!lastRunByWorkflow[run.workflow_id] && run.status !== 'running') {
      lastRunByWorkflow[run.workflow_id] = run
    }
  }

  const workflows: WorkflowMeta[] = WORKFLOW_REGISTRY.map(({ steps, ...rest }) => ({
    ...rest,
    steps: steps.map(({ id, name }) => ({ id, name })),
  }))

  return (
    <WorkflowsView
      workflows={workflows}
      lastRunByWorkflow={lastRunByWorkflow}
      recentRuns={recentRuns}
      recommendations={recommendations}
    />
  )
}
