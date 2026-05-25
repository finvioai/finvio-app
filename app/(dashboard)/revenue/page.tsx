'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Users, PercentIcon, Loader2, DollarSign, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { MRRTrend, RevenueByTypeResult, BusinessModel } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

const SOURCE_COLORS: Record<string, string> = {
  stripe: '#6366f1',
  shopify: '#10b981',
  paypal: '#3b82f6',
  manual: '#f59e0b',
  csv: '#ec4899',
  plaid: '#8b5cf6',
}

const SOURCE_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  shopify: 'Shopify',
  paypal: 'PayPal',
  manual: 'Manual',
  csv: 'CSV Import',
  plaid: 'Bank',
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string | null
  email: string | null
  status: string | null
  created_at: string | null
  external_id: string | null
}

interface RevenueTrendPoint {
  month: string
  revenue: number
}

interface RevenueData {
  mrrTrend: MRRTrend[]
  mrr: number
  arr: number
  activeCustomers: number
  churnRate: number
  bySource: Record<string, number>
  revenueByType: RevenueByTypeResult
  customers: Customer[]
  businessModel: BusinessModel
  totalRevenue: number
  avgMonthlyRevenue: number
  grossProfit: number
  revenueTrend: RevenueTrendPoint[]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-ink uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-navy">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-ink">{sub}</p>}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

const TYPE_COLORS: Record<string, string> = {
  recurring:    '#3b82f6',
  one_time:     '#10b981',
  project:      '#f59e0b',
  milestone:    '#8b5cf6',
  unclassified: '#94a3b8',
}

const TYPE_LABELS: Record<string, string> = {
  recurring:    'Recurring',
  one_time:     'One-time',
  project:      'Project',
  milestone:    'Milestone',
  unclassified: 'Unclassified',
}

