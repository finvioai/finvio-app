import Link from 'next/link'

const articles = [
  {
    tag: 'Comparison',
    title: 'Ramp vs Brex: the AI treasury breakdown.',
    desc: 'A neutral audit of category mapping, reconciliation speed, and treasury yield.',
    bg: 'from-brand/20 to-navy/30',
  },
  {
    tag: 'Guide',
    title: "The founder's guide to multi-entity tax efficiency.",
    desc: 'Navigating Delaware C-Corps vs Wyoming LLCs in 2026.',
    bg: 'from-navy/20 to-brand/20',
  },
  {
    tag: 'Intelligence',
    title: 'Best QuickBooks alternatives for AI-native finance teams.',
    desc: 'Where the legacy ledger ends and autonomous finance begins.',
    bg: 'from-brand-soft/30 to-brand/20',
  },
]

export function InsightsPreview() {
  return (
    <section className="bg-off-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 flex items-end justify-between border-b border-hairline pb-8">
          <div className="max-w-xl">
            <span className="font-mono-eyebrow text-brand">Insights</span>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy">
              Operational <span className="font-serif-italic">intelligence.</span>
            </h2>
            <p className="mt-4 text-muted-ink">
              The modern CFO&apos;s library on autonomous finance, US tax strategy, and multi-entity ops.
            </p>
          </div>
          <Link
            href="/insights"
            className="hidden font-mono-eyebrow text-navy transition-colors hover:text-brand md:flex md:items-center md:gap-2"
          >
            View library <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {articles.map((a) => (
            <Link key={a.title} href="/insights" className="group block">
              <div className={`aspect-[3/4] w-full overflow-hidden rounded-xl bg-gradient-to-br ${a.bg} ring-1 ring-hairline flex items-end p-6`}>
                <div className="rounded-lg bg-background/80 backdrop-blur-sm p-4">
                  <span className="font-mono-eyebrow text-brand">{a.tag}</span>
                  <p className="mt-2 text-sm font-semibold text-navy leading-snug">{a.title}</p>
                </div>
              </div>
              <div className="mt-6">
                <span className="font-mono-eyebrow text-brand">{a.tag}</span>
                <h3 className="mt-3 font-serif-italic text-2xl text-navy transition-colors group-hover:text-brand">
                  {a.title}
                </h3>
                <p className="mt-3 text-sm text-muted-ink">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
