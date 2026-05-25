'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, FolderOpen, ChevronDown, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active:    'bg-green-50 text-green-700',
  completed: 'bg-brand-tint text-brand',
  on_hold:   'bg-yellow-50 text-yellow-700',
  cancelled: 'bg-off-white text-muted-ink',
}

interface ProjectRow {
  id: string
  name: string
  client: string | null
  description: string | null
  status: ProjectStatus
  budget: number | null
  currency: string
  start_date: string | null
  end_date: string | null
  collected: number
  expenses: number
  outstanding: number | null
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateProjectForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', client: '', budget: '', start_date: '', end_date: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        form.name,
        client:      form.client || undefined,
        description: form.description || undefined,
        budget:      form.budget ? parseFloat(form.budget) : undefined,
        start_date:  form.start_date || undefined,
        end_date:    form.end_date || undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error?.toString() ?? 'Failed to create project')
    } else {
      onCreated()
    }
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-brand/20 bg-brand-tint/40 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">New Project</h3>
        <button type="button" onClick={onCancel}><X className="h-4 w-4 text-muted-ink/60 hover:text-muted-ink" /></button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-ink">Project name *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-md border border-hairline px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-ink">Client</label>
          <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
            className="mt-1 w-full rounded-md border border-hairline px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-ink">Budget ($)</label>
          <input type="number" min="0" step="0.01" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
            className="mt-1 w-full rounded-md border border-hairline px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-ink">Start date</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            className="mt-1 w-full rounded-md border border-hairline px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-ink">End date</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            className="mt-1 w-full rounded-md border border-hairline px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-ink">Description</label>
          <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="mt-1 w-full rounded-md border border-hairline px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded-md border border-hairline px-3 py-1.5 text-sm text-muted-ink hover:bg-off-white">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-navy disabled:opacity-60 flex items-center gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create project
        </button>
      </div>
    </form>
  )
}

// ─── Project Row ──────────────────────────────────────────────────────────────

