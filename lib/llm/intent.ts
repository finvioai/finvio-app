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
    patterns: [/\bmrr\b/i, /monthly recurring/i, /recurring revenue/i],
  },
  {
    intent: 'query_burn',
    patterns: [/burn rate/i, /monthly (spend|spending|expenses?)/i, /how much.*spend/i],
  },
  {
    intent: 'query_pnl',
    patterns: [/\bp&l\b/i, /profit.*(loss)?/i, /net income/i, /income statement/i],
  },
  {
    intent: 'query_forecast',
    patterns: [/forecast/i, /project(ion|ed)?/i, /next \d+ months?/i, /predict/i],
  },
  {
    intent: 'query_customers',
    patterns: [/churn/i, /active (customer|user|subscriber)/i, /\barpu\b/i, /customer count/i],
  },
  {
    intent: 'create_expense',
    patterns: [/(add|log|record|create|new) expense/i, /spent \$?[\d]/i, /paid \$?[\d].*(for)/i],
  },
  {
    intent: 'create_invoice',
    patterns: [/(create|generate|send|new) invoice/i, /bill (a |the )?customer/i],
  },
  {
    intent: 'add_income',
    patterns: [/(add|log|record) (income|revenue|payment)/i, /received \$?[\d]/i],
  },
]

export async function detectIntent(
  message: string,
  provider = 'openai',
  model = 'gpt-4o-mini'
): Promise<ChatIntent> {
  // Fast keyword pass
  for (const { intent, patterns } of KEYWORD_MAP) {
    if (patterns.some((p) => p.test(message))) return intent
  }

  // LLM fallback for ambiguous messages
  try {
    const adapter = getLLMAdapter(provider as 'openai' | 'anthropic', model)
    const result = await adapter.extractStructuredOutput<{ intent: ChatIntent }>(
      `Classify this user message into exactly one of these intents: query_runway, query_mrr, query_burn, query_pnl, query_forecast, query_customers, create_expense, create_invoice, add_income, unknown.\n\nMessage: "${message}"`,
      { intent: 'string' }
    )
    return result.intent ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
