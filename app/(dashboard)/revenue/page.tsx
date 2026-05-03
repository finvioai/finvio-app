'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Users, PercentIcon, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { MRRTrend } from '@/types'

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

interface RevenueData {
  mrrTrend: MRRTrend[]
  mrr: number
  arr: number
  activeCustomers: number
  churnRate: number
  bySource: Record<string, number>
  customers: Customer[]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

type ActiveTab = 'trend' | 'source' | 'customers'

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
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!data) {
    return <div className="p-6 text-center text-sm text-gray-500">Failed to load revenue data.</div>
  }

  const pieData = Object.entries(data.bySource)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: SOURCE_LABELS[key] ?? key, value, key }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
        <p className="text-sm text-gray-500 mt-0.5">MRR, ARR, customers, and revenue sources</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={fmt(data.mrr)} sub="This month" icon={TrendingUp} color="bg-blue-50 text-blue-600" />
        <KpiCard label="ARR" value={fmt(data.arr)} sub="Annualised" icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
        <KpiCard label="Customers" value={String(data.activeCustomers)} sub="Active" icon={Users} color="bg-green-50 text-green-600" />
        <KpiCard label="Churn Rate" value={pct(data.churnRate)} sub="This month" icon={PercentIcon} color="bg-orange-50 text-orange-600" />
      </div>

      {/* Tabs + Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex gap-1 mb-5 border-b border-gray-100 pb-3">
          {(['trend', 'source', 'customers'] as ActiveTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                tab === t ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {t === 'trend' ? 'MRR Trend' : t === 'source' ? 'By Source' : 'Customers'}
            </button>
          ))}
        </div>

        {tab === 'trend' && (
          <>
            <p className="text-xs text-gray-500 mb-3">12-month MRR history</p>
            {data.mrrTrend.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">No revenue data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.mrrTrend.map((d) => ({ month: monthLabel(d.month), mrr: d.mrr }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: unknown) => [fmt(v as number), 'MRR']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="mrr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {tab === 'source' && (
          <>
            <p className="text-xs text-gray-500 mb-3">Income by source this month</p>
            {pieData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">No revenue data this month</p>
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
                    <div key={entry.key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLORS[entry.key] ?? '#94a3b8' }} />
                        <span className="text-sm text-gray-700">{entry.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{fmt(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'customers' && (
          <>
            <p className="text-xs text-gray-500 mb-3">Customer list</p>
            {data.customers.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">No customers synced yet — connect Stripe to import customers.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Name</th>
                      <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Email</th>
                      <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left py-2 text-xs font-medium text-gray-500">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{c.name ?? '—'}</td>
                        <td className="py-2.5 pr-4 text-gray-500">{c.email ?? '—'}</td>
                        <td className="py-2.5 pr-4">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', c.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600')}>
                            {c.status ?? 'unknown'}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-500">
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
