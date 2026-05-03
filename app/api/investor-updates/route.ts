import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardMetrics } from '@/lib/metrics'
import { getLLMAdapter } from '@/lib/llm/factory'
import type { ChatMessagePayload } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const { data: updates } = await supabase
    .from('investor_updates')
    .select('*')
    .eq('org_id', member.org_id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ updates: updates ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const orgId = member.org_id
  const body = await request.json().catch(() => ({}))

  if (body.content !== undefined) {
    // Save an edited draft
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const period = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const { data } = await supabase
      .from('investor_updates')
      .insert({
        org_id: orgId,
        content: body.content as string,
        month: body.month ?? monthStr,
        period: body.period ?? period,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()
    return NextResponse.json({ update: data })
  }

  // Generate a new draft via LLM
  const { data: settings } = await supabase
    .from('user_settings')
    .select('llm_provider, llm_model')
    .eq('user_id', user.id)
    .single()

  const [metrics, orgRow] = await Promise.all([
    getDashboardMetrics(orgId),
    supabase.from('organizations').select('name').eq('id', orgId).single(),
  ])

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n)

  const now = new Date()
  const period = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const runwayText =
    metrics.runway === 'infinite' ? 'Profitable (no burn)' : `${metrics.runway} months`

  const systemPrompt =
    `You are an expert startup advisor helping founders write concise, data-driven investor updates. ` +
    `Write in first person as the founder. Be honest, specific, and confident. Use exact numbers.`

  const userPrompt =
    `Write an investor update for ${orgRow.data?.name ?? 'our company'} for ${period}.\n\n` +
    `Current metrics:\n` +
    `- MRR: ${fmt(metrics.mrr)}\n` +
    `- ARR: ${fmt(metrics.arr)}\n` +
    `- Cash balance: ${fmt(metrics.cashBalance)}\n` +
    `- Monthly burn rate: ${fmt(metrics.burnRate)}\n` +
    `- Runway: ${runwayText}\n` +
    `- Active customers: ${metrics.activeCustomers}\n` +
    `- Churn rate: ${(metrics.churnRate * 100).toFixed(1)}%\n\n` +
    `Format with these sections:\n` +
    `## Highlights\n(2-3 key wins this month)\n\n` +
    `## Metrics\n(summary of the numbers above)\n\n` +
    `## Focus\n(what we're working on next)\n\n` +
    `## Asks\n(1-2 specific ways investors can help)\n\n` +
    `Keep it under 400 words. Be specific and direct.`

  try {
    const adapter = getLLMAdapter(
      (settings?.llm_provider ?? 'openai') as 'openai' | 'anthropic',
      settings?.llm_model ?? 'gpt-4o-mini'
    )
    const messages: ChatMessagePayload[] = [{ role: 'user', content: userPrompt }]
    const draft = await adapter.chat(messages, systemPrompt)

    const { data: saved } = await supabase
      .from('investor_updates')
      .insert({
        org_id: orgId,
        content: draft,
        month: monthStr,
        period,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    return NextResponse.json({ update: saved })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
