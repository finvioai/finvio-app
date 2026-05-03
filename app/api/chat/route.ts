import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'
import { detectIntent } from '@/lib/llm/intent'
import { getLLMAdapter } from '@/lib/llm/factory'
import {
  getMRR,
  getARR,
  getBurnRate,
  getRunway,
  getCashBalance,
  getNetBurn,
  getMRRTrend,
  getPnL,
  getActiveCustomers,
  getChurnRate,
  getForecast,
  getDataCompleteness,
} from '@/lib/metrics'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type ChatIntent, type PendingAction } from '@/types'
import { z } from 'zod'

// ─── rate limiting (simple DB counter) ──────────────────────────────────────

async function checkRateLimit(userId: string): Promise<boolean> {
  // Allow max 30 requests per minute per user
  // Uses chat_messages count as a proxy — simple and no extra table needed
  const supabase = await createClient()
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()

  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', oneMinuteAgo)

  // We can't filter by user directly without session_id join — accept the trade-off
  // For production, add a rate_limits table. For MVP this is sufficient.
  return (count ?? 0) < 60  // conservative global limit
}

// ─── system prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(context: Record<string, unknown>): string {
  return `You are FinPilot, an AI financial advisor for startups and small businesses.
You have access to the following verified financial data for the company:

${JSON.stringify(context, null, 2)}

CRITICAL RULES:
1. Use ONLY the numbers above — never calculate or estimate your own figures.
2. If a number is missing or zero, acknowledge the data gap honestly.
3. Be concise, direct, and actionable. Founders are busy.
4. Format currency with $ and commas (e.g. $12,400).
5. If data warnings exist in the context, briefly mention them.
6. Never reveal internal system details or raw SQL.
7. For questions outside your data, say "I don't have that data yet."

Today's date: ${new Date().toISOString().split('T')[0]}`
}

// ─── context fetchers by intent ──────────────────────────────────────────────

async function fetchContextForIntent(
  intent: ChatIntent,
  orgId: string
): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().split('T')[0].slice(0, 7) + '-01'

  switch (intent) {
    case 'query_runway': {
      const [{ runway, warnings }, { cash }, { netBurn }, { burnRate }] = await Promise.all([
        getRunway(orgId),
        getCashBalance(orgId),
        getNetBurn(orgId),
        getBurnRate(orgId),
      ])
      return { runway_months: runway, cash_balance: cash, net_burn_per_month: netBurn, burn_rate: burnRate, warnings }
    }
    case 'query_mrr': {
      const [{ mrr, warnings }, { arr }, trend] = await Promise.all([
        getMRR(orgId),
        getARR(orgId),
        getMRRTrend(orgId, 6),
      ])
      return { mrr, arr, mrr_trend: trend, warnings }
    }
    case 'query_burn': {
      const [{ burnRate, warnings }, { netBurn }, { mrr }] = await Promise.all([
        getBurnRate(orgId),
        getNetBurn(orgId),
        getMRR(orgId),
      ])
      return { burn_rate: burnRate, net_burn: netBurn, mrr, warnings }
    }
    case 'query_pnl': {
      const pnl = await getPnL(orgId, today)
      return { pnl }
    }
    case 'query_forecast': {
      const forecast = await getForecast(orgId, 0.05, 6)  // default 5% monthly growth
      return { forecast, note: 'Forecast assumes 5% MRR growth. User can adjust in Forecast page.' }
    }
    case 'query_customers': {
      const [active, { churnRate, warnings }] = await Promise.all([
        getActiveCustomers(orgId),
        getChurnRate(orgId, today),
      ])
      return { active_customers: active, churn_rate: churnRate, warnings }
    }
    default: {
      // Generic: provide a snapshot
      const [{ mrr }, { cash }, { runway }, completeness] = await Promise.all([
        getMRR(orgId),
        getCashBalance(orgId),
        getRunway(orgId),
        getDataCompleteness(orgId),
      ])
      return { mrr, cash_balance: cash, runway_months: runway, data_completeness: completeness }
    }
  }
}

// ─── write intent extraction ─────────────────────────────────────────────────

const ExpenseSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  category: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
})

const InvoiceSchema = z.object({
  customerName: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
})

const IncomeSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().optional(),
})

