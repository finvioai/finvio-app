import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkflow, runWorkflow } from '@/lib/workflows'
import { writeAuditLog } from '@/lib/audit'

function wfTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase.from('workflow_runs')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'No org found' }, { status: 403 })
  const orgId = member.org_id

  const body = await request.json()
  const workflowId = body.workflowId as string
  const parameters = (body.parameters ?? {}) as Record<string, unknown>

  const definition = getWorkflow(workflowId)
  if (!definition) {
    return NextResponse.json({ error: `Unknown workflow: ${workflowId}` }, { status: 404 })
  }

  // Insert initial run record
  const { data: runRecord, error: insertError } = await wfTable(supabase)
    .insert({
      org_id: orgId,
      workflow_id: workflowId,
      workflow_name: definition.name,
      status: 'running',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !runRecord) {
    return NextResponse.json({ error: 'Could not create workflow run record' }, { status: 500 })
  }

  const context = {
    orgId,
    supabase,
    today: new Date().toISOString().split('T')[0],
    parameters,
  }

  const result = await runWorkflow(definition, context)

  // Update run record with final result
  await wfTable(supabase)
    .update({
      status: result.status,
      completed_at: result.completedAt,
      summary_json: JSON.parse(JSON.stringify({
        steps: result.steps,
        summary: result.summary,
        totalWarnings: result.totalWarnings,
      })),
    })
    .eq('id', runRecord.id)

  await writeAuditLog({
    supabase,
    orgId,
    userId: user.id,
    entityType: 'workflow_run',
    entityId: runRecord.id,
    action: `workflow.${workflowId}`,
    afterState: { status: result.status, totalWarnings: result.totalWarnings },
    request,
  })

  return NextResponse.json({ runId: runRecord.id, ...result })
}
