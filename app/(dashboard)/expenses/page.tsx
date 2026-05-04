'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Receipt, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import { EXPENSE_CATEGORIES, RECURRENCE_OPTIONS } from '@/types'
import type { ExpenseReport, RecurrenceType } from '@/types'
import { cn } from '@/lib/utils'

interface ExpenseTxn {
  id: string
  description: string
  amount: number
  category: string | null
  date: string
  source: string
  recurrence?: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type ExpenseStatus = 'pending' | 'approved' | 'rejected'

const STATUS_CONFIG: Record<ExpenseStatus, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as ExpenseStatus] ?? STATUS_CONFIG.pending
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const today = new Date().toISOString().split('T')[0]

// ─── Submit Expense Sheet ─────────────────────────────────────────────────────

interface SubmitExpenseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function SubmitExpenseSheet({ open, onOpenChange, onSuccess }: SubmitExpenseSheetProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: '',
    recurrence: '' as RecurrenceType | '',
    date: today,
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) { setError('Amount must be a positive number'); return }
    if (!form.category) { setError('Please select a category'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          amount,
          category: form.category,
          recurrence: form.recurrence || undefined,
          date: form.date,
          notes: form.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to submit expense')
        return
      }
      setForm({ title: '', amount: '', category: '', recurrence: '', date: today, notes: '' })
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Submit Expense</SheetTitle>
          <SheetDescription>Submit an expense report for approval.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="exp-title">Title *</Label>
            <Input id="exp-title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Team lunch, Software subscription…" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">Amount (USD) *</Label>
            <Input id="exp-amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-category">Category *</Label>
            <select
              id="exp-category"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select category</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-recurrence">Recurrence</Label>
            <select
              id="exp-recurrence"
              value={form.recurrence}
              onChange={(e) => set('recurrence', e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not specified</option>
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400">Helps calculate accurate monthly burn rate.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-date">Date *</Label>
            <Input id="exp-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-notes">Notes</Label>
            <Textarea id="exp-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Purpose, attendees, project…" rows={3} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <SheetFooter className="pt-2 flex gap-2">
            <SheetClose render={<Button variant="outline" type="button" className="flex-1" />}>Cancel</SheetClose>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Expense
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Expense Row ──────────────────────────────────────────────────────────────

function ExpenseRow({ expense, onAction }: { expense: ExpenseReport; onAction: (id: string, action: 'approve' | 'reject') => Promise<void> }) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  async function handle(action: 'approve' | 'reject') {
    setLoading(action)
    await onAction(expense.id, action)
    setLoading(null)
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{expense.title}</p>
          {expense.submitter_name && <p className="text-xs text-gray-500">{expense.submitter_name}</p>}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{expense.category}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900 tabular-nums">{fmt(expense.amount)}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(expense.date)}</td>
      <td className="px-4 py-3">
        <StatusBadge status={expense.status ?? 'pending'} />
      </td>
      <td className="px-4 py-3">
        {expense.status === 'pending' && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handle('approve')}
              disabled={loading !== null}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading === 'approve' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handle('reject')}
              disabled={loading !== null}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {loading === 'reject' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reject'}
            </Button>
          </div>
        )}
        {expense.status === 'approved' && (
          <span className="text-xs text-gray-400">{fmtDate(expense.reviewed_at)}</span>
        )}
        {expense.status === 'rejected' && (
          <span className="text-xs text-gray-400">{fmtDate(expense.reviewed_at)}</span>
        )}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', ai: 'AI Chat', csv: 'CSV', stripe: 'Stripe',
  plaid: 'Plaid', paypal: 'PayPal', shopify: 'Shopify', invoice: 'Invoice',
}
const SOURCE_COLORS: Record<string, string> = {
  manual: 'bg-gray-100 text-gray-700', ai: 'bg-blue-100 text-blue-700',
  csv: 'bg-orange-100 text-orange-700', stripe: 'bg-purple-100 text-purple-700',
  plaid: 'bg-indigo-100 text-indigo-700', paypal: 'bg-sky-100 text-sky-700',
  shopify: 'bg-green-100 text-green-700', invoice: 'bg-teal-100 text-teal-700',
}

export default function ExpensesPage() {
  const [mainTab, setMainTab] = useState<'reports' | 'transactions'>('transactions')

  // ── Expense Reports state ────────────────────────────────────────────────
  const [expenses, setExpenses] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showSubmit, setShowSubmit] = useState(false)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/expenses?${params}`)
    if (res.ok) {
      const json = await res.json()
      setExpenses(json.expenses ?? [])
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { if (mainTab === 'reports') fetchExpenses() }, [fetchExpenses, mainTab])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    const res = await fetch('/api/expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (res.ok) {
      const { expense } = await res.json()
      setExpenses((prev) => prev.map((e) => (e.id === id ? expense : e)))
    }
  }

  // ── Expense Transactions state ───────────────────────────────────────────
  const [txns, setTxns] = useState<ExpenseTxn[]>([])
  const [txnsLoading, setTxnsLoading] = useState(false)

  const fetchTxns = useCallback(async () => {
    setTxnsLoading(true)
    const res = await fetch('/api/transactions?type=expense&limit=200')
    if (res.ok) {
      const json = await res.json()
      setTxns(json.transactions ?? [])
    }
    setTxnsLoading(false)
  }, [])

  useEffect(() => { if (mainTab === 'transactions') fetchTxns() }, [fetchTxns, mainTab])

  async function handleRecurrenceChange(id: string, recurrence: string | null) {
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, recurrence: recurrence || null }),
    })
    if (res.ok) {
      const { transaction } = await res.json()
      setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, recurrence: transaction.recurrence } : t)))
    }
  }

  // KPIs
  const totalPending = expenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0)
  const totalApproved = expenses.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0)
  const pendingCount = expenses.filter((e) => e.status === 'pending').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Expense reports and direct expense transactions</p>
        </div>
        <Button onClick={() => setShowSubmit(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Submit Expense
        </Button>
      </div>

      {/* Main tab switcher */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setMainTab('transactions')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            mainTab === 'transactions' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          All Expenses
        </button>
        <button
          onClick={() => setMainTab('reports')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            mainTab === 'reports' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Expense Reports
        </button>
      </div>

      {mainTab === 'transactions' ? (
        /* ── Expense Transactions view ──────────────────────────────────── */
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {txnsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : txns.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">No expense transactions yet</p>
              <p className="text-xs text-gray-500 mt-1">Expenses added via AI chat, manual entry, or CSV import appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recurrence</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{t.category ?? '—'}</td>
                      <td className="px-4 py-2">
                        <select
                          value={t.recurrence ?? ''}
                          onChange={(e) => handleRecurrenceChange(t.id, e.target.value || null)}
                          className="text-xs border border-gray-200 rounded px-2 h-7 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Not tagged</option>
                          {RECURRENCE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-red-600 tabular-nums">{fmt(t.amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(t.date)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', SOURCE_COLORS[t.source] ?? 'bg-gray-100 text-gray-700')}>
                          {SOURCE_LABELS[t.source] ?? t.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ── Expense Reports view ───────────────────────────────────────── */
        <>
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Review</p>
          <p className={cn('mt-1.5 text-2xl font-bold', pendingCount > 0 ? 'text-yellow-600' : 'text-gray-900')}>
            {pendingCount}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{fmt(totalPending)} awaiting approval</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Approved</p>
          <p className="mt-1.5 text-2xl font-bold text-green-600">{fmt(totalApproved)}</p>
          <p className="text-xs text-gray-400 mt-0.5">expense transactions created</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Reports</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{expenses.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">all time</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              statusFilter === tab.value
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No expense reports yet</p>
            <p className="text-xs text-gray-500 mt-1 mb-4">Submit an expense to start tracking reimbursements</p>
            <Button onClick={() => setShowSubmit(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Submit Expense
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <ExpenseRow key={exp.id} expense={exp} onAction={handleAction} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        </>
      )}

      <SubmitExpenseSheet open={showSubmit} onOpenChange={setShowSubmit} onSuccess={fetchExpenses} />
    </div>
  )
}
