'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendingDown, TrendingUp, AlertCircle, CheckCircle2, Loader2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddExpenseModal } from '@/components/modals/AddExpenseModal'
import { AddIncomeModal } from '@/components/modals/AddIncomeModal'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, RECURRENCE_OPTIONS } from '@/types'
import type { Transaction, Project } from '@/types'
import { cn } from '@/lib/utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const confidenceBadge = {
  high: 'bg-green-50 text-green-700',
  medium: 'bg-yellow-50 text-yellow-700',
  low: 'bg-orange-50 text-orange-700',
}

// ─── Review Queue Row ─────────────────────────────────────────────────────────

function ReviewRow({
  txn,
  projects,
  onCategoryChange,
  onMarkReviewed,
  onProjectChange,
}: {
  txn: Transaction
  projects: Project[]
  onCategoryChange: (id: string, category: string) => Promise<void>
  onMarkReviewed: (id: string) => Promise<void>
  onProjectChange: (id: string, projectId: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const categories = txn.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const activeProjects = projects.filter((p) => p.status === 'active')

  async function handleCategory(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    await onCategoryChange(txn.id, e.target.value)
    setSaving(false)
  }

  async function handleReviewed() {
    setSaving(true)
    await onMarkReviewed(txn.id)
    setSaving(false)
  }

  async function handleProject(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    await onProjectChange(txn.id, e.target.value || null)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
          txn.type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
          {txn.type === 'expense' ? '−' : '+'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{txn.description}</p>
          <p className="text-xs text-gray-500">{fmtDate(txn.date)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('text-sm font-semibold', txn.type === 'expense' ? 'text-red-600' : 'text-green-600')}>
            {txn.type === 'expense' ? '−' : '+'}{fmt(txn.amount)}
          </p>
          {txn.category_confidence && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded', confidenceBadge[txn.category_confidence as keyof typeof confidenceBadge] ?? 'bg-gray-100 text-gray-600')}>
              {txn.category_confidence} confidence
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={txn.category ?? ''}
          onChange={handleCategory}
          disabled={saving}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">— pick category —</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {activeProjects.length > 0 && (
          <select
            value={(txn as Transaction & { project_id?: string | null }).project_id ?? ''}
            onChange={handleProject}
            disabled={saving}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">No project</option>
            {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleReviewed}
          disabled={saving || !txn.category}
          className="h-8 gap-1 text-xs ml-auto"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Done
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showIncomeModal, setShowIncomeModal] = useState(false)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const [txnRes, projRes] = await Promise.all([
        fetch(`/api/transactions?${params}`),
        fetch('/api/projects'),
      ])
      if (txnRes.ok) {
        const data = await txnRes.json()
        setTransactions(data.transactions ?? [])
      }
      if (projRes.ok) {
        const data = await projRes.json()
        setProjects(data.projects ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  async function handleCategoryChange(id: string, category: string) {
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, category }),
    })
    if (res.ok) {
      const { transaction } = await res.json()
      setTransactions((prev) => prev.map((t) => t.id === id ? transaction : t))
    }
  }

  async function handleMarkReviewed(id: string) {
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_reviewed: true }),
    })
    if (res.ok) {
      const { transaction } = await res.json()
      setTransactions((prev) => prev.map((t) => t.id === id ? transaction : t))
    }
  }

  async function handleProjectChange(id: string, projectId: string | null) {
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, project_id: projectId }),
    })
    if (res.ok) {
      const { transaction } = await res.json()
      setTransactions((prev) => prev.map((t) => t.id === id ? transaction : t))
    }
  }

  async function handleRecurrenceChange(id: string, recurrence: string | null) {
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, recurrence }),
    })
    if (res.ok) {
      const { transaction } = await res.json()
      setTransactions((prev) => prev.map((t) => t.id === id ? transaction : t))
    }
  }

  const unreviewed = transactions.filter((t) => !t.is_reviewed)
  const reviewed = transactions.filter((t) => t.is_reviewed)

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review, categorize, and add transactions.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIncomeModal(true)}
            className="gap-1.5"
          >
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            Add Income
          </Button>
          <Button
            size="sm"
            onClick={() => setShowExpenseModal(true)}
            className="gap-1.5"
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Income</p>
            <p className="text-lg font-bold text-green-600">{fmt(totalIncome)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Expenses</p>
            <p className="text-lg font-bold text-red-600">{fmt(totalExpenses)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-500">Net</p>
            <p className={cn('text-lg font-bold', totalIncome - totalExpenses >= 0 ? 'text-gray-900' : 'text-red-600')}>
              {fmt(totalIncome - totalExpenses)}
            </p>
          </div>
        </div>
      )}

      {/* Review queue */}
      {unreviewed.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <h2 className="text-sm font-semibold text-yellow-800">
              Review Queue — {unreviewed.length} transaction{unreviewed.length !== 1 ? 's' : ''} need attention
            </h2>
          </div>
          <div className="p-3 space-y-2">
            {unreviewed.map((txn) => (
              <ReviewRow
                key={txn.id}
                txn={txn}
                projects={projects}
                onCategoryChange={handleCategoryChange}
                onMarkReviewed={handleMarkReviewed}
                onProjectChange={handleProjectChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* All transactions */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            All Transactions {reviewed.length > 0 && `(${reviewed.length})`}
          </h2>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(['all', 'income', 'expense'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize',
                  typeFilter === f ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : reviewed.length === 0 && unreviewed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Plus className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900">No transactions yet</p>
            <p className="mt-1 text-xs text-gray-500 max-w-xs">
              Add expenses or income manually, or connect an integration to start seeing data.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowIncomeModal(true)}>Add Income</Button>
              <Button size="sm" onClick={() => setShowExpenseModal(true)}>Add Expense</Button>
            </div>
          </div>
        ) : reviewed.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            All transactions are in the review queue above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recurrence</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reviewed.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    projects={projects}
                    projectMap={projectMap}
                    onCategoryChange={handleCategoryChange}
                    onProjectChange={handleProjectChange}
                    onRecurrenceChange={handleRecurrenceChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddExpenseModal
        open={showExpenseModal}
        onOpenChange={setShowExpenseModal}
        onSuccess={fetchTransactions}
      />
      <AddIncomeModal
        open={showIncomeModal}
        onOpenChange={setShowIncomeModal}
        onSuccess={fetchTransactions}
      />
    </div>
  )
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TransactionRow({
  txn,
  projects,
  projectMap,
  onCategoryChange,
  onProjectChange,
  onRecurrenceChange,
}: {
  txn: Transaction
  projects: Project[]
  projectMap: Record<string, string>
  onCategoryChange: (id: string, category: string) => Promise<void>
  onProjectChange: (id: string, projectId: string | null) => Promise<void>
  onRecurrenceChange: (id: string, recurrence: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const categories = txn.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const activeProjects = projects.filter((p) => p.status === 'active')
  const txnWithProject = txn as Transaction & { project_id?: string | null }

  async function handleCategory(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    await onCategoryChange(txn.id, e.target.value)
    setSaving(false)
  }

  async function handleProject(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    await onProjectChange(txn.id, e.target.value || null)
    setSaving(false)
  }

  async function handleRecurrence(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    await onRecurrenceChange(txn.id, e.target.value || null)
    setSaving(false)
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(txn.date)}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 truncate max-w-[200px]">{txn.description}</p>
        {txn.vendor && <p className="text-xs text-gray-500">{txn.vendor}</p>}
      </td>
      <td className="px-4 py-3">
        <select
          value={txn.category ?? ''}
          onChange={handleCategory}
          disabled={saving}
          className="h-7 rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 max-w-[160px]"
        >
          {!txn.category && <option value="">Uncategorized</option>}
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={txn.recurrence ?? ''}
          onChange={handleRecurrence}
          disabled={saving}
          className="h-7 rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 max-w-[120px]"
        >
          <option value="">Not set</option>
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        {activeProjects.length > 0 ? (
          <select
            value={txnWithProject.project_id ?? ''}
            onChange={handleProject}
            disabled={saving}
            className="h-7 rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 max-w-[140px]"
          >
            <option value="">—</option>
            {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : txnWithProject.project_id ? (
          <span className="text-xs text-gray-600">{projectMap[txnWithProject.project_id] ?? '—'}</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="text-xs capitalize">
          {txn.source}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {txn.receipt_url ? (
          <a
            href={txn.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <Paperclip className="h-3.5 w-3.5" />
            View
          </a>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className={cn('font-semibold', txn.type === 'expense' ? 'text-red-600' : 'text-green-600')}>
          {txn.type === 'expense' ? '−' : '+'}{fmt(txn.amount)}
        </span>
      </td>
    </tr>
  )
}
