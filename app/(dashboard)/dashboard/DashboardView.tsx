'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown, DollarSign, Clock, Users, AlertCircle, ArrowRight, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import type { MRRTrend, DashboardMetrics } from '@/types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' })
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono-eyebrow text-muted-ink">{label}</p>
          <p className="mt-2 text-2xl font-bold text-navy">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-ink">{sub}</p>}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', color)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  )
}

function RevenueChart({ data, label = 'MRR' }: { data: MRRTrend[]; label?: string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-ink">
        No revenue data yet
      </div>
    )
  }
  const chartData = data.map((d) => ({ month: monthLabel(d.month), mrr: d.mrr }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.09 262 / 0.06)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.48 0.04 258)' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: 'oklch(0.48 0.04 258)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <Tooltip
          formatter={(value: unknown) => [fmt(value as number), label]}
          contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid oklch(0.26 0.09 262 / 0.12)', boxShadow: '0 4px 16px oklch(0.26 0.09 262 / 0.08)' }}
        />
        <Bar dataKey="mrr" fill="#297cef" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface RecentTransaction {
  id: string
  type: string
  amount: number
  description: string | null
  category: string | null
  date: string
  source: string | null
}

interface OverdueInvoice {
  id: string
  invoice_number: string
  amount: number
  due_date: string | null
  customer_name: string | null
}

export interface DashboardViewData extends DashboardMetrics {
  recentTransactions: RecentTransaction[]
  uncategorizedCount: number
  overdueInvoices: OverdueInvoice[]
}