type ActiveTab = 'trend' | 'source' | 'type' | 'customers'

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ActiveTab>('trend')

  useEffect(() => {
    fetch('/api/metrics/revenue')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    )
  }

  if (!data) {
    return <div className="p-6 text-center text-sm text-muted-ink">Failed to load revenue data.</div>
  }

  const isSaaS = !data.businessModel || data.businessModel === 'saas' || data.businessModel === 'mixed'
  const pieData = Object.entries(data.bySource)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: SOURCE_LABELS[key] ?? key, value, key }))

  const trendLabel = isSaaS ? 'MRR Trend' : 'Revenue Trend'
  const trendData = isSaaS
    ? data.mrrTrend.map((d) => ({ month: monthLabel(d.month), value: d.mrr }))
    : (data.revenueTrend ?? []).map((d) => ({ month: monthLabel(d.month), value: d.revenue }))
  const trendValueLabel = isSaaS ? 'MRR' : 'Revenue'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Revenue</h1>
        <p className="text-sm text-muted-ink mt-0.5">
          {isSaaS ? 'MRR, ARR, customers, and revenue sources' : 'Revenue, profit, and income sources'}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isSaaS ? (
          <>
            <KpiCard label="MRR" value={fmt(data.mrr)} sub="This month" icon={TrendingUp} color="bg-brand-tint text-brand" />
            <KpiCard label="ARR" value={fmt(data.arr)} sub="Annualised" icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
            <KpiCard label="Customers" value={String(data.activeCustomers)} sub="Active" icon={Users} color="bg-green-50 text-green-600" />
            <KpiCard label="Churn Rate" value={pct(data.churnRate)} sub="This month" icon={PercentIcon} color="bg-orange-50 text-orange-600" />
          </>
        ) : (
          <>
            <KpiCard label="Revenue" value={fmt(data.totalRevenue ?? 0)} sub="This month" icon={DollarSign} color="bg-brand-tint text-brand" />
            <KpiCard label="Avg Monthly Revenue" value={fmt(data.avgMonthlyRevenue ?? 0)} sub="Last 3 months" icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
            <KpiCard label="Customers" value={String(data.activeCustomers)} sub="Active" icon={Users} color="bg-green-50 text-green-600" />
            <KpiCard label="Gross Profit" value={fmt(data.grossProfit ?? 0)} sub="This month" icon={(data.grossProfit ?? 0) >= 0 ? TrendingUp : TrendingDown} color={(data.grossProfit ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'} />
          </>
        )}
      </div>

      {/* Tabs + Chart */}
      <div className="rounded-xl border border-hairline bg-white p-5">
        <div className="flex gap-1 mb-5 border-b border-hairline/70 pb-3">
          {(['trend', 'source', 'type', 'customers'] as ActiveTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                tab === t ? 'bg-brand-tint text-brand' : 'text-muted-ink hover:text-navy/80 hover:bg-off-white'
              )}
            >
              {t === 'trend' ? trendLabel : t === 'source' ? 'By Source' : t === 'type' ? 'By Type' : 'Customers'}
            </button>
          ))}
        </div>

        {tab === 'trend' && (
          <>
            <p className="text-xs text-muted-ink mb-3">12-month {trendValueLabel.toLowerCase()} history</p>
            {trendData.length === 0 || trendData.every(d => d.value === 0) ? (
              <p className="text-sm text-muted-ink/60 py-10 text-center">No revenue data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: unknown) => [fmt(v as number), trendValueLabel]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {tab === 'source' && (
          <>
            <p className="text-xs text-muted-ink mb-3">Income by source this month</p>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-ink/60 py-10 text-center">No revenue data this month</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width={220} height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                      {pieData.map((entry) => (
                        <Cell key={entry.key} fill={SOURCE_COLORS[entry.key] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(v: unknown) => fmt(v as number)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {pieData.map((entry) => (
                    <div key={entry.key} className="flex items-center justify-between py-1.5 border-b border-hairline/40 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLORS[entry.key] ?? '#94a3b8' }} />
                        <span className="text-sm text-navy/80">{entry.name}</span>
                      </div>
                      <span className="text-sm font-medium text-navy">{fmt(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'type' && (() => {
          const typeData = Object.entries(data.revenueByType ?? {})
            .filter(([, v]) => v > 0)
            .map(([key, value]) => ({ name: TYPE_LABELS[key] ?? key, value, key }))
          const total = typeData.reduce((s, d) => s + d.value, 0)
          return (
            <>
              <p className="text-xs text-muted-ink mb-3">Revenue by type this month</p>
              {typeData.length === 0 ? (
                <p className="text-sm text-muted-ink/60 py-10 text-center">No revenue data this month</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <ResponsiveContainer width={220} height={220}>
                    <PieChart>
                      <Pie data={typeData} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                        {typeData.map((entry) => (
                          <Cell key={entry.key} fill={TYPE_COLORS[entry.key] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip formatter={(v: unknown) => fmt(v as number)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {typeData.map((entry) => (
                      <div key={entry.key} className="flex items-center justify-between py-1.5 border-b border-hairline/40 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[entry.key] ?? '#94a3b8' }} />
                          <span className="text-sm text-navy/80">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-ink/60">{total > 0 ? `${((entry.value / total) * 100).toFixed(0)}%` : '—'}</span>
                          <span className="text-sm font-medium text-navy">{fmt(entry.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {tab === 'customers' && (
          <>
            <p className="text-xs text-muted-ink mb-3">Customer list</p>
            {data.customers.length === 0 ? (
              <p className="text-sm text-muted-ink/60 py-10 text-center">No customers synced yet — connect Stripe to import customers.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline/70">
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-ink">Name</th>
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-ink">Email</th>
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-ink">Status</th>
                      <th className="text-left py-2 text-xs font-medium text-muted-ink">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((c) => (
                      <tr key={c.id} className="border-b border-hairline/40 last:border-0 hover:bg-off-white">
                        <td className="py-2.5 pr-4 font-medium text-navy">{c.name ?? '—'}</td>
                        <td className="py-2.5 pr-4 text-muted-ink">{c.email ?? '—'}</td>
                        <td className="py-2.5 pr-4">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', c.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-off-white text-muted-ink')}>
                            {c.status ?? 'unknown'}
                          </span>
                        </td>
                        <td className="py-2.5 text-muted-ink">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
