'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, DollarSign, Loader2, ArrowRight } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function runwayLabel(runway: number | 'infinite'): string {
  return runway === 'infinite' ? '∞ months' : `${runway} months`
}

function runwayColor(runway: number | 'infinite'): string {
  if (runway === 'infinite') return 'text-green-600'
  if (runway >= 18) return 'text-green-600'
  if (runway >= 9) return 'text-yellow-600'
  return 'text-red-600'
}

function runwayRisk(runway: number | 'infinite'): { label: string; color: string } {
  if (runway === 'infinite') return { label: 'Safe', color: 'bg-green-100 text-green-700' }
  if (runway >= 18) return { label: 'Safe', color: 'bg-green-100 text-green-700' }
  if (runway >= 9) return { label: 'Caution', color: 'bg-yellow-100 text-yellow-700' }
  return { label: 'Risky', color: 'bg-red-100 text-red-700' }
}

function calcRunway(cash: number, netBurn: number): number | 'infinite' {
  if (netBurn <= 0) return 'infinite'
  if (cash <= 0) return 0
  return Math.floor(cash / netBurn)
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Baseline {
  mrr: number
  burnRate: number
  cashBalance: number
  runway: number | 'infinite'
  netBurn: number
}

// ─── Compare Row ─────────────────────────────────────────────────────────────

function CompareRow({ label, baseline, scenario }: {
  label: string
  baseline: string | number
  scenario: string | number
}) {
  const improved =
    typeof scenario === 'number' && typeof baseline === 'number' && scenario > baseline
  const worsened =
    typeof scenario === 'number' && typeof baseline === 'number' && scenario < baseline
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-hairline/40 last:border-0">
      <span className="text-sm text-muted-ink">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-ink/60">
          {typeof baseline === 'number' ? fmt(baseline) : baseline}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-ink/40" />
        <span className={cn(
          'text-sm font-semibold',
          improved ? 'text-green-600' : worsened ? 'text-red-600' : 'text-navy'
        )}>
          {typeof scenario === 'number' ? fmt(scenario) : scenario}
        </span>
      </div>
    </div>
  )
}

// ─── Hire Scenario ─────────────────────────────────────────────────────────────

