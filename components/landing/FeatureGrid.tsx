import {
  Landmark, Brain, Users, FileSpreadsheet, Send,
  CalendarClock, MessageSquareText, ScrollText, Layers, UserCheck,
} from 'lucide-react'

const features = [
  {
    icon: Landmark,
    title: 'Bank, card & payment connections',
    desc: 'Mercury, Stripe, Wise, PayPal, Brex, Plaid — one unified ledger across every source of revenue and spend.',
  },
  {
    icon: Brain,
    title: 'AI transaction classifier',
    desc: 'Auto-categorize every transaction against a foreign-LLC chart of accounts — with reasoning, not guesses.',
  },
  {
    icon: Users,
    title: 'Per-owner capital account tracker',
    desc: 'Real-time equity, distributions, and contributions tracked per member across every entity you own.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Form 5472 + pro forma 1120 + 7004',
    desc: 'Generate audit-ready IRS forms in minutes — pre-validated against the latest filing rules.',
  },
  {
    icon: Send,
    title: 'IRS fax & mail delivery',
    desc: "Forms that can't be e-filed are faxed and mailed for you, with delivery receipts on file.",
  },
  {
    icon: CalendarClock,
    title: 'Compliance calendar',
    desc: 'Federal, state, and franchise deadlines auto-tracked per entity with proactive alerts.',
  },
  {
    icon: MessageSquareText,
    title: 'AI CFO chat',
    desc: 'Ask "is this reportable?", "what\'s my exposure?", or drop a quote PDF — get an invoice back instantly.',
  },
  {
    icon: ScrollText,
    title: 'Audit-ready transaction log',
    desc: 'Every classification, edit, and decision logged with AI reasoning — defensible by default.',
  },
  {
    icon: Layers,
    title: 'Multi-entity dashboard',
    desc: 'One founder, 2–3 LLCs. Switch context in one click, or view consolidated finances across all of them.',
  },
  {
    icon: UserCheck,
    title: 'CPA review handoff',
    desc: 'Optional human CPA review layer for filings — liability covered, signed off, and delivered.',
  },
]

export function FeatureGrid({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <section id="features" className="relative py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-brand-tint to-transparent" />
      <div className="mx-auto max-w-7xl px-6">
        {showHeader && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <span className="font-mono-eyebrow text-brand">The platform</span>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy md:text-5xl">
              Ten primitives.{' '}
              <span className="font-serif-italic text-navy/80">One finance brain.</span>
            </h2>
            <p className="mt-5 text-pretty text-muted-ink">
              Everything a founder running US entities needs — from the first bank
              connection to the final IRS form. Nothing they don&apos;t.
            </p>
          </div>
        )}

        {/* Mobile: horizontal snap-scroll carousel */}
        <div className="sm:hidden">
          <div
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="w-[78vw] max-w-[300px] flex-shrink-0 snap-start rounded-2xl border border-hairline bg-background p-6"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-gradient text-navy-foreground shadow-brand-glow">
                  <Icon className="size-4" strokeWidth={1.75} />
                </div>
                <span className="font-mono-eyebrow text-muted-ink/40">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 text-sm font-bold text-navy">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-ink">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center font-mono-eyebrow text-muted-ink/40">swipe to explore</p>
        </div>

        {/* Desktop: original grid */}
        <div className="hidden sm:grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-hairline ring-1 ring-hairline lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }, i) => {
            const isLastLonely = i === features.length - 1 && features.length % 3 === 1
            return (
              <div
                key={title}
                className={`group relative bg-background p-7 transition-colors hover:bg-brand-tint/60 ${
                  isLastLonely ? 'lg:col-span-3' : ''
                }`}
              >
                <div className="mb-5 flex size-11 items-center justify-center rounded-lg bg-brand-gradient text-navy-foreground shadow-brand-glow">
                  <Icon className="size-5" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-bold text-navy">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-ink">{desc}</p>
                <span className="absolute right-5 top-5 font-mono-eyebrow text-muted-ink/40">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
