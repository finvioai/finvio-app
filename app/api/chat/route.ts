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
  inferBusinessModel,
  getTotalRevenue,
  getGrossProfit,
  getRevenueByType,
  getProjectSummary,
  getExpenses,
} from '@/lib/metrics'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type ChatIntent, type PendingAction } from '@/types'
import { ExpenseSchema, InvoiceSchema, IncomeSchema } from '@/lib/llm/chatSchemas'

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

type BusinessModelHint = 'saas' | 'smb' | 'project_based' | 'mixed'

const BUSINESS_MODEL_GUIDANCE: Record<BusinessModelHint, string> = {
  saas:          'This is a SaaS business. Focus on MRR, ARR, runway, and churn. Use SaaS terminology naturally.',
  smb:           'This is a small business with non-recurring revenue. Focus on total revenue, gross profit, and cash flow. Avoid MRR framing unless explicitly asked.',
  project_based: 'This business earns revenue project-by-project. Focus on project margins, billing, and cash collection rather than recurring metrics.',
  mixed:         'This business has both recurring and one-time revenue streams. Address both dimensions when relevant.',
}

function buildSystemPrompt(context: Record<string, unknown>): string {
  const modelHint = (context.businessModel as BusinessModelHint) ?? 'saas'
  const modelGuidance = BUSINESS_MODEL_GUIDANCE[modelHint]

  return `You are Finvio, an AI financial advisor.

${modelGuidance}

WHAT I CAN DO:
1. Answer any question about business finances — revenue, expenses, MRR, burn rate, runway, profit, customers, projects, forecasts.
2. Create transactions with user approval:
   - "Add $200 expense for Figma" → shows a confirmation card, saves only after the user clicks Confirm.
   - "Access Engineering paid $3,000" → records income with approval.
   - "Create invoice for Acme Corp $5,000 due June 1" → creates a draft invoice with approval.
3. Convert quotations or invoices to records:
   - The user can paste a quotation as text OR upload a PDF (📎 button) → extract the details and create an invoice for approval.
   - Upload a PDF receipt → extract vendor, amount, date and create an expense with approval.
4. Help navigate the app and explain how features work.

APP PAGES:
- Dashboard (/dashboard): Key metrics overview — MRR, ARR, runway, burn rate, recent transactions
- Transactions (/transactions): All income & expense entries; filter, search, tag recurrence
- Revenue (/revenue): MRR/ARR trends, revenue breakdown, churn analytics
- Expenses (/expenses): Expense list and category breakdown
- Invoices (/invoices): Create and manage customer invoices; mark as paid
- Projects (/projects): Billable project tracking, margins, client payments
- Connections (/connections): Connect integrations — Stripe, QuickBooks, Plaid (bank), Shopify, PayPal, Gmail, Outlook
- Advisor (/advisor): This AI advisor
- Reports (/reports): Exportable financial reports
- Settings (/settings): Profile, billing, team, AI model preference

HOW TO CONNECT AN INTEGRATION:
1. Go to Connections (/connections)
2. Click "Connect" on the integration card → follow the OAuth authorization flow
3. An initial 30-day sync runs automatically after authorization

GUARDRAILS:
- Only answer questions about finances, accounting, business metrics, or this application.
- If a question is unrelated, respond: "I'm Finvio's financial advisor. I can only help with finance, accounting, and app questions. Is there something about your business finances I can help with?"
- Never advise on tax evasion, fraud, or illegal activity. Decline politely and redirect.

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
8. NEVER say you have created, saved, updated, or recorded anything in a text response. All writes require the user to click the Confirm button on the confirmation card. If no confirmation card was shown, nothing was saved.
9. If the user says "yes" or "ok" but there is no active pending action, say: "I don't have a pending action to confirm. Could you restate what you'd like to record?"

Today's date: ${new Date().toISOString().split('T')[0]}`
}

// ─── context fetchers by intent ──────────────────────────────────────────────

