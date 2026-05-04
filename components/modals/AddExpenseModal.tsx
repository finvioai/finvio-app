'use client'

import { useState } from 'react'
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

interface AddExpenseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const today = new Date().toISOString().split('T')[0]

export function AddExpenseModal({ open, onOpenChange, onSuccess }: AddExpenseModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) reset(); onOpenChange(isOpen) }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>Add Expense</SheetTitle>
          <SheetDescription>Record a manual expense transaction.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-4">
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
            {!form.category && (
              <p className="text-xs text-gray-500">Leave blank to auto-categorize.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-recurrence">Recurrence</Label>
            <select
              id="exp-recurrence"
              value={form.recurrence}
              onChange={(e) => handleChange('recurrence', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Not specified (treated as monthly)</option>
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Helps calculate accurate monthly burn rate.</p>
          </div>

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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <SheetFooter className="px-0 pt-2">
            <SheetClose render={<Button variant="outline" type="button" />}>
              Cancel
            </SheetClose>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Expense'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
