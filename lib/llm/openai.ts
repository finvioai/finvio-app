import OpenAI from 'openai'
import type { LLMAdapter } from './adapter'
import type { ChatMessagePayload } from '@/types'

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI
  private model: string

  constructor(model: string) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.model = model
  }

  async chat(messages: ChatMessagePayload[], systemPrompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 1024,
      temperature: 0.3,
    })
    return response.choices[0]?.message?.content ?? ''
  }

  async extractStructuredOutput<T>(prompt: string, schema: object): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a data extraction assistant. Respond ONLY with valid JSON that matches the provided schema. No markdown, no explanation.',
        },
        { role: 'user', content: `Schema: ${JSON.stringify(schema)}\n\n${prompt}` },
      ],
      max_tokens: 512,
      temperature: 0,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    return JSON.parse(raw) as T
  }
}
