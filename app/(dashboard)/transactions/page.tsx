'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Paperclip, Trash2, TriangleAlert, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AddExpenseModal } from '@/components/modals/AddExpenseModal'
import { AddIncomeModal } from '@/components/modals/AddIncomeModal'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, RECURRENCE_OPTIONS } from '@/types'
import type { Transaction, Project, Invoice } from '@/types'
import { cn } from '@/lib/utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// manual + invoice always deletable; gmail is deletable because email parsing
// can be inaccurate and users should be able to remove false positives
const DELETABLE_SOURCES = new Set(['manual', 'invoice', 'gmail'])

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const [txnRes, projRes, invRes] = await Promise.all([
        fetch(`/api/transactions?${params}`),
        fetch('/api/projects'),
        fetch('/api/invoices?limit=200'),
      ])
      if (txnRes.ok) {
        const data = await txnRes.json()
        setTransactions(data.transactions ?? [])
      }
      if (projRes.ok) {
        const data = await projRes.json()
        setProjects(data.projects ?? [])
      }
      if (invRes.ok) {
        const data = await invRes.json()
        setInvoices(data.invoices ?? [])
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

  // Handles the combined Project / Invoice dropdown — clears the other field
  // when switching, sends both in a single PATCH to avoid race conditions.
  // Also keeps the local invoices state in sync so the UI doesn't require a
  // full page refresh to reflect status changes (paid / reverted to sent).
  async function handleLinkedEntityChange(
    id: string,
    projectId: string | null,
    invoiceId: string | null
  ) {
    // Capture old invoice_id before any state update
    const oldInvoiceId = transactions.find((t) => t.id === id)?.invoice_id ?? null

    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, project_id: projectId, invoice_id: invoiceId }),
    })
    if (res.ok) {
      const { transaction } = await res.json()
      setTransactions((prev) => prev.map((t) => t.id === id ? transaction : t))

      // Keep invoices state in sync with what the API just did:
      // - Newly linked invoice → mark paid in local state
      // - Previously linked invoice (now cleared/switched) → revert to sent
      setInvoices((prev) => prev.map((inv) => {
        if (invoiceId && inv.id === invoiceId) {
          return { ...inv, status: 'paid', paid_at: new Date().toISOString() }
        }
        if (oldInvoiceId && inv.id === oldInvoiceId && oldInvoiceId !== invoiceId) {
          return { ...inv, status: 'sent', paid_at: null }
        }
        return inv
      }))
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

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      if (res.ok) {
        setTransactions((prev) => prev.filter((t) => t.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  const unreviewedCount = transactions.filter((t) => !t.is_reviewed).length
  const duplicateCount = transactions.filter((t) => t.tags?.includes('potential_duplicate')).length
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

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

      {/* Categorization notice banner */}
      {unreviewedCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-800">
            <strong>{unreviewedCount} transaction{unreviewedCount !== 1 ? 's' : ''}</strong> have unverified categories — auto-assigned and may need correction.
            Rows marked with <TriangleAlert className="inline h-3.5 w-3.5 text-amber-500 mx-0.5" /> need your review. All are included in calculations.
          </span>
        </div>
      )}

      {/* Potential duplicate warning */}
      {duplicateCount > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-center gap-3">
          <Copy className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="text-sm text-orange-800">
            <strong>{duplicateCount} transaction{duplicateCount !== 1 ? 's' : ''}</strong> may be duplicates from different integrations.
            Rows marked with <Copy className="inline h-3.5 w-3.5 text-orange-500 mx-0.5" /> need your review — delete one if they represent the same event.
          </span>
        </div>
      )}

      {/* Unified transactions table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            All Transactions {transactions.length > 0 && `(${transactions.length})`}
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
        ) : transactions.length === 0 ? (
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm [table-layout:fixed]">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="w-[90px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="w-[170px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="w-[140px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="w-[110px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recurrence</th>
                  <th className="w-[130px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project / Invoice</th>
                  <th className="hidden xl:table-cell w-[80px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="hidden xl:table-cell w-[70px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</th>
                  <th className="w-[96px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Amount</th>
                  <th className="w-[56px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    projects={projects}
                    invoices={invoices}
                    onCategoryChange={handleCategoryChange}
                    onLinkedEntityChange={handleLinkedEntityChange}
                    onRecurrenceChange={handleRecurrenceChange}
                    onMarkReviewed={handleMarkReviewed}
                    onDelete={(t) => setDeleteTarget(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete transaction?</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  <strong>{deleteTarget.description}</strong> — {fmt(deleteTarget.amount)} on {fmtDate(deleteTarget.date)}
                  {deleteTarget.source === 'gmail' && (
                    <><br /><span className="text-amber-700">This was imported from Gmail. Deleting it will not affect your Gmail connection.</span></>
                  )}
                  <br />
                  This will remove it from all calculations. This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  invoices,
  onCategoryChange,
  onLinkedEntityChange,
  onRecurrenceChange,
  onMarkReviewed,
  onDelete,
}: {
  txn: Transaction
  projects: Project[]
  invoices: Invoice[]
  onCategoryChange: (id: string, category: string) => Promise<void>
  onLinkedEntityChange: (id: string, projectId: string | null, invoiceId: string | null) => Promise<void>
  onRecurrenceChange: (id: string, recurrence: string | null) => Promise<void>
  onMarkReviewed: (id: string) => Promise<void>
  onDelete: (txn: Transaction) => void
}) {
  const [saving, setSaving] = useState(false)
  const categories = txn.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const activeProjects = projects.filter((p) => p.status === 'active')
  // For income: show open invoices + any already-linked invoice (even if paid)
  const openInvoices = invoices.filter(
    (inv) =>
      inv.status === 'sent' ||
      inv.status === 'overdue' ||
      inv.id === txn.invoice_id
  )

  const needsReview = !txn.is_reviewed || txn.category_confidence === 'low'
  const isPotentialDuplicate = txn.tags?.includes('potential_duplicate')

  // Derive the combined dropdown value from the transaction state
  const linkedValue = txn.project_id
    ? `project:${txn.project_id}`
    : txn.invoice_id
    ? `invoice:${txn.invoice_id}`
    : ''

  async function handleCategory(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    await onCategoryChange(txn.id, e.target.value)
    setSaving(false)
  }

  async function handleLinkedEntity(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    const value = e.target.value
    const projectId = value.startsWith('project:') ? value.slice(8) : null
    const invoiceId = value.startsWith('invoice:') ? value.slice(8) : null
    await onLinkedEntityChange(txn.id, projectId, invoiceId)
    setSaving(false)
  }

  async function handleRecurrence(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    await onRecurrenceChange(txn.id, e.target.value || null)
    setSaving(false)
  }

  async function handleMarkReviewed() {
    setSaving(true)
    await onMarkReviewed(txn.id)
    setSaving(false)
  }

  // Show the dropdown if: there are projects to pick from, there are open
  // invoices for income rows, OR the row already has something linked (so the
  // user can always select "—" to clear the link).
  const hasLinkedOptions =
    !!linkedValue ||
    activeProjects.length > 0 ||
    (txn.type === 'income' && openInvoices.length > 0)

  return (
    <tr className={cn(
      'hover:bg-gray-50 transition-colors',
      needsReview && 'bg-amber-50/40',
      isPotentialDuplicate && 'bg-orange-50/40'
    )}>
      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(txn.date)}</td>
      <td className="px-4 py-3 max-w-0">
        <div className="relative group/desc">
          <p className="font-medium text-gray-900 truncate">{txn.description}</p>
          {txn.description && (
            <div className="pointer-events-none absolute z-50 left-0 top-full mt-1 hidden group-hover/desc:block bg-gray-900 text-white text-xs rounded px-2 py-1.5 whitespace-normal max-w-xs shadow-lg">
              {txn.description}
            </div>
          )}
        </div>
        {txn.vendor && <p className="text-xs text-gray-500 truncate">{txn.vendor}</p>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {needsReview && (
            <TriangleAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Category unverified — may need correction" />
          )}
          <select
            value={txn.category ?? ''}
            onChange={handleCategory}
            disabled={saving}
            className="h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            {!txn.category && <option value="">Uncategorized</option>}
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={txn.recurrence ?? ''}
          onChange={handleRecurrence}
          disabled={saving}
          className="h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Not set</option>
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        {hasLinkedOptions ? (
          <select
            value={linkedValue}
            onChange={handleLinkedEntity}
            disabled={saving}
            className="h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">—</option>
            {activeProjects.length > 0 && (
              <optgroup label="Projects">
                {activeProjects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>{p.name}</option>
                ))}
              </optgroup>
            )}
            {txn.type === 'income' && openInvoices.length > 0 && (
              <optgroup label="Invoices">
                {openInvoices.map((inv) => (
                  <option key={inv.id} value={`invoice:${inv.id}`}>
                    {inv.invoice_number}{inv.customer_name ? ` — ${inv.customer_name}` : ''} ({fmt(inv.amount)})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        ) : linkedValue ? (
          <span className="text-xs text-gray-600">
            {linkedValue.startsWith('project:')
              ? projects.find((p) => p.id === txn.project_id)?.name ?? '—'
              : invoices.find((inv) => inv.id === txn.invoice_id)?.invoice_number ?? '—'}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="hidden xl:table-cell px-4 py-3">
        <Badge variant="secondary" className="text-xs capitalize">
          {txn.source}
        </Badge>
      </td>
      <td className="hidden xl:table-cell px-4 py-3">
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
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {/* Duplicate indicator */}
          {isPotentialDuplicate && (
            <Copy
              className="h-3.5 w-3.5 text-orange-500 shrink-0"
              aria-label="Potential duplicate — may exist in another integration"
            />
          )}
          {/* Mark reviewed — shown when row needs review */}
          {needsReview && (
            <button
              onClick={handleMarkReviewed}
              disabled={saving}
              title="Mark as reviewed"
              className="rounded p-1 text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* Delete — shown only for deletable sources */}
          {DELETABLE_SOURCES.has(txn.source) && (
            <button
              onClick={() => onDelete(txn)}
              title="Delete transaction"
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