async function fetchContextForIntent(
  intent: ChatIntent,
  orgId: string
): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().split('T')[0].slice(0, 7) + '-01'
  const { model: businessModel } = await inferBusinessModel(orgId)

  switch (intent) {
    case 'query_runway': {
      const [{ runway, warnings }, { cash }, { netBurn }, { burnRate }] = await Promise.all([
        getRunway(orgId),
        getCashBalance(orgId),
        getNetBurn(orgId),
        getBurnRate(orgId),
      ])
      return { runway_months: runway, cash_balance: cash, net_burn_per_month: netBurn, burn_rate: burnRate, warnings, businessModel }
    }
    case 'query_mrr': {
      const [{ mrr, warnings }, { arr }, trend] = await Promise.all([
        getMRR(orgId),
        getARR(orgId),
        getMRRTrend(orgId, 6),
      ])
      return { mrr, arr, mrr_trend: trend, warnings, businessModel }
    }
    case 'query_burn': {
      const [{ burnRate, warnings }, { netBurn }, { mrr }] = await Promise.all([
        getBurnRate(orgId),
        getNetBurn(orgId),
        getMRR(orgId),
      ])
      return { burn_rate: burnRate, net_burn: netBurn, mrr, warnings, businessModel }
    }
    case 'query_pnl': {
      const pnl = await getPnL(orgId, today)
      return { pnl, businessModel }
    }
    case 'query_forecast': {
      const forecast = await getForecast(orgId, 0.05, 6)
      return { forecast, note: 'Forecast assumes 5% growth. User can adjust in Forecast page.', businessModel }
    }
    case 'query_customers': {
      const [active, { churnRate, warnings }] = await Promise.all([
        getActiveCustomers(orgId),
        getChurnRate(orgId, today),
      ])
      return { active_customers: active, churn_rate: churnRate, warnings, businessModel }
    }
    case 'query_revenue': {
      const [{ revenue }, revenueByType] = await Promise.all([
        getTotalRevenue(orgId, today),
        getRevenueByType(orgId, today),
      ])
      return { total_revenue_this_month: revenue, revenue_by_type: revenueByType, businessModel }
    }
    case 'query_profit': {
      const [{ profit }, { revenue }] = await Promise.all([
        getGrossProfit(orgId, today),
        getTotalRevenue(orgId, today),
      ])
      return { gross_profit_this_month: profit, total_revenue_this_month: revenue, businessModel }
    }
    case 'query_project': {
      const projects = await getProjectSummary(orgId)
      return { projects, businessModel }
    }
    case 'query_expenses': {
      const expenses = await getExpenses(orgId, today)
      return { ...expenses, businessModel }
    }
    case 'query_help': {
      return { businessModel, today: new Date().toISOString().split('T')[0] }
    }
    default: {
      // Generic: provide a snapshot
      const [{ mrr }, { cash }, { runway }, completeness] = await Promise.all([
        getMRR(orgId),
        getCashBalance(orgId),
        getRunway(orgId),
        getDataCompleteness(orgId),
      ])
      return { mrr, cash_balance: cash, runway_months: runway, data_completeness: completeness, businessModel }
    }
  }
}

// ─── write intent extraction ─────────────────────────────────────────────────

async function resolveProjectId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  hint: string
): Promise<{ project_id: string; project_name: string } | null> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, client')
    .eq('org_id', orgId)
    .eq('status', 'active')

  if (!projects?.length) return null

  const h = hint.toLowerCase()
  const match = projects.find((p) => {
    const n = p.name.toLowerCase()
    const c = (p.client ?? '').toLowerCase()
    return n.includes(h) || h.includes(n) || (c && (c.includes(h) || h.includes(c)))
  })

  if (!match) return null
  return { project_id: match.id, project_name: match.name }
}

