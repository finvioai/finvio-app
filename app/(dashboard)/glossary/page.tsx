import { BookOpen, ChevronDown } from 'lucide-react'

interface Term {
  term: string
  tagline: string
  formula?: string
  body: string[]
  example?: string
  note?: string
}

const terms: Term[] = [
  {
    term: 'MRR — Monthly Recurring Revenue',
    tagline: 'The predictable monthly revenue from active subscriptions.',
    formula: 'MRR = SUM(active subscription amounts, normalised to monthly)',
    body: [
      'Annual subscriptions are converted: annual price ÷ 12.',
      'If no Stripe subscription data exists, Finvio falls back to income transactions for the month — excluding income tagged as one-time, and normalising annual income (÷ 12) and quarterly income (÷ 3).',
    ],
    example: '$500/month sub + $1,200/year sub → MRR = $500 + $100 = $600',
    note: 'Connect Stripe for the most accurate MRR. The transaction fallback is an estimate and warns you when it is being used.',
  },
  {
    term: 'ARR — Annual Recurring Revenue',
    tagline: 'Your MRR projected over a full year.',
    formula: 'ARR = MRR × 12',
    body: [
      'Derived directly from MRR with no extra database query.',
    ],
    example: 'MRR = $5,000 → ARR = $60,000',
  },
  {
    term: 'Burn Rate',
    tagline: 'The normalised monthly cost of running the business.',
    formula: 'Burn Rate = monthly expenses + (avg quarterly spend ÷ 3) + (avg annual spend ÷ 12)',
    body: [
      '• Monthly — averaged over the distinct months in the last 3 months that had expenses. A new $20/month subscription in month 1 adds $20, not $6.67.',
      '• Quarterly — average quarterly spend (last 12 months) ÷ 3.',
      '• Annual — average annual spend (last 12 months) ÷ 12.',
      '• One-time — excluded. Reported separately as a dashboard warning.',
      '• Not tagged — excluded. A warning lists untagged expenses so you can tag them.',
    ],
    example: '$2,000/month payroll + $1,200/year AWS + $800 laptop (one-time) → Burn Rate = $2,000 + $100 = $2,100. Laptop excluded.',
    note: 'Untagged expenses are excluded from burn rate — not assumed to be monthly. Tag every expense so the number is accurate.',
  },
  {
    term: 'Cash Balance',
    tagline: 'How much cash is available right now.',
    body: [
      'Priority 1 — If Plaid is connected, uses the live bank balance. Most accurate.',
      'Priority 2 — Calculates SUM(income) − SUM(expenses) from transactions. This is a ledger estimate, not a bank balance.',
    ],
    note: 'Connect Plaid for real-time accuracy. Without it, a warning appears on the dashboard.',
  },
  {
    term: 'Net Burn',
    tagline: 'How much cash you are actually losing (or gaining) each month.',
    formula: 'Net Burn = Burn Rate − MRR',
    body: [
      'Positive → spending more than earning, consuming cash.',
      'Zero or negative → revenue covers costs; runway is infinite.',
    ],
    example: 'Burn Rate $3,000 − MRR $2,000 = Net Burn $1,000/month',
  },
  {
    term: 'Runway',
    tagline: 'How many months of cash remain at the current burn rate.',
    formula: 'Runway = Cash Balance ÷ Net Burn (whole months)',
    body: [
      'Returns "Infinite" when Net Burn ≤ 0 (profitable).',
      'Returns 0 when Cash Balance ≤ 0.',
    ],
    example: 'Cash $120,000 ÷ Net Burn $10,000 = 12 months',
    note: 'Only as accurate as your cash balance and burn rate. Tag expenses and connect Plaid for the most reliable figure.',
  },
  {
    term: 'Total Revenue',
    tagline: 'All money received this month, regardless of type.',
    formula: 'Total Revenue = SUM(all income transactions in the month)',
    body: [
      'Unlike MRR, this includes one-time payments, project invoices, milestones, and consulting fees.',
      'The primary metric for SMB and project-based businesses.',
    ],
  },
  {
    term: 'Gross Profit',
    tagline: 'Revenue minus expenses for the month.',
    formula: 'Gross Profit = Total Revenue − Total Expenses',
    body: [
      'Can be negative (a loss). Uses raw transaction totals, not burn rate normalisation.',
    ],
  },
  {
    term: 'Churn Rate',
    tagline: 'The fraction of subscriptions cancelled in a given month.',
    formula: 'Churn Rate = Cancelled ÷ Active at start of month',
    body: [
      'Expressed as a decimal (0.05 = 5% churn). Returns 0 with no subscription data.',
    ],
    example: '100 active, 5 cancelled → 5% churn',
    note: 'Requires Stripe to be connected.',
  },
  {
    term: 'Average Monthly Revenue',
    tagline: 'A smoothed baseline for non-SaaS businesses.',
    formula: 'Avg Monthly Revenue = SUM(revenue, active months) ÷ count(months with revenue > 0)',
    body: [
      'Only months that actually had income count toward the divisor.',
      'A business in its first month gets its real monthly revenue — not one-third of it due to two empty lookback months.',
    ],
    example: 'Month 1: $5,000. Months 2–3: $0 (not yet started). Avg = $5,000 ÷ 1 = $5,000. Not $5,000 ÷ 3 = $1,667.',
    note: 'Used as the forecast baseline for SMB and project-based businesses instead of MRR.',
  },
  {
    term: 'Recurrence Types',
    tagline: 'How Finvio classifies expenses and income for accurate calculations.',
    body: [
      'For expenses:',
      '• Monthly — recurs every month. Burn rate averages over months that actually had the expense.',
      '• Quarterly — recurs every quarter. Normalised to monthly (÷ 3).',
      '• Annual — recurs yearly. Normalised to monthly (÷ 12).',
      '• One-time — non-recurring. Excluded from burn rate; shown as a separate warning.',
      '• Not tagged — excluded from burn rate with a warning.',
      'For income (affects MRR fallback when Stripe is not connected):',
      '• Monthly / not tagged — included in MRR at full amount.',
      '• Quarterly — normalised to monthly (÷ 3).',
      '• Annual — normalised to monthly (÷ 12).',
      '• One-time — excluded from MRR (a one-off payment is not recurring revenue).',
    ],
    note: 'Tag every expense and income. Untagged expenses are excluded from burn rate. One-time income is excluded from MRR.',
  },
  {
    term: 'Data Completeness',
    tagline: 'A score showing how reliable your financial data is.',
    body: [
      '• Stripe connected: +30 pts',
      '• Plaid connected: +30 pts',
      '• Shopify connected: +10 pts',
      '• PayPal connected: +10 pts',
      '• Manual transactions exist: +10 pts',
      '• CSV import exists: +10 pts',
      'Low scores generate warnings shown in the dashboard and AI Advisor.',
    ],
    note: 'Warnings do not block Finvio — they indicate which numbers are estimates.',
  },
]