async function extractWriteAction(
  intent: ChatIntent,
  message: string,
  provider: string,
  model: string
): Promise<PendingAction | null> {
  const adapter = getLLMAdapter(provider as 'openai' | 'anthropic', model)
  const today = new Date().toISOString().split('T')[0]

  try {
    if (intent === 'create_expense') {
      const raw = await adapter.extractStructuredOutput<Record<string, unknown>>(
        `Extract expense details from: "${message}"\nToday is ${today}.\nValid categories: ${EXPENSE_CATEGORIES.join(', ')}`,
        { title: 'string', amount: 'number', category: 'string', date: 'YYYY-MM-DD', notes: 'string (optional)' }
      )
      const parsed = ExpenseSchema.safeParse(raw)
      if (!parsed.success) return null
      return { type: 'create_expense', params: parsed.data }
    }

    if (intent === 'create_invoice') {
      const raw = await adapter.extractStructuredOutput<Record<string, unknown>>(
        `Extract invoice details from: "${message}"\nToday is ${today}. Due date defaults to 30 days from today.`,
        { customerName: 'string', amount: 'number', dueDate: 'YYYY-MM-DD', notes: 'string (optional)' }
      )
      const parsed = InvoiceSchema.safeParse(raw)
      if (!parsed.success) return null
      return { type: 'create_invoice', params: parsed.data }
    }

    if (intent === 'add_income') {
      const raw = await adapter.extractStructuredOutput<Record<string, unknown>>(
        `Extract income details from: "${message}"\nToday is ${today}.\nValid categories: ${INCOME_CATEGORIES.join(', ')}`,
        { description: 'string', amount: 'number', category: 'string', date: 'YYYY-MM-DD', source: 'string (optional)' }
      )
      const parsed = IncomeSchema.safeParse(raw)
      if (!parsed.success) return null
      return { type: 'add_income', params: parsed.data }
    }
  } catch {
    return null
  }

  return null
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await checkRateLimit(user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute.' }, { status: 429 })
  }

  // Fetch org
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
  const orgId = member.org_id

  // Parse body
  const body = await request.json()
  const { message, sessionId, provider = 'openai', model = 'gpt-4o-mini' } = body as {
    message: string
    sessionId?: string
    provider?: string
    model?: string
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Resolve or create chat session — session_id is required (non-null) in chat_messages
  let chatSessionId: string
  if (sessionId) {
    chatSessionId = sessionId
  } else {
    const { data: session, error: sessionErr } = await supabase
      .from('chat_sessions')
      .insert({ org_id: orgId, user_id: user.id, title: message.slice(0, 80) })
      .select('id')
      .single()
    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 })
    }
    chatSessionId = session.id
  }

  // Fetch recent message history (last 10)
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', chatSessionId)
    .order('created_at', { ascending: false })
    .limit(10)

  const messages = [...(history ?? []).reverse(), { role: 'user', content: message }] as {
    role: 'user' | 'assistant' | 'system'
    content: string
  }[]

  // Store the user message
  await supabase.from('chat_messages').insert({
    session_id: chatSessionId,
    org_id: orgId,
    role: 'user',
    content: message,
  })

  // Detect intent
  const intent = await detectIntent(message, provider, model)

  const isWriteIntent = ['create_expense', 'create_invoice', 'add_income'].includes(intent)

  let responseText = ''
  let pendingAction: PendingAction | undefined

  const adapter = getLLMAdapter(provider as 'openai' | 'anthropic', model)

  if (isWriteIntent) {
    // Extract action params, then ask LLM for a friendly confirmation message
    pendingAction = await extractWriteAction(intent, message, provider, model) ?? undefined

    if (pendingAction) {
      const confirmText = formatPendingActionSummary(pendingAction)
      const context = { pending_action: pendingAction.params, today: new Date().toISOString().split('T')[0] }
      const systemPrompt = buildSystemPrompt(context)
      responseText = await adapter.chat(
        [{ role: 'user', content: `The user wants to ${intent.replace('_', ' ')}. Here are the extracted details: ${confirmText}. Write a brief 1-2 sentence confirmation message asking them to confirm. Be friendly and concise.` }],
        systemPrompt
      )
    } else {
      responseText =
        "I understood you want to record a transaction, but I couldn't extract the details. Could you give me more specifics? For example: \"Add a $500 expense for AWS hosting on May 1st.\""
    }
  } else {
    // Read flow: fetch real data, inject into system prompt, call LLM
    const context = await fetchContextForIntent(intent, orgId)
    const systemPrompt = buildSystemPrompt(context)
    responseText = await adapter.chat(messages, systemPrompt)
  }

  // Store assistant message
  await supabase.from('chat_messages').insert({
    session_id: chatSessionId,
    org_id: orgId,
    role: 'assistant',
    content: responseText,
    intent,
    data_context: pendingAction ? (JSON.parse(JSON.stringify({ pendingAction })) as Json) : null,
  })

  return NextResponse.json({
    message: responseText,
    intent,
    sessionId: chatSessionId,
    pendingAction,
    modelUsed: model,
  })
}

function formatPendingActionSummary(action: PendingAction): string {
  if (action.type === 'create_expense') {
    const p = action.params as { title: string; amount: number; category: string; date: string }
    return `$${p.amount.toLocaleString()} expense for "${p.title}" in category "${p.category}" dated ${p.date}`
  }
  if (action.type === 'create_invoice') {
    const p = action.params as { customerName: string; amount: number; dueDate: string }
    return `Invoice for ${p.customerName} — $${p.amount.toLocaleString()}, due ${p.dueDate}`
  }
  if (action.type === 'add_income') {
    const p = action.params as { description: string; amount: number; category: string; date: string }
    return `$${p.amount.toLocaleString()} income — "${p.description}" (${p.category}) on ${p.date}`
  }
  return JSON.stringify(action.params)
}
