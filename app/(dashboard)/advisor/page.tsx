'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Bot, AlertTriangle, Sparkles, Plus, MessageSquare, Clock, Trash2, Menu, X, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmationCard } from '@/components/chat/ConfirmationCard'
import { VoiceInput } from '@/components/chat/VoiceInput'
import { VOICE_QUERY_KEY } from '@/components/chat/FloatingAdvisorButton'
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

interface ChatSession {
  id: string
  title: string | null
  created_at: string | null
  updated_at: string | null
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
  cash: 'bg-brand-tint text-brand border-brand/20 hover:bg-brand-tint',
  revenue: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  reports: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  write: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  customers: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  forecast: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
}

const SESSION_STORAGE_KEY = 'finvio_chat_session_id'

// ─── helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand mt-0.5">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={cn('max-w-[85%] sm:max-w-[75%] space-y-2', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-base leading-relaxed',
            isUser
              ? 'bg-brand text-white rounded-tr-sm'
              : 'bg-white border border-hairline text-navy rounded-tl-sm shadow-sm'
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
          <p className="text-sm text-green-600 px-1">Action confirmed and saved.</p>
        )}
        {message.cancelled && (
          <p className="text-sm text-muted-ink/60 px-1">Cancelled — nothing was saved.</p>
        )}
      </div>
    </div>
  )
}

// ─── SessionSidebar ───────────────────────────────────────────────────────────