function TermAccordion({ term, tagline, formula, body, example, note }: Term) {
  return (
    <details className="group rounded-xl border border-hairline bg-white overflow-hidden">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 hover:bg-off-white transition-colors list-none">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-navy">{term}</span>
          <span className="ml-2 text-sm text-muted-ink/60">— {tagline}</span>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-ink/60 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-hairline/70 px-5 py-4 space-y-3">
        {formula && (
          <div className="rounded-md bg-off-white border border-hairline px-4 py-2.5">
            <p className="text-xs font-mono text-navy/80">{formula}</p>
          </div>
        )}

        <div className="space-y-1.5">
          {body.map((line, i) => (
            <p key={i} className="text-sm text-navy/80 leading-relaxed">{line}</p>
          ))}
        </div>

        {example && (
          <div className="rounded-md bg-brand-tint border border-brand/15 px-4 py-2.5">
            <p className="text-xs font-semibold text-navy mb-0.5">Example</p>
            <p className="text-sm text-brand">{example}</p>
          </div>
        )}

        {note && (
          <div className="rounded-md bg-amber-50 border border-amber-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-amber-800 mb-0.5">Note</p>
            <p className="text-sm text-amber-700">{note}</p>
          </div>
        )}
      </div>
    </details>
  )
}

export default function GlossaryPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <BookOpen className="h-6 w-6 text-brand" />
        <h1 className="text-2xl font-bold text-navy">Metrics Glossary</h1>
      </div>
      <p className="text-sm text-muted-ink mb-6">
        Click any term to see how it is calculated.
      </p>

      <div className="space-y-2">
        {terms.map((t) => (
          <TermAccordion key={t.term} {...t} />
        ))}
      </div>
    </div>
  )
}
