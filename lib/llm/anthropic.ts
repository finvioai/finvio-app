import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter } from './adapter'
import type { ChatMessagePayload } from '@/types'

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic
  private model: string

  constructor(model: string) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    this.model = model
  }

  async chat(messages: ChatMessagePayload[], systemPrompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      system: systemPrompt,
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      max_tokens: 1024,
    })

    const block = response.content[0]
    return block?.type === 'text' ? block.text : ''
  }

  async extractStructuredOutput<T>(prompt: string, schema: object): Promise<T> {
    const response = await this.client.messages.create({
      model: this.model,
      system:
        'You are a data extraction assistant. Respond ONLY with valid JSON that matches the provided schema. No markdown, no explanation.',
      messages: [
        { role: 'user', content: `Schema: ${JSON.stringify(schema)}\n\n${prompt}` },
      ],
      max_tokens: 512,
    })

    const block = response.content[0]
    const raw = block?.type === 'text' ? block.text : '{}'

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    return JSON.parse(cleaned) as T
  }
}
