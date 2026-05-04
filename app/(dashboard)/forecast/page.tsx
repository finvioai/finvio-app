'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, DollarSign, Zap, Loader2 } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { ForecastMonth, BusinessModel } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ForecastData {
  forecast: ForecastMonth[]
  businessModel: BusinessModel
  currentMRR: number
  avgMonthlyRevenue: number
  currentBurnRate: number
  currentCash: number
}

// ─── Slider component ─────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="font-bold text-blue-600">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const [growthRate, setGrowthRate] = useState(5)   // percent (SaaS only)
  const [forecastMonths, setForecastMonths] = useState(12)
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(false)
  const [baseLoaded, setBaseLoaded] = useState(false)

  const isSaaS = !data || data.businessModel === 'saas'

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/metrics/forecast?growthRate=${growthRate / 100}&months=${forecastMonths}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => { setLoading(false); setBaseLoaded(true) })
  }, [growthRate, forecastMonths])

  useEffect(() => {
    const id = setTimeout(load, baseLoaded ? 400 : 0)
    return () => clearTimeout(id)
  }, [load, baseLoaded])

  const chartData = data?.forecast.map((f) => ({
    month: monthLabel(f.month),
    revenue: Math.round(f.projectedRevenue ?? f.projectedMRR),
    expenses: Math.round(f.projectedExpenses),
    cash: Math.round(f.projectedCash),
  })) ?? []

  const breakEvenMonth = data?.forecast.find((f) =>
    (f.projectedRevenue ?? f.projectedMRR) >= f.projectedExpenses
  )
  const cashRunsOut = data?.forecast.find((f) => f.projectedCash < 0)
  const lastMonth = data?.forecast[data.forecast.length - 1]
  const revenueLabel = isSaaS ? 'MRR at end' : 'Revenue at end'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Forecast</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Project revenue, expenses, and cash based on growth assumptions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-6">
          <h2 className="text-sm font-semibold text-gray-900">Assumptions</h2>

          {isSaaS && (
            <Slider
              label="Monthly MRR Growth"
              value={growthRate}
              min={0}
              max={25}
              step={0.5}
              format={(v) => `${v.toFixed(1)}%`}
              onChange={setGrowthRate}
            />
          )}

          {!isSaaS && data && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
              <p className="text-xs text-blue-700 font-medium">Using historical revenue trend</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Projection based on your last 6 months of revenue.
              </p>
            </div>
          )}

          <Slider
            label="Forecast Period"
            value={forecastMonths}
            min={3}
            max={18}
            step={1}
            format={(v) => `${v} months`}
            onChange={setForecastMonths}
          />

          {data && (
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Baseline</p>
              <div className="space-y-2">
                {isSaaS ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Current MRR</span>
                    <span className="font-medium">{fmt(data.currentMRR)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Avg monthly revenue</span>
                    <span className="font-medium">{fmt(data.avgMonthlyRevenue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monthly burn</span>
                  <span className="font-medium">{fmt(data.currentBurnRate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cash balance</span>
                  <span className="font-medium">{fmt(data.currentCash)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Outputs */}
        <div className="lg:col-span-2 space-y-4">
          {!data && loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Outcome cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <p className="text-xs font-medium text-gray-500">Break-even</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {breakEvenMonth ? monthLabel(breakEvenMonth.month) : 'Beyond forecast'}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <p className="text-xs font-medium text-gray-500">{revenueLabel}</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {lastMonth ? fmt(lastMonth.projectedRevenue ?? lastMonth.projectedMRR) : '—'}
                  </p>
                </div>

                <div className={cn(
                  'rounded-xl border p-4',
                  cashRunsOut ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className={cn('h-4 w-4', cashRunsOut ? 'text-red-500' : 'text-green-500')} />
                    <p className="text-xs font-medium text-gray-500">Cash at end</p>
                  </div>
                  <p className={cn('text-lg font-bold', cashRunsOut ? 'text-red-700' : 'text-gray-900')}>
                    {lastMonth ? fmt(lastMonth.projectedCash) : '—'}
                  </p>
                  {cashRunsOut && (
                    <p className="text-xs text-red-600 mt-0.5">
                      Runs out {monthLabel(cashRunsOut.month)}
                    </p>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="relative rounded-xl border border-gray-200 bg-white p-5">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl z-10">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  </div>
                )}
                <p className="text-xs text-gray-500 mb-4">Monthly revenue vs expenses</p>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => [
                        fmt(v as number),
                        name === 'revenue' ? 'Revenue' : name === 'expenses' ? 'Expenses' : 'Cash',
                      ]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
                    <Line dataKey="cash" name="Cash" stroke="#10b981" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
