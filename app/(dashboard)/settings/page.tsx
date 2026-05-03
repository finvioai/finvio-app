'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Organization, UserSettings } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'INR', 'JPY']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const LLM_OPTIONS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  openai: {
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingOrg, setSavingOrg] = useState(false)
  const [savingAI, setSavingAI] = useState(false)
  const [savedOrg, setSavedOrg] = useState(false)
  const [savedAI, setSavedAI] = useState(false)

  // Form state
  const [orgName, setOrgName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [fiscalStart, setFiscalStart] = useState(1)
  const [provider, setProvider] = useState('openai')
  const [model, setModel] = useState('gpt-4o-mini')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: { org: Organization; userSettings: UserSettings; role: string }) => {
        setOrg(d.org)
        setUserSettings(d.userSettings)
        setRole(d.role)
        setOrgName(d.org?.name ?? '')
        setCurrency(d.org?.currency ?? 'USD')
        setFiscalStart(d.org?.fiscal_year_start ?? 1)
        setProvider(d.userSettings?.llm_provider ?? 'openai')
        setModel(d.userSettings?.llm_model ?? 'gpt-4o-mini')
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault()
    setSavingOrg(true)
    setSavedOrg(false)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org: { name: orgName, currency, fiscal_year_start: fiscalStart } }),
    })
    setSavingOrg(false)
    setSavedOrg(true)
    setTimeout(() => setSavedOrg(false), 3000)
  }

  async function saveAI(e: React.FormEvent) {
    e.preventDefault()
    setSavingAI(true)
    setSavedAI(false)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userSettings: { llm_provider: provider, llm_model: model } }),
    })
    setSavingAI(false)
    setSavedAI(true)
    setTimeout(() => setSavedAI(false), 3000)
  }

  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const availableModels = LLM_OPTIONS[provider]?.models ?? []

  const selectClass = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Organization, AI model, and preferences</p>
      </div>

      {/* Org Settings */}
      <Section title="Organization">
        <form onSubmit={saveOrg} className="space-y-4">
          <Field label="Name">
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!isOwnerOrAdmin}
              className={inputClass}
            />
          </Field>

          <Field label="Currency">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={!isOwnerOrAdmin}
              className={selectClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Fiscal year starts" hint="Month 1 = January">
            <select
              value={fiscalStart}
              onChange={(e) => setFiscalStart(parseInt(e.target.value))}
              disabled={!isOwnerOrAdmin}
              className={selectClass}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </Field>

          {!isOwnerOrAdmin && (
            <p className="text-xs text-gray-400">Only owners and admins can edit org settings.</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={savingOrg || !isOwnerOrAdmin} size="sm">
              {savingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
            </Button>
            {savedOrg && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </Section>

      {/* AI Model */}
      <Section title="AI Model">
        <p className="text-xs text-gray-500 -mt-1 mb-3">
          API keys are managed by FinPilot. Select the model that best fits your needs.
        </p>
        <form onSubmit={saveAI} className="space-y-4">
          <Field label="Provider">
            <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(LLM_OPTIONS[e.target.value]?.models[0]?.value ?? '') }} className={selectClass}>
              {Object.entries(LLM_OPTIONS).map(([key, opt]) => (
                <option key={key} value={key}>{opt.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Model">
            <select value={model} onChange={(e) => setModel(e.target.value)} className={selectClass}>
              {availableModels.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={savingAI} size="sm">
              {savingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save model'}
            </Button>
            {savedAI && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </Section>

      {/* Account info */}
      <Section title="Account">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Role</span>
            <span className={cn('font-medium capitalize', role === 'owner' ? 'text-blue-600' : 'text-gray-700')}>{role ?? '—'}</span>
          </div>
          {org && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Organization ID</span>
              <span className="font-mono text-xs text-gray-400">{org.id.slice(0, 8)}…</span>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
