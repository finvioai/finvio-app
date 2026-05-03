'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, ChevronRight, CheckCircle2, AlertCircle, Loader2, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ParsedHeaders { headers: string[] }

interface ColumnMapping {
  date: string
  amount?: string
  description: string
  type?: string
  category?: string
  debit?: string
  credit?: string
  positiveIs?: 'income' | 'expense'
  useDebitCredit?: boolean
}

interface ImportResult {
  imported: number
  skipped: number
  errors: number
  total: number
  errorDetails: Array<{ rowIndex: number; reason: string }>
}

type Step = 'upload' | 'map' | 'importing' | 'done'

const REQUIRED_FIELDS = ['date', 'description'] as const
const IMPORT_TYPES = [
  { value: 'income', label: 'Positive amounts = Income' },
  { value: 'expense', label: 'Positive amounts = Expense (bank statement)' },
]

// ─── Step 1: Upload ────────────────────────────────────────────────────────────

function UploadStep({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelected(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 cursor-pointer transition-colors',
        dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
      )}
    >
      <Upload className={cn('h-10 w-10 mb-4', dragging ? 'text-blue-500' : 'text-gray-400')} />
      <p className="text-sm font-medium text-gray-900">Drop your CSV or XLSX file here</p>
      <p className="text-xs text-gray-500 mt-1">or click to browse</p>
      <p className="text-xs text-gray-400 mt-3">Supports bank statements, revenue exports, expense exports</p>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleChange} />
    </div>
  )
}

// ─── Step 2: Column Mapping ────────────────────────────────────────────────────

function MappingStep({
  file,
  headers,
  onMapping,
  onBack,
}: {
  file: File
  headers: string[]
  onMapping: (mapping: ColumnMapping) => void
  onBack: () => void
}) {
  const [useDebitCredit, setUseDebitCredit] = useState(false)
  const [mapping, setMapping] = useState<Record<string, string>>({
    date: '',
    description: '',
    amount: '',
    debit: '',
    credit: '',
    positiveIs: 'income',
  })
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setMapping((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!mapping.date) { setError('Date column is required'); return }
    if (!mapping.description) { setError('Description column is required'); return }
    if (useDebitCredit) {
      if (!mapping.debit || !mapping.credit) { setError('Both debit and credit columns are required'); return }
    } else {
      if (!mapping.amount) { setError('Amount column is required'); return }
    }

    const result: ColumnMapping = {
      date: mapping.date,
      description: mapping.description,
      positiveIs: mapping.positiveIs as 'income' | 'expense',
    }
    if (useDebitCredit) {
      result.debit = mapping.debit
      result.credit = mapping.credit
    } else {
      result.amount = mapping.amount
    }
    onMapping(result)
  }

  const headerOptions = ['', ...headers]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-3">
        <FileText className="h-5 w-5 text-gray-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">{file.name}</p>
          <p className="text-xs text-gray-500">{headers.length} columns detected</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Date column *</Label>
          <select value={mapping.date} onChange={(e) => set('date', e.target.value)} required
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {headerOptions.map((h) => <option key={h} value={h}>{h || '— select —'}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Description column *</Label>
          <select value={mapping.description} onChange={(e) => set('description', e.target.value)} required
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {headerOptions.map((h) => <option key={h} value={h}>{h || '— select —'}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" checked={useDebitCredit} onChange={(e) => setUseDebitCredit(e.target.checked)}
              className="rounded border-gray-300" />
            File has separate Debit / Credit columns (bank statement format)
          </label>
        </div>

        {useDebitCredit ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Debit column (expenses)</Label>
              <select value={mapping.debit} onChange={(e) => set('debit', e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {headerOptions.map((h) => <option key={h} value={h}>{h || '— select —'}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Credit column (income)</Label>
              <select value={mapping.credit} onChange={(e) => set('credit', e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {headerOptions.map((h) => <option key={h} value={h}>{h || '— select —'}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount column *</Label>
              <select value={mapping.amount} onChange={(e) => set('amount', e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {headerOptions.map((h) => <option key={h} value={h}>{h || '— select —'}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Positive amounts are…</Label>
              <select value={mapping.positiveIs} onChange={(e) => set('positiveIs', e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {IMPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit">
          Import <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </form>
  )
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function DoneStep({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div className="text-center py-8 space-y-4">
      <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
      <div>
        <p className="text-xl font-bold text-gray-900">{result.imported} transactions imported</p>
        <p className="text-sm text-gray-500 mt-1">
          {result.skipped} duplicates skipped · {result.errors} rows with errors
        </p>
      </div>

      {result.errorDetails.length > 0 && (
        <div className="text-left rounded-lg border border-red-200 bg-red-50 p-4 max-h-48 overflow-y-auto">
          <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> Parse errors
          </p>
          {result.errorDetails.map((e) => (
            <p key={e.rowIndex} className="text-xs text-red-600">Row {e.rowIndex}: {e.reason}</p>
          ))}
        </div>
      )}

      <div className="flex gap-3 justify-center pt-2">
        <Button onClick={onReset} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" /> Import another file
        </Button>
        <Button onClick={() => window.location.href = '/dashboard/transactions'}>
          View transactions
        </Button>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'upload', label: 'Upload file' },
  { id: 'map', label: 'Map columns' },
  { id: 'importing', label: 'Import' },
  { id: 'done', label: 'Done' },
]

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')

  async function handleFileSelected(f: File) {
    setFile(f)
    setImportError('')

    // Parse headers by uploading just for column detection
    const formData = new FormData()
    formData.append('file', f)
    formData.append('mapping', JSON.stringify({ date: '', description: '', amount: '' }))

    // Instead of running the full import, just parse the file client-side for headers
    // We POST with a dummy mapping to get headers back (API returns headers even on validation error)
    // Actually, let's parse headers by reading a small chunk of the file in the browser
    const text = await f.text()
    const firstLine = text.split('\n')[0].replace(/^﻿/, '') // strip BOM
    const cols = firstLine.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''))
    setHeaders(cols.length > 1 ? cols : [firstLine])
    setStep('map')
  }

  async function handleMapping(mapping: ColumnMapping) {
    if (!file) return
    setStep('importing')
    setImportError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('mapping', JSON.stringify(mapping))

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setImportError(typeof json.error === 'string' ? json.error : 'Import failed')
        setStep('map')
        return
      }
      setResult(json as ImportResult)
      setStep('done')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
      setStep('map')
    }
  }

  function reset() {
    setStep('upload')
    setFile(null)
    setHeaders([])
    setResult(null)
    setImportError('')
  }

  const activeStepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload a CSV or XLSX file to import transactions</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
              i < activeStepIndex ? 'bg-blue-600 text-white' :
              i === activeStepIndex ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600' :
              'bg-gray-100 text-gray-400'
            )}>
              {i < activeStepIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn('text-sm hidden sm:block', i === activeStepIndex ? 'font-medium text-gray-900' : 'text-gray-400')}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {step === 'upload' && <UploadStep onFileSelected={handleFileSelected} />}

        {step === 'map' && file && (
          <>
            {importError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{importError}</p>
                <button onClick={() => setImportError('')}><X className="h-4 w-4 text-red-400" /></button>
              </div>
            )}
            <MappingStep
              file={file}
              headers={headers}
              onMapping={handleMapping}
              onBack={reset}
            />
          </>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-gray-900">Importing transactions…</p>
            <p className="text-xs text-gray-500">This may take a moment for large files</p>
          </div>
        )}

        {step === 'done' && result && <DoneStep result={result} onReset={reset} />}
      </div>
    </div>
  )
}