function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClose,
  loading,
}: {
  sessions: ChatSession[]
  activeSessionId: string | undefined
  onSelectSession: (session: ChatSession) => void
  onNewChat: () => void
  onDeleteSession: (id: string) => void
  onClose: () => void
  loading: boolean
}) {
  return (
    <>
      {/* Mobile header row with title and close button */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-hairline md:hidden">
        <span className="text-sm font-semibold text-navy/80">Recent Chats</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-off-white text-muted-ink"
          aria-label="Close history"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 border-b border-hairline">
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 text-sm"
          onClick={onNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-ink/60" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-ink/60 text-center">No previous chats</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                'group relative flex items-center mx-1 rounded-md transition-colors',
                activeSessionId === s.id
                  ? 'bg-brand-tint text-brand'
                  : 'text-navy/80 hover:bg-off-white'
              )}
              style={{ width: 'calc(100% - 8px)' }}
            >
              <button
                onClick={() => onSelectSession(s)}
                className="flex-1 text-left px-3 py-2.5 min-w-0"
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', activeSessionId === s.id ? 'text-brand/80' : 'text-muted-ink/60')} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate leading-tight pr-4">
                      {s.title ?? 'Untitled chat'}
                    </p>
                    <p className="text-xs text-muted-ink/60 mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(s.updated_at)}
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id) }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-ink/60 hover:text-red-500 hover:bg-red-50"
                title="Delete chat"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Guards the init effect from React Strict Mode's intentional double-invocation.
  // Refs survive the simulated unmount so the second run is a no-op.
  const initRef = useRef(false)

  // ─── load session list ──────────────────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions ?? [])
      }
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  // ─── restore last session or handle incoming voice query ──────────────
  // initRef prevents React Strict Mode's double-invocation from calling both
  // sendMessage (scheduled by the first run) AND loadSession (called by the
  // second run after the voice query was already removed from sessionStorage).
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    refreshSessions()
    const voiceQuery = sessionStorage.getItem(VOICE_QUERY_KEY)
    if (voiceQuery) {
      sessionStorage.removeItem(VOICE_QUERY_KEY)
      setTimeout(() => sendMessage(voiceQuery), 300)
      return
    }
    const saved = localStorage.getItem(SESSION_STORAGE_KEY)
    if (saved) loadSession(saved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ─── load messages for a session ───────────────────────────────────────
  async function loadSession(id: string) {
    setLoading(true)
    setMessages([])
    setSessionId(id)
    localStorage.setItem(SESSION_STORAGE_KEY, id)
    try {
      const res = await fetch(`/api/chat/sessions/${id}/messages`)
      if (res.ok) {
        const data = await res.json()
        const restored: Message[] = (data.messages ?? []).map((m: { id: string; role: 'user' | 'assistant'; content: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
        setMessages(restored)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleNewChat() {
    setMessages([])
    setSessionId(undefined)
    setDataWarning(null)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    textareaRef.current?.focus()
  }

  async function handleDeleteSession(id: string) {
    await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' })
    if (id === sessionId) handleNewChat()
    refreshSessions()
  }

  // ─── send message ───────────────────────────────────────────────────────
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

      if (data.sessionId) {
        setSessionId(data.sessionId)
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId)
        refreshSessions()
      }

      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: data.message,
        pendingAction: data.pendingAction,
      }
      setMessages((prev) => [...prev, assistantMsg])

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

  function handleTranscript(text: string, autoSend: boolean) {
    setInput(text)
    if (autoSend) {
      sendMessage(text)
    } else {
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }

  function handleConfirmed(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, confirmed: true } : m)))
  }

  function handleCancelled(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, cancelled: true } : m)))
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setLoading(true)

    const formData = new FormData()
    formData.append('file', file)
    if (sessionId) formData.append('sessionId', sessionId)

    try {
      const res = await fetch('/api/chat/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'user', content: `📎 ${file.name}` },
          { id: uid(), role: 'assistant', content: data.error ?? 'Failed to process the file. Please try again.' },
        ])
        return
      }

      if (data.sessionId) {
        setSessionId(data.sessionId)
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId)
        refreshSessions()
      }

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'user', content: `📎 ${file.name}` },
        { id: uid(), role: 'assistant', content: data.message, pendingAction: data.pendingAction ?? undefined },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: 'Network error while processing the file. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sessions sidebar */}
      <div
        className={cn(
          // Base: fixed overlay on mobile, slides in/out
          'fixed inset-y-0 left-0 z-50 flex flex-col w-72 border-r border-hairline bg-off-white',
          'transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible, reset to normal flow
          'md:static md:translate-x-0 md:w-56 md:shrink-0 md:transition-none',
        )}
      >
        <SessionSidebar
          sessions={sessions}
          activeSessionId={sessionId}
          onSelectSession={(s) => { loadSession(s.id); setSidebarOpen(false) }}
          onNewChat={() => { handleNewChat(); setSidebarOpen(false) }}
          onDeleteSession={handleDeleteSession}
          onClose={() => setSidebarOpen(false)}
          loading={sessionsLoading}
        />
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-hairline bg-white px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Burger button — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-off-white text-muted-ink shrink-0"
              aria-label="Open chat history"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-navy">AI Financial Advisor</h1>
              <p className="text-sm text-muted-ink hidden sm:block">Powered by real financial data, not guesses</p>
            </div>
          </div>
          <span className="text-xs text-muted-ink/60 bg-off-white border border-hairline rounded-full px-3 py-1 hidden sm:block">AI Powered</span>
        </div>

        {/* Data warning banner */}
        {dataWarning && (
          <div className="flex items-center gap-2 bg-yellow-50 border-b border-yellow-200 px-4 md:px-6 py-2.5 text-sm text-yellow-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
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
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-5">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-6 pb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tint">
                <Sparkles className="h-7 w-7 text-brand" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-navy">Ask me anything about your finances</h2>
                <p className="text-base text-muted-ink mt-1 max-w-sm">
                  I answer using your real data — not averages. I can also create expenses, invoices, and income records for you.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => sendMessage(p.label)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
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
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white border border-hairline px-4 py-3 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-ink/60" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested chips when there are messages */}
        {!isEmpty && (
          <div className="border-t border-hairline/70 bg-white px-4 md:px-6 py-2 flex gap-2 overflow-x-auto">
            {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
              <button
                key={p.label}
                onClick={() => sendMessage(p.label)}
                disabled={loading}
                className="shrink-0 rounded-full border border-hairline px-3 py-1 text-sm text-muted-ink hover:bg-off-white transition-colors disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-hairline bg-white px-4 md:px-6 py-4">
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances, add expenses, or upload a PDF receipt…"
              rows={1}
              className="resize-none flex-1 min-h-[44px] max-h-32 overflow-y-auto text-base"
              disabled={loading}
            />
            <label
              htmlFor="chat-file-upload"
              className={cn(
                'cursor-pointer flex items-center justify-center h-11 w-11 shrink-0 rounded-md border border-hairline hover:bg-off-white transition-colors',
                loading && 'opacity-50 pointer-events-none'
              )}
              title="Upload PDF receipt or invoice"
            >
              <Paperclip className="h-4 w-4 text-muted-ink" />
            </label>
            <input
              id="chat-file-upload"
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileUpload}
              disabled={loading}
            />
            <VoiceInput onTranscript={handleTranscript} disabled={loading} />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