function HireScenario({ baseline }: { baseline: Baseline }) {
  const [role, setRole] = useState('')
  const [monthlyCost, setMonthlyCost] = useState('')

  const cost = parseFloat(monthlyCost) || 0
  const newBurn = baseline.burnRate + cost
  const newNetBurn = newBurn - baseline.mrr
  const newRunway = calcRunway(baseline.cashBalance, newNetBurn)
  const risk = runwayRisk(newRunway)

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-ink">See how adding a new hire impacts your runway.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Role / title</Label>
          <input
            type="text"
            placeholder="e.g. Senior Engineer"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Monthly all-in cost</Label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-muted-ink/60 text-sm">$</span>
            <input
              type="number"
              placeholder="12000"
              value={monthlyCost}
              onChange={(e) => setMonthlyCost(e.target.value)}
              className="w-full rounded-md border border-hairline pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {cost > 0 && (
        <div className="rounded-xl border border-hairline bg-off-white p-4 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-navy">
              Impact of hiring {role || 'this person'}
            </p>
            <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', risk.color)}>
              {risk.label}
            </span>
          </div>
          <CompareRow label="Monthly burn" baseline={baseline.burnRate} scenario={newBurn} />
          <CompareRow label="Runway" baseline={runwayLabel(baseline.runway)} scenario={runwayLabel(newRunway)} />
          <p className={cn('text-sm font-bold mt-2 pt-2 border-t border-hairline/70', runwayColor(newRunway))}>
            → {runwayLabel(newRunway)} of runway after hire
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Growth Scenario ───────────────────────────────────────────────────────────

function GrowthScenario({ baseline }: { baseline: Baseline }) {
  const [growthPct, setGrowthPct] = useState(10)
  const [extraSpend, setExtraSpend] = useState('')

  const extra = parseFloat(extraSpend) || 0
  const monthsToDouble = growthPct > 0
    ? Math.ceil(Math.log(2) / Math.log(1 + growthPct / 100))
    : Infinity
  const mrrIn12 = baseline.mrr * Math.pow(1 + growthPct / 100, 12)
  const newBurn = baseline.burnRate + extra
  const netBurnIn12 = newBurn - mrrIn12
  const newRunway12 = calcRunway(baseline.cashBalance, Math.max(0, netBurnIn12))

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-ink">Model growth scenarios and see when you break even.</p>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-navy/80">Monthly MRR growth rate</span>
            <span className="font-bold text-brand">{growthPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={growthPct}
            onChange={(e) => setGrowthPct(parseInt(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-muted-ink/60">
            <span>0%</span><span>30%</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Additional monthly marketing spend (optional)</Label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-muted-ink/60 text-sm">$</span>
            <input
              type="number"
              placeholder="0"
              value={extraSpend}
              onChange={(e) => setExtraSpend(e.target.value)}
              className="w-full rounded-md border border-hairline pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-off-white p-4 space-y-1">
        <p className="text-sm font-semibold text-navy mb-3">At {growthPct}% monthly growth</p>
        <CompareRow label="MRR in 12 months" baseline={baseline.mrr} scenario={mrrIn12} />
        <CompareRow label="Monthly burn" baseline={baseline.burnRate} scenario={newBurn} />
        <div className="flex items-center justify-between py-2.5 border-b border-hairline/40">
          <span className="text-sm text-muted-ink">Time to double MRR</span>
          <span className="text-sm font-semibold text-navy">
            {monthsToDouble === Infinity ? '—' : `${monthsToDouble} months`}
          </span>
        </div>
        <p className={cn('text-sm font-bold mt-2 pt-2 border-t border-hairline/70', runwayColor(newRunway12))}>
          → {runwayLabel(newRunway12)} of runway in 12 months
        </p>
      </div>
    </div>
  )
}

// ─── Fundraise Scenario ────────────────────────────────────────────────────────

function FundraiseScenario({ baseline }: { baseline: Baseline }) {
  const [raiseAmount, setRaiseAmount] = useState('')
  const [dilution, setDilution] = useState('')

  const raise = parseFloat(raiseAmount) || 0
  const newCash = baseline.cashBalance + raise
  const netBurn = Math.max(0, baseline.burnRate - baseline.mrr)
  const newRunway = calcRunway(newCash, netBurn)
  const risk = runwayRisk(newRunway)

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-ink">
        Model the impact of raising capital on your runway and dilution.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Raise amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-muted-ink/60 text-sm">$</span>
            <input
              type="number"
              placeholder="1000000"
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(e.target.value)}
              className="w-full rounded-md border border-hairline pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Estimated dilution (optional)</Label>
          <div className="relative">
            <input
              type="number"
              placeholder="20"
              value={dilution}
              onChange={(e) => setDilution(e.target.value)}
              className="w-full rounded-md border border-hairline pr-8 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-2 text-muted-ink/60 text-sm">%</span>
          </div>
        </div>
      </div>

      {raise > 0 && (
        <div className="rounded-xl border border-hairline bg-off-white p-4 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-navy">After raising {fmt(raise)}</p>
            <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', risk.color)}>
              {risk.label}
            </span>
          </div>
          <CompareRow label="Cash balance" baseline={baseline.cashBalance} scenario={newCash} />
          <CompareRow label="Runway" baseline={runwayLabel(baseline.runway)} scenario={runwayLabel(newRunway)} />
          {dilution && parseFloat(dilution) > 0 && (
            <div className="flex items-center justify-between py-2.5 border-b border-hairline/40">
              <span className="text-sm text-muted-ink">Dilution</span>
              <span className="text-sm font-semibold text-orange-600">{dilution}%</span>
            </div>
          )}
          <p className={cn('text-sm font-bold mt-2 pt-2 border-t border-hairline/70', runwayColor(newRunway))}>
            → {runwayLabel(newRunway)} of runway after raise
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ScenarioTab = 'hire' | 'growth' | 'fundraise'

export default function ScenariosPage() {
  const [baseline, setBaseline] = useState<Baseline | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ScenarioTab>('hire')

  useEffect(() => {
    fetch('/api/metrics/dashboard')
      .then((r) => r.json())
      .then((d) => {
        setBaseline({
          mrr: d.mrr,
          burnRate: d.burnRate,
          cashBalance: d.cashBalance,
          runway: d.runway,
          netBurn: d.netBurn,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const TABS: { id: ScenarioTab; label: string; icon: React.ElementType }[] = [
    { id: 'hire', label: 'Hire', icon: Users },
    { id: 'growth', label: 'Growth', icon: TrendingUp },
    { id: 'fundraise', label: 'Fundraise', icon: DollarSign },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Scenarios</h1>
        <p className="text-sm text-muted-ink mt-0.5">Model decisions before you make them</p>
      </div>

      {/* Baseline */}
      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : baseline && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-hairline bg-white p-4 text-center">
            <p className="text-xs text-muted-ink mb-1">Current MRR</p>
            <p className="text-base font-bold text-navy">{fmt(baseline.mrr)}</p>
          </div>
          <div className="rounded-xl border border-hairline bg-white p-4 text-center">
            <p className="text-xs text-muted-ink mb-1">Monthly burn</p>
            <p className="text-base font-bold text-navy">{fmt(baseline.burnRate)}</p>
          </div>
          <div className="rounded-xl border border-hairline bg-white p-4 text-center">
            <p className="text-xs text-muted-ink mb-1">Runway</p>
            <p className={cn('text-base font-bold', runwayColor(baseline.runway))}>
              {runwayLabel(baseline.runway)}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-xl border border-hairline bg-white overflow-hidden">
        <div className="flex border-b border-hairline/70">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors',
                  tab === t.id
                    ? 'bg-brand-tint text-brand border-b-2 border-brand'
                    : 'text-muted-ink hover:text-navy/80 hover:bg-off-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {!baseline ? (
            <p className="text-sm text-muted-ink/60 text-center py-6">Loading baseline data…</p>
          ) : tab === 'hire' ? (
            <HireScenario baseline={baseline} />
          ) : tab === 'growth' ? (
            <GrowthScenario baseline={baseline} />
          ) : (
            <FundraiseScenario baseline={baseline} />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-ink/60 text-center">
        Projections are estimates based on your current data. Connect more integrations for higher accuracy.
      </p>
    </div>
  )
}