function ProjectRow({ project, onUpdated }: { project: ProjectRow; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)

  async function setStatus(status: ProjectStatus) {
    setUpdating(true)
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, status }),
    })
    onUpdated()
    setUpdating(false)
  }

  const budgetPct = project.budget && project.budget > 0
    ? Math.min(100, Math.round((project.collected / project.budget) * 100))
    : null

  return (
    <>
      <tr className={cn('border-b border-hairline/70 hover:bg-off-white cursor-pointer', expanded && 'bg-brand-tint/30')}
          onClick={() => setExpanded(!expanded)}>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-ink/60 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-ink/60 shrink-0" />}
            <div>
              <p className="text-sm font-medium text-navy">{project.name}</p>
              {project.client && <p className="text-xs text-muted-ink">{project.client}</p>}
            </div>
          </div>
        </td>
        <td className="py-3 pr-4">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[project.status])}>
            {project.status.replace('_', ' ')}
          </span>
        </td>
        <td className="py-3 pr-4 text-sm text-navy/80">{project.budget ? fmt(project.budget) : '—'}</td>
        <td className="py-3 pr-4 text-sm text-green-700 font-medium">{fmt(project.collected)}</td>
        <td className="py-3 pr-4 text-sm text-red-600">{fmt(project.expenses)}</td>
        <td className="py-3 pr-4 text-sm text-navy/80">{project.outstanding != null ? fmt(project.outstanding) : '—'}</td>
        <td className="py-3 text-xs text-muted-ink/60">{fmtDate(project.end_date)}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-hairline/70 bg-brand-tint/20">
          <td colSpan={7} className="px-8 py-4">
            <div className="space-y-3">
              {project.description && (
                <p className="text-sm text-muted-ink">{project.description}</p>
              )}
              {budgetPct !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-ink">
                    <span>Budget collected</span>
                    <span>{budgetPct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-off-white">
                    <div className={cn('h-1.5 rounded-full', budgetPct >= 100 ? 'bg-green-500' : 'bg-brand')}
                         style={{ width: `${budgetPct}%` }} />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-ink">Status:</span>
                {(['active', 'completed', 'on_hold', 'cancelled'] as ProjectStatus[]).map((s) => (
                  <button key={s} disabled={updating || project.status === s}
                    onClick={(e) => { e.stopPropagation(); setStatus(s) }}
                    className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      project.status === s ? STATUS_STYLES[s] + ' opacity-100' : 'border border-hairline text-muted-ink hover:bg-off-white disabled:opacity-40'
                    )}>
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
              {(project.start_date || project.end_date) && (
                <p className="text-xs text-muted-ink/60">
                  {project.start_date && `Start: ${fmtDate(project.start_date)}`}
                  {project.start_date && project.end_date && ' · '}
                  {project.end_date && `Due: ${fmtDate(project.end_date)}`}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  function load() {
    setLoading(true)
    fetch('/api/projects?totals=true')
      .then(r => r.json())
      .then(data => setProjects(data.projects ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = statusFilter === 'all'
    ? projects
    : projects.filter(p => p.status === statusFilter)

  const totalCollected = projects.filter(p => p.status === 'active').reduce((s, p) => s + p.collected, 0)
  const totalBudget    = projects.filter(p => p.status === 'active' && p.budget).reduce((s, p) => s + (p.budget ?? 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Projects</h1>
          <p className="text-sm text-muted-ink mt-0.5">Track revenue and expenses by project or client</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-navy transition-colors">
          <Plus className="h-3.5 w-3.5" />
          New project
        </button>
      </div>

      {/* Summary cards */}
      {projects.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-hairline bg-white p-4">
            <p className="text-xs font-medium text-muted-ink uppercase tracking-wide">Active projects</p>
            <p className="mt-1.5 text-2xl font-bold text-navy">{projects.filter(p => p.status === 'active').length}</p>
          </div>
          <div className="rounded-xl border border-hairline bg-white p-4">
            <p className="text-xs font-medium text-muted-ink uppercase tracking-wide">Collected (active)</p>
            <p className="mt-1.5 text-2xl font-bold text-green-600">{fmt(totalCollected)}</p>
          </div>
          <div className="rounded-xl border border-hairline bg-white p-4">
            <p className="text-xs font-medium text-muted-ink uppercase tracking-wide">Total budget (active)</p>
            <p className="mt-1.5 text-2xl font-bold text-navy">{totalBudget > 0 ? fmt(totalBudget) : '—'}</p>
          </div>
        </div>
      )}

      {showForm && (
        <CreateProjectForm
          onCreated={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filter */}
      {projects.length > 0 && (
        <div className="flex gap-1.5">
          {['all', 'active', 'completed', 'on_hold', 'cancelled'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                statusFilter === s ? 'bg-brand-tint text-brand' : 'text-muted-ink hover:text-navy/80 hover:bg-off-white'
              )}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-hairline bg-white overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-10 w-10 text-muted-ink/40 mb-3" />
            <p className="text-sm font-medium text-navy mb-1">
              {projects.length === 0 ? 'No projects yet' : 'No projects match this filter'}
            </p>
            <p className="text-sm text-muted-ink mb-4">
              {projects.length === 0
                ? 'Create your first project to track revenue and expenses by client or engagement.'
                : 'Try selecting a different status filter.'}
            </p>
            {projects.length === 0 && (
              <button onClick={() => setShowForm(true)}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-navy">
                Create first project
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-hairline/70">
                <tr>
                  <th className="text-left py-3 pr-4 pl-4 text-xs font-medium text-muted-ink">Project</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-muted-ink">Status</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-muted-ink">Budget</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-muted-ink">Collected</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-muted-ink">Expenses</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-muted-ink">Outstanding</th>
                  <th className="text-left py-3 text-xs font-medium text-muted-ink">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y-0">
                {filtered.map(project => (
                  <ProjectRow key={project.id} project={project} onUpdated={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
