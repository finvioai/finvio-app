'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PnLReport, PnLLineItem } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function pctChange(current: number, prev: number): string {
  if (prev === 0) return '—'
  const change = ((current - prev) / prev) * 100
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
}

const EXPENSE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]

function prevMonthStr(month: string): string {
  const d = new Date(month)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function nextMonthStr(month: string): string {
  const d = new Date(month)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function displayMonth(month: string): string {
  return new Date(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── P&L Row ─────────────────────────────────────────────────────────────────

function PnLRow({ item, prev, isTotal }: { item: PnLLineItem; prev?: PnLLineItem; isTotal?: boolean }) {
  const change = prev !== undefined ? pctChange(item.amount, prev.amount) : undefined
  const improved = typeof change === 'string' && change !== '—' && parseFloat(change) > 0
  return (
    <tr className={cn('border-b border-gray-50', isTotal && 'bg-gray-50 font-semibold')}>
      <td className={cn('py-2.5 pr-4 text-sm', isTotal ? 'px-4 text-gray-900' : 'pl-8 text-gray-700')}>
        {item.category}
      </td>
      <td className="py-2.5 pr-4 text-sm text-right text-gray-900">{fmt(item.amount)}</td>
      <td className="py-2.5 pr-4 text-sm text-right">
        {change && change !== '—' ? (
          <span className={cn('text-xs', improved ? 'text-green-600' : 'text-red-600')}>{change}</span>
        ) : (
          <span className="text-xs text-gray-400">{change ?? '—'}</span>
        )}
      </td>
    </tr>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(pnl: PnLReport) {
  const rows = [
    'Category,Amount,Type',
    ...pnl.revenue.map((r) => `"${r.category}",${r.amount},income`),
    `"Total Revenue",${pnl.totalRevenue},income`,
    ...pnl.expenses.map((e) => `"${e.category}",${e.amount},expense`),
    `"Total Expenses",${pnl.totalExpenses},expense`,
    `"Net Income",${pnl.netIncome},net`,
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pnl-${pnl.month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonthStr)
  const [current, setCurrent] = useState<PnLReport | null>(null)
  const [previous, setPrevious] = useState<PnLReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback((m: string) => {
    setLoading(true)
    fetch(`/api/metrics/pnl?month=${m}`)
      .then((r) => r.json())
      .then(({ current: c, previous: p }: { current: PnLReport; previous: PnLReport }) => {
        setCurrent(c)
        setPrevious(p)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(month) }, [month, load])

  function goBack() { setMonth((m) => prevMonthStr(m)) }
  function goForward() {
    const next = nextMonthStr(month)
    if (next <= currentMonthStr()) setMonth(next)
  }

  const canGoForward = nextMonthStr(month) <= currentMonthStr()

  const pieData = current
    ? current.expenses.map((e, i) => ({
        name: e.category,
        value: e.amount,
        color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
      }))
    : []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Profit &amp; loss statement by month</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="rounded-md border border-gray-200 p-1.5 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-900 w-36 text-center">{displayMonth(month)}</span>
          <button onClick={goForward} disabled={!canGoForward} className="rounded-md border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
          {current && (
            <Button size="sm" variant="outline" onClick={() => exportCSV(current)}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : !current ? (
        <p className="text-center text-sm text-gray-500">Failed to load report.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* P&L Table */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Category</th>
                  <th className="text-right py-3 pr-4 text-xs font-medium text-gray-500">Amount</th>
                  <th className="text-right py-3 pr-4 text-xs font-medium text-gray-500">vs Last Month</th>
                </tr>
              </thead>
              <tbody>
                {/* Revenue */}
                <tr>
                  <td colSpan={3} className="pt-3 pb-1 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Revenue
                  </td>
                </tr>
                {current.revenue.length === 0 ? (
                  <tr><td colSpan={3} className="py-3 pl-8 text-sm text-gray-400">No revenue this month</td></tr>
                ) : (
                  current.revenue.map((r) => {
                    const prev = previous?.revenue.find((p) => p.category === r.category)
                    return <PnLRow key={r.category} item={r} prev={prev} />
                  })
                )}
                <PnLRow
                  item={{ category: 'Total Revenue', amount: current.totalRevenue, transactionCount: 0 }}
                  prev={previous ? { category: 'Total Revenue', amount: previous.totalRevenue, transactionCount: 0 } : undefined}
                  isTotal
                />

                {/* Expenses */}
                <tr>
                  <td colSpan={3} className="pt-4 pb-1 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Expenses
                  </td>
                </tr>
                {current.expenses.length === 0 ? (
                  <tr><td colSpan={3} className="py-3 pl-8 text-sm text-gray-400">No expenses this month</td></tr>
                ) : (
                  current.expenses.map((e) => {
                    const prev = previous?.expenses.find((p) => p.category === e.category)
                    return <PnLRow key={e.category} item={e} prev={prev} />
                  })
                )}
                <PnLRow
                  item={{ category: 'Total Expenses', amount: current.totalExpenses, transactionCount: 0 }}
                  prev={previous ? { category: 'Total Expenses', amount: previous.totalExpenses, transactionCount: 0 } : undefined}
                  isTotal
                />

                {/* Net Income */}
                <tr className="bg-blue-50">
                  <td className="py-3 px-4 text-sm font-bold text-gray-900">Net Income</td>
                  <td className={cn('py-3 pr-4 text-sm font-bold text-right', current.netIncome >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {fmt(current.netIncome)}
                  </td>
                  <td className="py-3 pr-4 text-sm text-right">
                    {previous && (
                      <span className={cn('text-xs', current.netIncome >= previous.netIncome ? 'text-green-600' : 'text-red-600')}>
                        {pctChange(current.netIncome, previous.netIncome)}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Expense breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
            {pieData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">No expenses this month</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: unknown) => fmt(v as number)}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}

            <div className="mt-4 space-y-2 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Revenue</span>
                <span className="font-medium text-green-600">{fmt(current.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Expenses</span>
                <span className="font-medium text-red-600">{fmt(current.totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="font-semibold text-gray-900">Net</span>
                <span className={cn('font-bold', current.netIncome >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {fmt(current.netIncome)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
