import type { ChatMessagePayload } from '@/types'

export interface LLMAdapter {
  chat(messages: ChatMessagePayload[], systemPrompt: string): Promise<string>
  extractStructuredOutput<T>(prompt: string, schema: object): Promise<T>
}
