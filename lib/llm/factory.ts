import type { LLMAdapter } from './adapter'
import { OpenAIAdapter } from './openai'
import { AnthropicAdapter } from './anthropic'
import type { LLMProvider } from '@/types'

// Module-level singleton cache — OpenAI/Anthropic SDK clients are designed to be reused.
// Creating a new client per-call wastes HTTP connection pools and causes accumulation.
const _cache = new Map<string, LLMAdapter>()

export function getLLMAdapter(provider: LLMProvider, model: string): LLMAdapter {
  const key = `${provider}:${model}`
  let adapter = _cache.get(key)
  if (!adapter) {
    adapter = provider === 'anthropic' ? new AnthropicAdapter(model) : new OpenAIAdapter(model)
    _cache.set(key, adapter)
  }
  return adapter
}