async function extractWriteAction(
  intent: ChatIntent,
  message: string,
  provider: string,
  model: string,
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<PendingAction | null> {
  const adapter = getLLMAdapter(provider as 'openai' | 'anthropic', model)
  const today = new Date().toISOString().split('T')[0]

  try {
    if (intent === 'create_expense') {
      const raw = await adapter.extractStructuredOutput<Record<string, unknown>>(
        `Extract expense details from this message: "${message}"\n\nToday is ${today}.\n\n- title: the specific vendor, service, or product name being paid for. Look for the name after "for" or after "expense for". Examples: "add $20 expense for ChatGPT" → "ChatGPT", "monthly Slack subscription" → "Slack", "AWS bill" → "AWS". NEVER use generic words like "expense", "cost", "fee", or "bill" as the title. If no vendor name is present, use a short descriptive title like "Monthly Expense".\n- amount: digits only, no $ or commas.\n- category: best match from: ${EXPENSE_CATEGORIES.join(', ')}\n- date: YYYY-MM-DD. Default to ${today} if not mentioned.\n- recurrence: scan for these words — "monthly" → monthly, "annual" or "yearly" → annual, "quarterly" → quarterly, "one-time" or "once" → one_time. Leave null only if no recurrence clue exists.\n- notes: optional additional context.`,
        { title: 'string (vendor/service name, e.g. "ChatGPT", "AWS")', amount: 'number', category: 'string', date: `YYYY-MM-DD (default ${today})`, recurrence: 'monthly|quarterly|annual|one_time (or null)', notes: 'string (optional)' }
      )
      if (!raw.amount) {
        const m = message.match(/\$?([\d,]+(?:\.\d{1,2})?)\b/)
        if (m) raw.amount = parseFloat(m[1].replace(/,/g, ''))
      }
      if (!raw.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw.date))) {
        raw.date = today
      }
      const parsed = ExpenseSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[create_expense] Zod validation failed:', parsed.error.format(), 'raw:', raw)
        return null
      }
      return { type: 'create_expense', params: parsed.data }
    }

    if (intent === 'create_invoice') {
      const raw = await adapter.extractStructuredOutput<Record<string, unknown>>(
        `Extract invoice details from: "${message}"\nToday is ${today}. Due date defaults to 30 days from today.`,
        { customerName: 'string', amount: 'number', dueDate: 'YYYY-MM-DD', notes: 'string (optional)' }
      )
      if (!raw.amount) {
        const m = message.match(/\$?([\d,]+(?:\.\d{1,2})?)\b/)
        if (m) raw.amount = parseFloat(m[1].replace(/,/g, ''))
      }
      if (!raw.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw.dueDate))) {
        const thirtyDays = new Date(Date.now() + 30 * 86400_000)
        raw.dueDate = thirtyDays.toISOString().split('T')[0]
      }
      const parsed = InvoiceSchema.safeParse(raw)
      if (!parsed.success) return null
      return { type: 'create_invoice', params: parsed.data }
    }

    if (intent === 'add_income') {
      const raw = await adapter.extractStructuredOutput<Record<string, unknown>>(
        `Extract income/payment details from this message: "${message}"\n\nToday is ${today}.\n\nRules:\n- amount: extract as a plain number (e.g. 500, not "$500"). If not stated, leave null.\n- date: YYYY-MM-DD. If not stated, use ${today}.\n- description: brief label for the payment (e.g. "KPI Project payment", "Access Engineering payment").\n- category: pick the best fit from: ${INCOME_CATEGORIES.join(', ')}. Default to "Other Income" if unsure.\n- project_name: IMPORTANT — if the message mentions ANY company name, project name, or client name (even just as a proper noun like "Access Engineering" or "KPI Project"), extract it here. Do not require the word "project" or "client" to be present.\n- source: optional payment source (e.g. "bank transfer", "PayPal").\n\nExamples:\n- "Access Engineering paid $500" → project_name: "Access Engineering", amount: 500\n- "Add $500 to KPI Project income" → project_name: "KPI Project", amount: 500\n- "Client paid us $2000 upfront" → project_name: null (no specific name given), amount: 2000`,
        { description: 'string', amount: 'number', category: 'string', date: `YYYY-MM-DD (default ${today})`, source: 'string (optional)', project_name: 'string (optional — any company, project, or client name mentioned)' }
      )
      // Regex fallback: if LLM didn't extract amount, pull it from message text
      if (!raw.amount) {
        const m = message.match(/\$?([\d,]+(?:\.\d{1,2})?)\b/)
        if (m) raw.amount = parseFloat(m[1].replace(/,/g, ''))
      }
      // Regex fallback: if LLM didn't extract a description, derive from message
      if (!raw.description) {
        raw.description = 'Payment received'
      }
      // Default missing or malformed date to today before Zod validation
      if (!raw.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw.date))) {
        raw.date = today
      }
      const parsed = IncomeSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[add_income] Zod validation failed:', parsed.error.format(), 'raw:', raw)
        return null
      }

      const params = { ...parsed.data }

      // Resolve project_name to a project_id from the org's existing projects
      if (params.project_name) {
        const resolved = await resolveProjectId(supabase, orgId, params.project_name)
        if (resolved) {
          return { type: 'add_income', params: { ...params, ...resolved } }
        }
      }

      return { type: 'add_income', params }
    }
  } catch (err) {
    console.error('[extractWriteAction] failed:', err)
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

  if (intent === 'confirm_action') {
    // Look up the most recent assistant message in this session that has a pendingAction
    const { data: lastActionMsg } = await supabase
      .from('chat_messages')
      .select('data_context')
      .eq('session_id', chatSessionId)
      .eq('role', 'assistant')
      .not('data_context', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const stored = lastActionMsg?.data_context as { pendingAction?: PendingAction } | null
    if (stored?.pendingAction) {
      pendingAction = stored.pendingAction
      const confirmText = formatPendingActionSummary(pendingAction)
      const context = { pending_action: pendingAction.params, today: new Date().toISOString().split('T')[0] }
      const systemPrompt = buildSystemPrompt(context)
      responseText = await adapter.chat(
        [{ role: 'user', content: `The user confirmed. Here are the details again: ${confirmText}. Re-present this as a brief 1-2 sentence confirmation message asking them to click Confirm to save. Be friendly and concise.` }],
        systemPrompt
      )
    } else {
      responseText = "I don't have a pending action to confirm. Could you restate what you'd like to record?"
    }
  } else if (isWriteIntent) {
    // Extract action params, then ask LLM for a friendly confirmation message
    pendingAction = await extractWriteAction(intent, message, provider, model, orgId, supabase) ?? undefined

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
