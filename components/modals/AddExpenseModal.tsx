'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Paperclip } from 'lucide-react'
import { EXPENSE_CATEGORIES, RECURRENCE_OPTIONS } from '@/types'

interface AddExpenseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const today = new Date().toISOString().split('T')[0]

export function AddExpenseModal({ open, onOpenChange, onSuccess }: AddExpenseModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: '',
    recurrence: '',
    date: today,
    vendor: '',
    notes: '',
  })

  function reset() {
    setForm({ description: '', amount: '', category: '', recurrence: '', date: today, vendor: '', notes: '' })
    setReceiptFile(null)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amount = parseFloat(form.amount)
    if (!form.description.trim()) return setError('Description is required.')
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid amount greater than 0.')
    if (!form.date) return setError('Date is required.')

    setLoading(true)
    try {
      let receipt_url: string | undefined
      if (receiptFile) {
        const fd = new FormData()
        fd.append('file', receiptFile)
        const uploadRes = await fetch('/api/receipts', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const data = await uploadRes.json()
          setError(data.error ?? 'Receipt upload failed.')
          return
        }
        receipt_url = (await uploadRes.json()).receipt_url
      }

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          description: form.description.trim(),
          amount,
          category: form.category || undefined,
          recurrence: form.recurrence || undefined,
          date: form.date,
          vendor: form.vendor.trim() || undefined,
          notes: form.notes.trim() || undefined,
          receipt_url,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save expense.')
        return
      }

      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) reset(); onOpenChange(isOpen) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>Record a manual expense transaction.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 pb-2">
          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">Description *</Label>
            <Input
              id="exp-desc"
              placeholder="e.g. AWS hosting, Vercel Pro"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">Amount (USD) *</Label>
            <Input
              id="exp-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="exp-category">Category</Label>
              <select
                id="exp-category"
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Auto-detect</option>
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
                onChange={(e) => handleChange('recurrence', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Not specified</option>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="exp-date">Date *</Label>
              <Input
                id="exp-date"
                type="date"
                value={form.date}
                max={today}
                onChange={(e) => handleChange('date', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-vendor">Vendor</Label>
              <Input
                id="exp-vendor"
                placeholder="e.g. Amazon Web Services"
                value={form.vendor}
                onChange={(e) => handleChange('vendor', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-notes">Notes</Label>
            <Textarea
              id="exp-notes"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Receipt / Bill</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                if (f && f.size > 10 * 1024 * 1024) { setError('File must be under 10 MB.'); return }
                setReceiptFile(f)
                setError('')
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-md border border-dashed border-hairline px-3 py-2 text-sm text-muted-ink hover:border-gray-400 hover:text-navy/80 transition-colors w-full"
              >
                <Paperclip className="h-4 w-4 shrink-0" />
                {receiptFile ? (
                  <span className="truncate font-medium text-navy/80">{receiptFile.name}</span>
                ) : (
                  <span>Attach receipt or bill (optional)</span>
                )}
              </button>
              {receiptFile && (
                <button
                  type="button"
                  onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="text-xs text-muted-ink/60 hover:text-red-500 transition-colors shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            disabled={loading}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {loading ? 'Saving...' : 'Save Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
