import { getLLMAdapter } from '@/lib/llm/factory'
import type { CategorizationResult } from '@/types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/types'

export async function categorizeWithAI(
  description: string,
  type: 'income' | 'expense'
): Promise<CategorizationResult> {
  const provider = (process.env.DEFAULT_LLM_PROVIDER ?? 'openai') as 'openai' | 'anthropic'
  const model = process.env.DEFAULT_LLM_MODEL ?? 'gpt-4o-mini'
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const fallback = type === 'income' ? 'Other Income' : 'Other Expense'

  try {
    const adapter = getLLMAdapter(provider, model)
    const result = await adapter.extractStructuredOutput<{ category: string }>(
      `Categorize this ${type} transaction: "${description}"
Valid categories: ${categories.join(', ')}
Pick exactly one category from the list above. If uncertain, use "${fallback}".`,
      { category: `string — one of: ${categories.join(', ')}` }
    )

    const matched = (categories as readonly string[]).includes(result.category)
    return {
      category: matched ? result.category : fallback,
      confidence: 'low',
      method: 'ai',
    }
  } catch {
    return { category: fallback, confidence: 'low', method: 'ai' }
  }
}
