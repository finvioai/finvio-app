'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Clock, Users, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MRRTrend, DashboardMetrics } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' })
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
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
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  )
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────

function RevenueChart({ data }: { data: MRRTrend[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No revenue data yet
      </div>
    )
  }
  const chartData = data.map((d) => ({ month: monthLabel(d.month), mrr: d.mrr }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <Tooltip
          formatter={(value: unknown) => [fmt(value as number), 'MRR']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Bar dataKey="mrr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Dashboard data type ──────────────────────────────────────────────────────

interface DashboardData extends DashboardMetrics {
  recentTransactions: Array<{
    id: string
    type: string
    amount: number
    description: string
    category: string | null
    date: string
    source: string | null
  }>
  uncategorizedCount: number
  overdueInvoices: Array<{
    id: string
    invoice_number: string
    amount: number
    due_date: string | null
    customer_name: string | null
  }>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/metrics/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
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
    return (
      <div className="p-6 text-center text-sm text-gray-500">Failed to load dashboard data.</div>
    )
  }

  const runwayLabel =
    data.runway === 'infinite' ? '∞ months' : `${data.runway} months`

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your financial overview at a glance</p>
      </div>

      {/* Data warnings */}
      {data.dataWarnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            {data.dataWarnings.slice(0, 2).map((w, i) => (
              <p key={i} className="text-sm text-yellow-800">{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="MRR"
          value={fmt(data.mrr)}
          sub={`ARR: ${fmt(data.arr)}`}
          icon={TrendingUp}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Cash Balance"
          value={fmt(data.cashBalance)}
          sub={`Burn: ${fmt(data.burnRate)}/mo`}
          icon={DollarSign}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          label="Runway"
          value={runwayLabel}
          sub={data.netBurn > 0 ? `Net burn: ${fmt(data.netBurn)}/mo` : 'Cash flow positive'}
          icon={Clock}
          color={
            data.runway === 'infinite' || (typeof data.runway === 'number' && data.runway >= 12)
              ? 'bg-green-50 text-green-600'
              : typeof data.runway === 'number' && data.runway >= 6
              ? 'bg-yellow-50 text-yellow-600'
              : 'bg-red-50 text-red-600'
          }
        />
        <KpiCard
          label="Customers"
          value={String(data.activeCustomers)}
          sub={`Churn: ${(data.churnRate * 100).toFixed(1)}%`}
          icon={Users}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MRR Trend Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue Trend (6 months)</h2>
          <RevenueChart data={data.mrrTrend} />
        </div>

        {/* Action Items */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Action Items</h2>

          {data.uncategorizedCount > 0 && (
            <a href="/dashboard/transactions" className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 hover:bg-orange-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-orange-800">{data.uncategorizedCount} uncategorized</p>
                <p className="text-xs text-orange-600">Transactions need review</p>
              </div>
              <ArrowRight className="h-4 w-4 text-orange-500" />
            </a>
          )}

          {data.overdueInvoices.length > 0 && (
            <a href="/dashboard/invoices" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 hover:bg-red-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-red-800">{data.overdueInvoices.length} overdue invoice{data.overdueInvoices.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-red-600">
                  {fmt(data.overdueInvoices.reduce((s, i) => s + i.amount, 0))} outstanding
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-red-500" />
            </a>
          )}

          {data.uncategorizedCount === 0 && data.overdueInvoices.length === 0 && (
            <p className="text-sm text-gray-400">No action items — you&apos;re all caught up!</p>
          )}

          {/* Data health */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1.5">Data health</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                <div
                  className={cn('h-1.5 rounded-full', data.dataCompleteness.overallScore >= 60 ? 'bg-green-500' : data.dataCompleteness.overallScore >= 30 ? 'bg-yellow-500' : 'bg-red-500')}
                  style={{ width: `${data.dataCompleteness.overallScore}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600">{data.dataCompleteness.overallScore}%</span>
            </div>
          </div>

          <Button size="sm" variant="outline" className="w-full" onClick={() => window.location.href = '/dashboard/connections'}>
            Connect integrations
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentTransactions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Transactions</h2>
            <a href="/dashboard/transactions" className="text-xs text-blue-600 hover:underline">View all</a>
          </div>
          <div className="space-y-2">
            {data.recentTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold', txn.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
                    {txn.type === 'income' ? '+' : '-'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{txn.description}</p>
                    <p className="text-xs text-gray-500">{txn.category ?? 'Uncategorized'} · {fmtDate(txn.date)}</p>
                  </div>
                </div>
                <p className={cn('text-sm font-semibold', txn.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                  {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.recentTransactions.length === 0 && data.dataCompleteness.overallScore < 30 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No financial data yet</p>
          <p className="text-sm text-gray-500 mb-4">Connect an integration or import a CSV to get started.</p>
          <div className="flex gap-3 justify-center">
            <Button size="sm" onClick={() => window.location.href = '/dashboard/connections'}>Connect integrations</Button>
            <Button size="sm" variant="outline" onClick={() => window.location.href = '/dashboard/import'}>Import CSV</Button>
          </div>
        </div>
      )}
    </div>
  )
}
