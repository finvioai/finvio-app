'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText, Loader2, CheckCircle2, Clock, Ban, AlertTriangle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import type { Invoice } from '@/types'
import { cn } from '@/lib/utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', className: 'bg-off-white text-navy/80', icon: <FileText className="h-3 w-3" /> },
  sent: { label: 'Sent', className: 'bg-brand-tint text-brand', icon: <Send className="h-3 w-3" /> },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', className: 'bg-off-white text-muted-ink', icon: <Ban className="h-3 w-3" /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as InvoiceStatus] ?? STATUS_CONFIG.draft
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]

const today = new Date().toISOString().split('T')[0]

// ─── New Invoice Sheet ─────────────────────────────────────────────────────────

interface NewInvoiceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function NewInvoiceSheet({ open, onOpenChange, onSuccess }: NewInvoiceSheetProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    amount: '',
    invoice_date: today,
    due_date: '',
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

    setLoading(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.customer_name,
          customer_email: form.customer_email || undefined,
          amount,
          invoice_date: form.invoice_date || undefined,
          due_date: form.due_date || undefined,
          notes: form.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create invoice')
        return
      }
      setForm({ customer_name: '', customer_email: '', amount: '', invoice_date: today, due_date: '', notes: '' })
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
          <SheetTitle>New Invoice</SheetTitle>
          <SheetDescription>Create a new invoice for a customer or client.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-customer">Customer Name *</Label>
            <Input id="inv-customer" value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="Acme Corp" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Customer Email</Label>
            <Input id="inv-email" type="email" value={form.customer_email} onChange={(e) => set('customer_email', e.target.value)} placeholder="billing@acme.com" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-amount">Amount (USD) *</Label>
            <Input id="inv-amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-date">Invoice Date</Label>
              <Input id="inv-date" type="date" value={form.invoice_date} onChange={(e) => set('invoice_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-due">Due Date</Label>
              <Input id="inv-due" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea id="inv-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Payment terms, project details…" rows={3} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <SheetFooter className="pt-2 flex gap-2">
            <SheetClose render={<Button variant="outline" type="button" className="flex-1" />}>Cancel</SheetClose>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invoice
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Invoice Row ──────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, onStatusChange }: { invoice: Invoice; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false)

  async function handleMarkPaid() {
    setLoading(true)
    await onStatusChange(invoice.id, 'paid')
    setLoading(false)
  }

  async function handleMarkSent() {
    setLoading(true)
    await onStatusChange(invoice.id, 'sent')
    setLoading(false)
  }

  const canMarkSent = invoice.status === 'draft'
  const canMarkPaid = invoice.status === 'sent' || invoice.status === 'overdue'

  return (
    <tr className="border-b border-hairline/70 hover:bg-off-white transition-colors">
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-medium text-navy">{invoice.invoice_number}</span>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-navy">{invoice.customer_name ?? '—'}</p>
          {invoice.customer_email && <p className="text-xs text-muted-ink">{invoice.customer_email}</p>}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-navy tabular-nums">{fmt(invoice.amount)}</td>
      <td className="px-4 py-3 text-sm text-muted-ink">{fmtDate(invoice.invoice_date)}</td>
      <td className="px-4 py-3 text-sm text-muted-ink">{fmtDate(invoice.due_date)}</td>
      <td className="px-4 py-3">
        <StatusBadge status={invoice.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {canMarkSent && (
            <Button size="sm" variant="outline" onClick={handleMarkSent} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mark Sent'}
            </Button>
          )}
          {canMarkPaid && (
            <Button size="sm" onClick={handleMarkPaid} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mark Paid'}
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showNew, setShowNew] = useState(false)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/invoices?${params}`)
    if (res.ok) {
      const json = await res.json()
      setInvoices(json.invoices ?? [])
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch('/api/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      const { invoice } = await res.json()
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? invoice : inv)))
    }
  }

  // KPIs
  const totalOutstanding = invoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.amount, 0)
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Invoices</h1>
          <p className="text-sm text-muted-ink mt-0.5">Create, send, and track invoices</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Invoice
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-hairline bg-white p-5">
          <p className="text-xs font-medium text-muted-ink uppercase tracking-wide">Outstanding</p>
          <p className="mt-1.5 text-2xl font-bold text-navy">{fmt(totalOutstanding)}</p>
          <p className="text-xs text-muted-ink/60 mt-0.5">sent + overdue</p>
        </div>
        <div className="rounded-xl border border-hairline bg-white p-5">
          <p className="text-xs font-medium text-muted-ink uppercase tracking-wide">Collected</p>
          <p className="mt-1.5 text-2xl font-bold text-green-600">{fmt(totalPaid)}</p>
          <p className="text-xs text-muted-ink/60 mt-0.5">paid invoices</p>
        </div>
        <div className="rounded-xl border border-hairline bg-white p-5">
          <p className="text-xs font-medium text-muted-ink uppercase tracking-wide">Overdue</p>
          <p className={cn('mt-1.5 text-2xl font-bold', overdueCount > 0 ? 'text-red-600' : 'text-navy')}>
            {overdueCount}
          </p>
          <p className="text-xs text-muted-ink/60 mt-0.5">past due date</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-hairline">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              statusFilter === tab.value
                ? 'border-brand text-brand'
                : 'border-transparent text-muted-ink hover:text-navy/80'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-hairline bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-ink/60" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="h-10 w-10 text-muted-ink/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-navy">No invoices yet</p>
            <p className="text-xs text-muted-ink mt-1 mb-4">Create your first invoice to start tracking payments</p>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Invoice
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-hairline bg-off-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-ink uppercase tracking-wide">Invoice #</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-ink uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-ink uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-ink uppercase tracking-wide">Issued</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-ink uppercase tracking-wide">Due</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-ink uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-ink uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} onStatusChange={handleStatusChange} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewInvoiceSheet open={showNew} onOpenChange={setShowNew} onSuccess={fetchInvoices} />
    </div>
  )
}
