export function Pricing({
  showHeader = true,
}: {
  showHeader?: boolean
  description?: string
}) {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        {showHeader && (
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <span className="font-mono-eyebrow text-brand">Pricing</span>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy md:text-5xl">
              Standardized tiers.<br />
              <span className="font-serif-italic">No hidden fees.</span>
            </h2>
          </div>
        )}

        <div className="mx-auto max-w-xl rounded-2xl border border-hairline bg-background p-12 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
            <svg className="h-7 w-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-extrabold text-navy">Pricing announced at launch.</h3>
          <p className="mt-4 text-pretty text-muted-ink">
            We&apos;re in private beta. Pricing will be announced when we open to the public.
            Early waitlist members get priority access and founding rates.
          </p>
          <a
            href="mailto:hello@finvio.ai"
            className="mt-8 inline-flex h-11 items-center justify-center rounded-lg border border-hairline px-6 text-sm font-semibold text-navy transition-colors hover:bg-off-white"
          >
            Contact us — hello@finvio.ai
          </a>
        </div>
      </div>
    </section>
  )
}
