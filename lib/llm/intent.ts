import type { ChatIntent } from '@/types'
import { getLLMAdapter } from './factory'

// ─── keyword rules ───────────────────────────────────────────────────────────

const KEYWORD_MAP: { intent: ChatIntent; patterns: RegExp[] }[] = [
  {
    intent: 'query_runway',
    patterns: [/runway/i, /months? left/i, /how long.*(money|cash|fund)/i, /burn.*out/i],
  },
  {
    intent: 'query_mrr',
    // Only fires on explicit MRR/recurring-revenue phrasing; generic "revenue" routes to query_revenue
    patterns: [/\bmrr\b/i, /monthly recurring/i, /recurring revenue/i],
  },
  {
    intent: 'query_revenue',
    patterns: [/what.*(my|our) revenue/i, /how much.*(make|earn|made|earned)/i, /total revenue/i, /monthly income/i, /\brevenue\b.*\bthis month\b/i],
  },
  {
    intent: 'query_profit',
    patterns: [/\bprofit\b/i, /gross margin/i, /net profit/i, /how profitable/i, /are we profitable/i],
  },
  {
    intent: 'query_project',
    patterns: [/project status/i, /how is (project|the project)/i, /\bbillable\b/i, /work in progress/i, /\bwip\b/i, /project.*revenue/i],
  },
  {
    intent: 'query_burn',
    patterns: [/burn rate/i, /what.{0,20}monthly (spend|spending|expenses?)/i, /how much.*spend/i],
  },
  {
    intent: 'query_pnl',
    patterns: [/\bp&l\b/i, /profit.*(loss)?/i, /net income/i, /income statement/i],
  },
  {
    intent: 'query_forecast',
    // Note: 'project' alone is intentionally excluded — it matches Projects page intent.
    // Only match 'projection', 'projected', 'forecast', etc.
    patterns: [/forecast/i, /projecti(on|ed)/i, /next \d+ months?/i, /predict/i],
  },
  {
    intent: 'query_customers',
    patterns: [/churn/i, /active (customer|user|subscriber)/i, /\barpu\b/i, /customer count/i],
  },
  {
    intent: 'query_expenses',
    patterns: [
      /what.{0,20}(my|our|this month'?s?) expenses?/i,
      /how much.{0,15}(spent|spending)/i,
      /(show|list|tell).{0,15}(my |our )?expenses?/i,
      /expense(s)? (this month|breakdown|summary)/i,
      /top (expenses?|costs?)/i,
      /biggest (expenses?|costs?)/i,
    ],
  },
  {
    intent: 'query_help',
    patterns: [
      /how (do|can) (i|we)/i,
      /how (to|does).{0,30}(use|connect|add|create|set up)/i,
      /where (is|are|can i find)/i,
      /what (is|are).{0,20}(page|feature|section|tab)/i,
      /help me (with|understand)/i,
      /getting started/i,
      /\bsupport\b/i,
    ],
  },
  {
    intent: 'create_expense',
    patterns: [
      /(add|log|record|create|new).{0,40}expense/i,       // "add $20 monthly expense for X"
      /(monthly|weekly|quarterly|annual|yearly|recurring).{0,20}(expense|cost|fee|subscription)/i,
      /expense.{0,10}for\s+\w/i,                          // "expense for ChatGPT"
      /\$?[\d,]+.{0,20}(expense|subscription|fee|bill)/i, // "$20 subscription"
      /spent \$?[\d]/i,
      /paid \$?[\d].*(for)/i,
    ],
  },
  {
    intent: 'create_invoice',
    patterns: [
      /(create|generate|send|new) invoice/i,
      /bill (a |the )?customer/i,
      /(create|make|convert|turn).{0,20}(quotation|quote|estimate|this).{0,20}invoice/i,
      /(quotation|quote|estimate).{0,20}(to|into|as).{0,20}invoice/i,
      /can you.{0,30}invoice/i,
    ],
  },
  {
    intent: 'add_income',
    patterns: [
      // ── Explicit record intent ──────────────────────────────────────────────
      /(add|log|record|track|save) (income|revenue|payment|earning)/i,
      // "add $500 income", "add $500 to income" (amount between verb and noun)
      /add.{0,30}(income|revenue)/i,
      // "record this as income", "put this under revenue"
      /(record|log|save|put).{0,15}(as |under |in |to )?(the |our )?(income|revenue)/i,

      // ── "paid us / paid me" ─────────────────────────────────────────────────
      /paid (us|me)/i,
      /just paid/i,
      // "they paid upfront", "[client] paid the invoice"
      /.{0,30}paid (upfront|advance|deposit|the invoice|an invoice)/i,

      // ── "gave us / gave me" ─────────────────────────────────────────────────
      /(give|gave|gives|given).{0,10}(us|me)/i,

      // ── "sent us / transferred / wired" ────────────────────────────────────
      /(send|sent|wire|wired|transfer|transferred).{0,10}(us|me)/i,
      // "client sent $X", "they transferred $2,000"
      /(send|sent|wire|wired|transfer|transferred).{0,30}\$?[\d]/i,

      // ── Payment received / incoming ─────────────────────────────────────────
      /received \$?[\d]/i,
      /(got|get) paid/i,
      /(we|i|us).{0,10}(received|got).{0,20}\$?[\d]/i,
      /payment (received|came in|came through|from|by)/i,
      /\$?[\d,]+.{0,20}came in/i,
      /(money|funds|cash).{0,20}(came in|received|arrived|transferred)/i,

      // ── Invoice / billing paid ──────────────────────────────────────────────
      /(invoice|bill).{0,15}(paid|settled|cleared)/i,
      /(settled|cleared|paid).{0,15}(invoice|bill)/i,

      // ── Upfront / deposit / advance ─────────────────────────────────────────
      /(upfront|advance|deposit).{0,20}(payment|paid|received|from)/i,
      /(payment|paid).{0,20}(upfront|advance|deposit)/i,

      // ── "add that/this/it to income" ────────────────────────────────────────
      /add (it|that|this|the amount).{0,20}(to )?(the |our )?(income|revenue)/i,
      /add.{0,30}to.{0,10}(income|revenue)/i,

      // ── "$X income from ..." ─────────────────────────────────────────────────
      /\$?[\d,]+.{0,20}(income|revenue).{0,20}(from|for|to)/i,

      // ── Client/customer/project paid ────────────────────────────────────────
      /(client|customer|they|he|she|company).{0,20}(paid|gave|sent|wired|transferred)/i,
      /(project|client|customer).{0,10}payment/i,
      /made a payment/i,

      // ── "[Name/company] paid $X" — proper noun subject paying an amount ──────
      // Requires 2+ char word starting with capital (excludes bare "I paid")
      // Matches: "Access Engineering paid $500", "KPI Project paid $2000", "John paid $150"
      /\b[A-Z][a-zA-Z]+(?:\s+[A-Za-z]+)?\s+paid\s+\$?[\d]/,

      // ── "add [amount] to [name]'s income / [project] income" ─────────────────
      /add\s+\$?[\d].{0,40}(income|revenue)/i,

      // ── "[name] income" / "[project] income" + amount anywhere in message ────
      /\$?[\d,]+.{0,40}(project|client).{0,20}income/i,
    ],
  },
]

// ─── confirm_action fast-path ────────────────────────────────────────────────
// Checked before KEYWORD_MAP so a short "yes" never falls through to LLM
const CONFIRM_PATTERNS = [
  /^(yes|yeah|yep|yup|ok|okay|sure|correct|right|confirm|confirmed|proceed|go ahead|do it|looks good|that'?s? (right|correct|good)|sounds good)\.?$/i,
  /^(yes please|please proceed|please confirm|go for it|yes go ahead)\.?$/i,
]

export async function detectIntent(
  message: string,
  provider = 'openai',
  model = 'gpt-4o-mini'
): Promise<ChatIntent> {
  // Check for bare confirmations first — before any other pattern
  if (CONFIRM_PATTERNS.some((p) => p.test(message.trim()))) return 'confirm_action'

  // Fast keyword pass
  for (const { intent, patterns } of KEYWORD_MAP) {
    if (patterns.some((p) => p.test(message))) return intent
  }

  // LLM fallback for ambiguous messages
  try {
    const adapter = getLLMAdapter(provider as 'openai' | 'anthropic', model)
    const result = await adapter.extractStructuredOutput<{ intent: ChatIntent }>(
      `Classify this user message into exactly one of these intents: query_runway, query_mrr, query_revenue, query_profit, query_project, query_burn, query_pnl, query_forecast, query_customers, query_expenses, query_help, create_expense, create_invoice, add_income, confirm_action, unknown.\n\nRules:\n- Use confirm_action ONLY for short affirmative replies (e.g. "yes", "ok", "sure", "correct", "proceed", "go ahead"). NEVER use confirm_action if the message contains a dollar amount or describes a new transaction.\n- Use create_expense when the user wants to record any cost, payment, bill, or subscription — regardless of phrasing.\n- Use create_invoice when the user wants to create an invoice OR convert a quotation/quote/estimate into an invoice.\n- Use add_income when the user wants to RECORD a payment they received.\n- Use query_expenses when the user asks about their expenses, spending, or costs for a period.\n- Use query_help when the user asks how to use the app, where to find something, or what a feature does.\n- Use query_mrr ONLY when the user explicitly says "MRR" or "recurring revenue".\n- Use query_revenue for general revenue questions.\n- Use query_profit for profit/margin questions.\n- Use query_project to ask about project status or summaries.\n- Use query_forecast for forecasts/projections.\n\nMessage: "${message}"`,
      { intent: 'string' }
    )
    return result.intent ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
