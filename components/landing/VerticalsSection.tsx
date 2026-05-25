const verticals = [
  { tag: 'SaaS', title: 'MRR, churn, and CAC in one canvas.', desc: 'Cohort revenue and ARR forecasting tuned for subscription businesses.' },
  { tag: 'SMBs', title: 'Bookkeeping that disappears.', desc: 'Automated reconciliation, expense categorization, and tax filings.' },
  { tag: 'Agencies', title: 'Project-level P&L without the spreadsheet stack.', desc: 'Track margin by client, retainer, and engagement in real-time.' },
  { tag: 'Consultants', title: 'Invoice, reconcile, and file — solo.', desc: 'Built for single-member LLCs running multi-client engagements.' },
  { tag: 'Freelancers', title: 'Estimated tax, on autopilot.', desc: 'Quarterly tax provisioning calculated from your actual income.' },
]

export function VerticalsSection() {
  return (
    <section className="bg-navy py-32 text-navy-foreground">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <span className="font-mono-eyebrow text-brand-soft">Adapts to your operating model</span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            Built for every shape of{' '}
            <span className="font-serif-italic">US business.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-navy-foreground/10 ring-1 ring-navy-foreground/10 md:grid-cols-2 lg:grid-cols-3">
          {verticals.map((v) => (
            <div key={v.tag} className="bg-navy p-8 transition-colors hover:bg-ink">
              <span className="font-mono-eyebrow text-brand-soft">{v.tag}</span>
              <h3 className="mt-5 text-xl font-bold leading-snug">{v.title}</h3>
              <p className="mt-3 text-sm text-navy-foreground/60">{v.desc}</p>
            </div>
          ))}
          <div className="flex flex-col justify-between bg-brand/95 p-8 text-navy">
            <div>
              <span className="font-mono-eyebrow">Enterprise</span>
              <h3 className="mt-5 text-xl font-bold leading-snug">
                Designated finance ops lead, on retainer.
              </h3>
            </div>
            <a href="/pricing" className="mt-6 inline-flex items-center gap-2 text-sm font-bold">
              Contact Sales <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
