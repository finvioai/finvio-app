const logos = ['STRATOS', 'EQUITY.ONE', 'CORE_BASE', 'NEO VENTURES', 'FOUNDRY', 'HALCYON']

export function TrustedBy() {
  return (
    <section className="border-y border-hairline bg-off-white/50 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center font-mono-eyebrow text-muted-ink/60">
          Institutional trust · trusted by 2,400+ US entities
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-14 gap-y-6 opacity-60">
          {logos.map((l) => (
            <span key={l} className="text-xl font-bold tracking-tighter text-navy/70">
              {l}
            </span>
          ))}
        </div>
        <div className="mt-14 grid grid-cols-2 gap-y-8 border-t border-hairline pt-10 md:grid-cols-4">
          {[
            ['$4.2B', 'Capital under operation'],
            ['99.98%', 'Reconciliation accuracy'],
            ['48s', 'Avg. AI advisor response'],
            ['2,400+', 'US LLCs onboarded'],
          ].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-navy md:text-4xl">{v}</div>
              <div className="mt-2 text-xs text-muted-ink">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
