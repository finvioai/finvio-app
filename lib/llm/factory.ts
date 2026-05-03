import type { LLMAdapter } from './adapter'
import { OpenAIAdapter } from './openai'
import { AnthropicAdapter } from './anthropic'
import type { LLMProvider } from '@/types'

export function getLLMAdapter(provider: LLMProvider, model: string): LLMAdapter {
  if (provider === 'anthropic') return new AnthropicAdapter(model)
  return new OpenAIAdapter(model)
}
