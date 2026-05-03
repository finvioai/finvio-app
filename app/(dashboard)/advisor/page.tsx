'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, AlertTriangle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmationCard } from '@/components/chat/ConfirmationCard'
import type { PendingAction } from '@/types'
import { cn } from '@/lib/utils'

// ─── types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  pendingAction?: PendingAction
  confirmed?: boolean
  cancelled?: boolean
}

// ─── suggested prompts ───────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { label: 'What\'s my runway?', category: 'cash' },
  { label: 'What\'s my MRR this month?', category: 'revenue' },
  { label: 'What\'s my burn rate?', category: 'cash' },
  { label: 'Show me a P&L summary', category: 'reports' },
  { label: 'Add a $500 expense for AWS hosting', category: 'write' },
  { label: 'Create an invoice for Acme Corp for $2,000', category: 'write' },
  { label: 'What\'s my churn rate?', category: 'customers' },
  { label: 'Forecast my MRR for next 6 months', category: 'forecast' },
]

const categoryColors: Record<string, string> = {
  cash: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  revenue: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  reports: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  write: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  customers: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  forecast: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function MessageBubble({
  message,
  sessionId,
  onConfirmed,
  onCancelled,
}: {
  message: Message
  sessionId: string
  onConfirmed: (id: string) => void
  onCancelled: (id: string) => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 mt-0.5">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={cn('max-w-[75%] space-y-2', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm shadow-sm'
          )}
        >
          {message.content}
        </div>
        {message.pendingAction && !message.confirmed && !message.cancelled && (
          <ConfirmationCard
            action={message.pendingAction}
            sessionId={sessionId}
            onConfirmed={() => onConfirmed(message.id)}
            onCancelled={() => onCancelled(message.id)}
          />
        )}
        {message.confirmed && (
          <p className="text-xs text-green-600 px-1">Action confirmed and saved.</p>
        )}
        {message.cancelled && (
          <p className="text-xs text-gray-400 px-1">Cancelled — nothing was saved.</p>
        )}
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput('')

    const userMsg: Message = { id: uid(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    setDataWarning(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'assistant', content: `Error: ${data.error ?? 'Something went wrong.'}` },
        ])
        return
      }

      if (data.sessionId) setSessionId(data.sessionId)

      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: data.message,
        pendingAction: data.pendingAction,
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Surface data warnings if any were embedded in the response
      if (data.message.toLowerCase().includes('no data') || data.message.toLowerCase().includes('connect')) {
        setDataWarning('Some financial data may be missing. Connect integrations for better insights.')
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: 'Network error. Please try again.' },
      ])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleConfirmed(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, confirmed: true } : m)))
  }

  function handleCancelled(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, cancelled: true } : m)))
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">AI Financial Advisor</h1>
            <p className="text-xs text-gray-500">Powered by real financial data, not guesses</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">AI Powered</span>
      </div>

      {/* Data warning banner */}
      {dataWarning && (
        <div className="flex items-center gap-2 bg-yellow-50 border-b border-yellow-200 px-6 py-2.5 text-xs text-yellow-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
          {dataWarning}
          <button
            onClick={() => setDataWarning(null)}
            className="ml-auto text-yellow-600 hover:text-yellow-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6 pb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <Sparkles className="h-7 w-7 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ask me anything about your finances</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                I answer using your real data — not averages. I can also create expenses, invoices, and income records for you.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => sendMessage(p.label)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    categoryColors[p.category]
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                sessionId={sessionId ?? ''}
                onConfirmed={handleConfirmed}
                onCancelled={handleCancelled}
              />
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-200 px-4 py-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested chips when there are messages */}
      {!isEmpty && (
        <div className="border-t border-gray-100 bg-white px-6 py-2 flex gap-2 overflow-x-auto">
          {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
            <button
              key={p.label}
              onClick={() => sendMessage(p.label)}
              disabled={loading}
              className="shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="flex gap-3 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances, or say 'Add a $500 expense for Vercel'…"
            rows={1}
            className="resize-none flex-1 min-h-[42px] max-h-32 overflow-y-auto text-sm"
            disabled={loading}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-[42px] w-[42px] shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Press Enter to send · Shift+Enter for new line · Write actions require your confirmation
        </p>
      </div>
    </div>
  )
}
