const integrations = [
  { name: 'Mercury', desc: 'Business banking' },
  { name: 'Stripe', desc: 'Payments & subscriptions' },
  { name: 'Brex', desc: 'Corporate cards' },
  { name: 'Wise', desc: 'Cross-border FX' },
  { name: 'Plaid', desc: '12,000+ bank feeds' },
  { name: 'PayPal', desc: 'Payouts & receivables' },
  { name: 'Shopify', desc: 'Commerce revenue' },
  { name: 'QuickBooks', desc: 'Legacy ledger sync' },
]

export function Integrations() {
  return (
    <section className="bg-off-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <span className="font-mono-eyebrow text-brand">Every revenue source. One ledger.</span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy md:text-5xl">
            Connect everything in{' '}
            <span className="font-serif-italic text-navy/80">under five minutes.</span>
          </h2>
          <p className="mt-5 text-muted-ink">
            Banking, cards, payments, FX, and accounting — Finvio pulls every dollar in
            and out of your entities into a single, AI-classified source of truth.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-hairline ring-1 ring-hairline md:grid-cols-4">
          {integrations.map((i) => (
            <div
              key={i.name}
              className="group flex flex-col items-center justify-center gap-2 bg-background p-10 text-center transition-colors hover:bg-brand-tint/60"
            >
              <span className="text-2xl font-bold tracking-tighter text-navy transition-colors group-hover:text-brand">
                {i.name}
              </span>
              <span className="text-xs text-muted-ink">{i.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
