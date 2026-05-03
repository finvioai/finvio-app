'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Receipt, FileText, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PendingAction, CreateExpenseParams, CreateInvoiceParams, AddIncomeParams } from '@/types'

interface ConfirmationCardProps {
  action: PendingAction
  sessionId: string
  onConfirmed: () => void
  onCancelled: () => void
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function ActionDetails({ action }: { action: PendingAction }) {
  if (action.type === 'create_expense') {
    const p = action.params as CreateExpenseParams
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-orange-600">
          <Receipt className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wide">New Expense</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mt-3">
          <span className="text-gray-500">Description</span><span className="font-medium text-gray-900">{p.title}</span>
          <span className="text-gray-500">Amount</span><span className="font-semibold text-red-600">{formatCurrency(p.amount)}</span>
          <span className="text-gray-500">Category</span><span className="font-medium text-gray-900">{p.category}</span>
          <span className="text-gray-500">Date</span><span className="font-medium text-gray-900">{p.date}</span>
          {p.notes && <><span className="text-gray-500">Notes</span><span className="text-gray-900">{p.notes}</span></>}
        </div>
      </div>
    )
  }

  if (action.type === 'create_invoice') {
    const p = action.params as CreateInvoiceParams
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-blue-600">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wide">New Invoice</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mt-3">
          <span className="text-gray-500">Customer</span><span className="font-medium text-gray-900">{p.customerName}</span>
          <span className="text-gray-500">Amount</span><span className="font-semibold text-blue-600">{formatCurrency(p.amount)}</span>
          <span className="text-gray-500">Due Date</span><span className="font-medium text-gray-900">{p.dueDate}</span>
          {p.notes && <><span className="text-gray-500">Notes</span><span className="text-gray-900">{p.notes}</span></>}
        </div>
      </div>
    )
  }

  if (action.type === 'add_income') {
    const p = action.params as AddIncomeParams
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wide">New Income</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mt-3">
          <span className="text-gray-500">Description</span><span className="font-medium text-gray-900">{p.description}</span>
          <span className="text-gray-500">Amount</span><span className="font-semibold text-green-600">{formatCurrency(p.amount)}</span>
          <span className="text-gray-500">Category</span><span className="font-medium text-gray-900">{p.category}</span>
          <span className="text-gray-500">Date</span><span className="font-medium text-gray-900">{p.date}</span>
          {p.source && <><span className="text-gray-500">Source</span><span className="text-gray-900">{p.source}</span></>}
        </div>
      </div>
    )
  }

  return null
}

export function ConfirmationCard({ action, sessionId, onConfirmed, onCancelled }: ConfirmationCardProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleConfirm() {
    setStatus('loading')
    try {
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sessionId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Something went wrong.')
        setStatus('error')
        return
      }
      setStatus('success')
      setTimeout(onConfirmed, 800)
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
        <p className="text-sm font-medium text-green-800">Saved successfully!</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4 max-w-sm">
      <ActionDetails action={action} />

      {status === 'error' && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{errorMsg}</p>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1"
          onClick={handleConfirm}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
          ) : (
            <><CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Confirm</>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={onCancelled}
          disabled={status === 'loading'}
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
        </Button>
      </div>
    </div>
  )
}
