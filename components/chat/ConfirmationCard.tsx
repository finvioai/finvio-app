'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, XCircle, Loader2, Receipt, FileText, TrendingUp, FolderOpen, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RECURRENCE_OPTIONS,
} from '@/types'
import type { PendingAction, CreateExpenseParams, CreateInvoiceParams, AddIncomeParams, RecurrenceType, Project } from '@/types'

interface ConfirmationCardProps {
  action: PendingAction
  sessionId: string
  onConfirmed: () => void
  onCancelled: () => void
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const selectCls =
  'h-7 flex-1 rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500'

function ProjectPicker({
  selectedId,
  onChange,
}: {
  selectedId: string
  onChange: (id: string, name: string) => void
}) {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {})
  }, [])

  if (projects.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <FolderOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      <select
        value={selectedId}
        onChange={(e) => {
          const proj = projects.find((p) => p.id === e.target.value)
          onChange(e.target.value, proj?.name ?? '')
        }}
        className={selectCls}
      >
        <option value="">Link to project (optional)</option>
        {projects
          .filter((p) => p.status === 'active')
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.client ? ` — ${p.client}` : ''}
            </option>
          ))}
      </select>
    </div>
  )
}

function ActionDetails({
  action,
  category,
  onCategoryChange,
  recurrence,
  onRecurrenceChange,
  projectId,
  projectName,
  onProjectChange,
}: {
  action: PendingAction
  category: string
  onCategoryChange: (v: string) => void
  recurrence: string
  onRecurrenceChange: (v: string) => void
  projectId: string
  projectName: string
  onProjectChange: (id: string, name: string) => void
}) {
  if (action.type === 'create_expense') {
    const p = action.params as CreateExpenseParams
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-orange-600">
          <Receipt className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wide">New Expense</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3 items-center">
          <span className="text-gray-500">Description</span><span className="font-medium text-gray-900">{p.title}</span>
          <span className="text-gray-500">Amount</span><span className="font-semibold text-red-600">{formatCurrency(p.amount)}</span>
          <span className="text-gray-500">Category</span>
          <select value={category} onChange={(e) => onCategoryChange(e.target.value)} className={selectCls}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <span className="text-gray-500">Recurrence</span>
          <select value={recurrence} onChange={(e) => onRecurrenceChange(e.target.value)} className={selectCls}>
            <option value="">Not specified</option>
            {RECURRENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3 items-center">
          <span className="text-gray-500">Description</span><span className="font-medium text-gray-900">{p.description}</span>
          <span className="text-gray-500">Amount</span><span className="font-semibold text-green-600">{formatCurrency(p.amount)}</span>
          <span className="text-gray-500">Category</span>
          <select value={category} onChange={(e) => onCategoryChange(e.target.value)} className={selectCls}>
            {INCOME_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <span className="text-gray-500">Recurrence</span>
          <select value={recurrence} onChange={(e) => onRecurrenceChange(e.target.value)} className={selectCls}>
            <option value="">Not specified</option>
            {RECURRENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-gray-500">Date</span><span className="font-medium text-gray-900">{p.date}</span>
          {p.source && <><span className="text-gray-500">Source</span><span className="text-gray-900">{p.source}</span></>}
          {projectName && <><span className="text-gray-500">Project</span><span className="font-medium text-gray-900">{projectName}</span></>}
        </div>
        <div className="pt-1">
          <ProjectPicker selectedId={projectId} onChange={onProjectChange} />
        </div>
      </div>
    )
  }

  return null
}

export function ConfirmationCard({ action, sessionId, onConfirmed, onCancelled }: ConfirmationCardProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<string>(() => {
    const p = action.params as CreateExpenseParams | AddIncomeParams
    return p.category ?? ''
  })
  const [recurrence, setRecurrence] = useState<string>(() => {
    if (action.type === 'create_expense') {
      return (action.params as CreateExpenseParams).recurrence ?? ''
    }
    if (action.type === 'add_income') {
      return (action.params as AddIncomeParams).recurrence ?? ''
    }
    return ''
  })

  function handleProjectChange(id: string, name: string) {
    setProjectId(id)
    setProjectName(name)
  }

  async function handleConfirm() {
    setStatus('loading')
    setErrorMsg('')

    let receiptUrl: string | undefined

    if (action.type === 'create_expense' && receiptFile) {
      const fd = new FormData()
      fd.append('file', receiptFile)
      try {
        const uploadRes = await fetch('/api/receipts', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const data = await uploadRes.json()
          setErrorMsg(data.error ?? 'Receipt upload failed.')
          setStatus('error')
          return
        }
        const uploadData = await uploadRes.json()
        receiptUrl = uploadData.receipt_url
      } catch {
        setErrorMsg('Network error uploading receipt.')
        setStatus('error')
        return
      }
    }

    const finalAction: PendingAction = {
      ...action,
      params: {
        ...action.params,
        ...(category ? { category } : {}),
        ...((action.type === 'create_expense' || action.type === 'add_income') && recurrence
          ? { recurrence: recurrence as RecurrenceType }
          : {}),
        ...(action.type === 'add_income' && projectId
          ? { project_id: projectId, project_name: projectName }
          : {}),
        ...(receiptUrl ? { receipt_url: receiptUrl } : {}),
      },
    }

    try {
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: finalAction, sessionId }),
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
      <ActionDetails
        action={action}
        category={category}
        onCategoryChange={setCategory}
        recurrence={recurrence}
        onRecurrenceChange={setRecurrence}
        projectId={projectId}
        projectName={projectName}
        onProjectChange={handleProjectChange}
      />

      {action.type === 'create_expense' && (
        <div className="border-t border-gray-100 pt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              if (f && f.size > 10 * 1024 * 1024) {
                setErrorMsg('File must be under 10 MB.')
                setStatus('error')
                return
              }
              setReceiptFile(f)
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === 'loading'}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              {receiptFile ? (
                <span className="truncate max-w-[180px] text-gray-700 font-medium">{receiptFile.name}</span>
              ) : (
                <span>Attach receipt (optional)</span>
              )}
            </button>
            {receiptFile && (
              <button
                type="button"
                onClick={() => {
                  setReceiptFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

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