export function DashboardView({ data }: { data: DashboardViewData }) {
  const runwayLabel =
    data.runway === 'infinite' ? '∞ months' : `${data.runway} months`

  const runwayColor =
    data.runway === 'infinite' || (typeof data.runway === 'number' && data.runway >= 12)
      ? 'bg-green-50 text-green-600'
      : typeof data.runway === 'number' && data.runway >= 6
      ? 'bg-yellow-50 text-yellow-600'
      : 'bg-red-50 text-red-600'

  const model = data.businessModel ?? 'saas'
  const chartLabel = model === 'saas' ? 'MRR' : 'Revenue'

  const kpiGrid = () => {
    if (model === 'smb') {
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Revenue (this month)" value={fmt(data.totalRevenue)} sub={`Avg: ${fmt(data.avgMonthlyRevenue)}/mo`} icon={TrendingUp} color="bg-brand-tint text-brand" />
          <KpiCard
            label="Gross Profit"
            value={fmt(data.grossProfit)}
            sub={data.grossProfit >= 0 ? 'Profitable this month' : 'Loss this month'}
            icon={data.grossProfit >= 0 ? TrendingUp : TrendingDown}
            color={data.grossProfit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}
          />
          <KpiCard label="Cash Balance" value={fmt(data.cashBalance)} sub={`Burn: ${fmt(data.burnRate)}/mo`} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
          <KpiCard label="Avg Monthly Revenue" value={fmt(data.avgMonthlyRevenue)} sub="3-month rolling avg" icon={BarChart2} color="bg-violet-50 text-violet-600" />
        </div>
      )
    }

    if (model === 'project_based') {
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Revenue (this month)" value={fmt(data.totalRevenue)} sub={`Avg: ${fmt(data.avgMonthlyRevenue)}/mo`} icon={TrendingUp} color="bg-brand-tint text-brand" />
          <KpiCard
            label="Gross Profit"
            value={fmt(data.grossProfit)}
            sub={data.grossProfit >= 0 ? 'Profitable this month' : 'Loss this month'}
            icon={data.grossProfit >= 0 ? TrendingUp : TrendingDown}
            color={data.grossProfit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}
          />
          <KpiCard label="Cash Balance" value={fmt(data.cashBalance)} sub={`Burn: ${fmt(data.burnRate)}/mo`} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
          <KpiCard label="Cash Runway" value={runwayLabel} sub={data.netBurn > 0 ? `Net burn: ${fmt(data.netBurn)}/mo` : 'Cash flow positive'} icon={Clock} color={runwayColor} />
        </div>
      )
    }

    if (model === 'mixed') {
      return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard label="MRR" value={fmt(data.mrr)} sub={`ARR: ${fmt(data.arr)}`} icon={TrendingUp} color="bg-brand-tint text-brand" />
          <KpiCard label="Total Revenue" value={fmt(data.totalRevenue)} sub="This month (all types)" icon={BarChart2} color="bg-indigo-50 text-indigo-600" />
          <KpiCard label="Gross Profit" value={fmt(data.grossProfit)} sub="Revenue minus expenses" icon={data.grossProfit >= 0 ? TrendingUp : TrendingDown} color={data.grossProfit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'} />
          <KpiCard label="Cash Balance" value={fmt(data.cashBalance)} sub={`Burn: ${fmt(data.burnRate)}/mo`} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
          <KpiCard label="Runway" value={runwayLabel} sub={data.netBurn > 0 ? `Net burn: ${fmt(data.netBurn)}/mo` : 'Cash flow positive'} icon={Clock} color={runwayColor} />
          <KpiCard label="Customers" value={String(data.activeCustomers)} sub={`Churn: ${(data.churnRate * 100).toFixed(1)}%`} icon={Users} color="bg-purple-50 text-purple-600" />
        </div>
      )
    }

    // Default: SaaS
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={fmt(data.mrr)} sub={`ARR: ${fmt(data.arr)}`} icon={TrendingUp} color="bg-brand-tint text-brand" />
        <KpiCard label="Cash Balance" value={fmt(data.cashBalance)} sub={`Burn: ${fmt(data.burnRate)}/mo`} icon={DollarSign} color="bg-green-50 text-green-600" />
        <KpiCard label="Runway" value={runwayLabel} sub={data.netBurn > 0 ? `Net burn: ${fmt(data.netBurn)}/mo` : 'Cash flow positive'} icon={Clock} color={runwayColor} />
        <KpiCard label="Customers" value={String(data.activeCustomers)} sub={`Churn: ${(data.churnRate * 100).toFixed(1)}%`} icon={Users} color="bg-purple-50 text-purple-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
        <p className="text-sm text-muted-ink mt-0.5">Your financial overview at a glance</p>
      </div>

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

      {kpiGrid()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-hairline bg-white p-5">
          <h2 className="text-sm font-semibold text-navy mb-4">Revenue Trend (6 months)</h2>
          <RevenueChart data={data.mrrTrend} label={chartLabel} />
        </div>

        <div className="rounded-xl border border-hairline bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-navy">Action Items</h2>

          {data.uncategorizedCount > 0 && (
            <Link href="/transactions" className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 hover:bg-orange-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-orange-800">{data.uncategorizedCount} uncategorized</p>
                <p className="text-xs text-orange-600">Transactions need review</p>
              </div>
              <ArrowRight className="h-4 w-4 text-orange-500" />
            </Link>
          )}

          {data.overdueInvoices.length > 0 && (
            <Link href="/invoices" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 hover:bg-red-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-red-800">{data.overdueInvoices.length} overdue invoice{data.overdueInvoices.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-red-600">{fmt(data.overdueInvoices.reduce((s, i) => s + i.amount, 0))} outstanding</p>
              </div>
              <ArrowRight className="h-4 w-4 text-red-500" />
            </Link>
          )}

          {data.uncategorizedCount === 0 && data.overdueInvoices.length === 0 && (
            <p className="text-sm text-muted-ink">No action items — you&apos;re all caught up!</p>
          )}

          <div className="pt-2 border-t border-hairline">
            <p className="font-mono-eyebrow text-muted-ink mb-2">Data health</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-off-white">
                <div
                  className={cn('h-1.5 rounded-full', data.dataCompleteness.overallScore >= 60 ? 'bg-green-500' : data.dataCompleteness.overallScore >= 30 ? 'bg-yellow-500' : 'bg-red-500')}
                  style={{ width: `${data.dataCompleteness.overallScore}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-ink">{data.dataCompleteness.overallScore}%</span>
            </div>
          </div>

          <Link href="/connections" className="flex w-full items-center justify-center rounded-lg border border-hairline bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-off-white transition-colors">
            Connect integrations
          </Link>
        </div>
      </div>

      {data.recentTransactions.length > 0 && (
        <div className="rounded-xl border border-hairline bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-navy">Recent Transactions</h2>
            <Link href="/transactions" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {data.recentTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b border-hairline/60 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold', txn.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
                    {txn.type === 'income' ? '+' : '-'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy truncate max-w-xs">{txn.description}</p>
                    <p className="text-xs text-muted-ink">{txn.category ?? 'Uncategorized'} · {fmtDate(txn.date)}</p>
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

      {data.recentTransactions.length === 0 && data.dataCompleteness.overallScore < 30 && (
        <div className="rounded-xl border border-dashed border-hairline bg-white p-10 text-center">
          <p className="text-sm font-medium text-navy mb-1">No financial data yet</p>
          <p className="text-sm text-muted-ink mb-4">Connect an integration or import a CSV to get started.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/connections" className="inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-navy-foreground hover:bg-navy transition-colors">Connect integrations</Link>
            <Link href="/import" className="inline-flex items-center rounded-lg border border-hairline bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-off-white transition-colors">Import CSV</Link>
          </div>
        </div>
      )}
    </div>
  )
}
