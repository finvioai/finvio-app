'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Save, Clock, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InvestorUpdate } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusColor(status: string | null) {
  if (status === 'sent') return 'bg-brand-tint text-brand'
  return 'bg-off-white text-muted-ink'
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvestorUpdatesPage() {
  const [updates, setUpdates] = useState<InvestorUpdate[]>([])
  const [selected, setSelected] = useState<InvestorUpdate | null>(null)
  const [editContent, setEditContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [genError, setGenError] = useState('')
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    fetch('/api/investor-updates')
      .then((r) => r.json())
      .then((d: { updates: InvestorUpdate[] }) => setUpdates(d.updates ?? []))
      .finally(() => setLoadingList(false))
  }, [])

  function selectUpdate(u: InvestorUpdate) {
    setSelected(u)
    setEditContent(u.content)
    setGenError('')
  }

  async function generate() {
    setGenerating(true)
    setGenError('')
    try {
      const res = await fetch('/api/investor-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json() as { update?: InvestorUpdate; error?: string }
      if (!res.ok || !json.update) throw new Error(json.error ?? 'Generation failed')
      const update = json.update
      setUpdates((prev) => [update, ...prev])
      setSelected(update)
      setEditContent(update.content)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      const body: Record<string, string> = { content: editContent }
      if (selected) {
        body.month = selected.month
        body.period = selected.period
      }
      const res = await fetch('/api/investor-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { update?: InvestorUpdate }
      if (json.update) {
        const saved = json.update
        setUpdates((prev) => {
          const idx = prev.findIndex((u) => u.id === saved.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = saved
            return next
          }
          return [saved, ...prev]
        })
        setSelected(saved)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Investor Updates</h1>
          <p className="text-sm text-muted-ink mt-0.5">AI-generated drafts with your live metrics</p>
        </div>
        <Button onClick={generate} disabled={generating}>
          {generating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" />Generate new update</>
          )}
        </Button>
      </div>

      {genError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{genError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="rounded-xl border border-hairline bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline/70">
            <p className="text-sm font-semibold text-navy">Past updates</p>
          </div>

          {loadingList ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </div>
          ) : updates.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-ink/60">No updates yet.</p>
              <p className="text-xs text-muted-ink/60 mt-1">
                Click &quot;Generate new update&quot; to create your first draft.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {updates.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUpdate(u)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-off-white transition-colors flex items-start justify-between gap-2',
                    selected?.id === u.id && 'bg-brand-tint'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{u.period}</p>
                    <p className="text-xs text-muted-ink/60 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {u.created_at ? fmtDate(u.created_at) : '—'}
                    </p>
                    <span className={cn(
                      'mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                      statusColor(u.status)
                    )}>
                      {u.status ?? 'draft'}
                    </span>
                  </div>
                  <ChevronRight className={cn(
                    'h-4 w-4 shrink-0 mt-0.5',
                    selected?.id === u.id ? 'text-brand/80' : 'text-muted-ink/40'
                  )} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2 rounded-xl border border-hairline bg-white flex flex-col min-h-[500px]">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-12 text-center">
              <div>
                <Sparkles className="h-10 w-10 text-muted-ink/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-ink">
                  Select an update or generate a new one
                </p>
                <p className="text-xs text-muted-ink/60 mt-1">
                  Finvio will draft it using your live metrics
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline/70">
                <div>
                  <p className="text-sm font-semibold text-navy">{selected.period}</p>
                  <span className={cn(
                    'mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                    statusColor(selected.status)
                  )}>
                    {selected.status ?? 'draft'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
                    {generating
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">Regenerate</span>
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Save className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">Save</span>
                  </Button>
                </div>
              </div>

              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full resize-none p-5 text-sm text-navy font-mono leading-relaxed focus:outline-none rounded-b-xl"
                style={{ minHeight: '420px' }}
                placeholder="Your investor update will appear here…"
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
