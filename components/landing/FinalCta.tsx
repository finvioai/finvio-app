import Link from 'next/link'

export function FinalCta() {
  return (
    <section className="bg-background py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="bg-brand-gradient shadow-brand-glow relative isolate overflow-hidden rounded-3xl px-10 py-20 text-center text-navy-foreground md:px-20">
          <div
            className="absolute inset-0 -z-0 opacity-30"
            style={{
              background:
                'radial-gradient(50% 60% at 20% 0%, oklch(0.85 0.12 250 / 0.5) 0%, transparent 70%), radial-gradient(40% 50% at 90% 100%, oklch(0.6 0.19 258 / 0.6) 0%, transparent 70%)',
            }}
          />
          <span className="relative font-mono-eyebrow text-navy-foreground/80">The Finvio Standard</span>
          <h2 className="relative mx-auto mt-5 max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Your AI CFO is{' '}
            <span className="font-serif-italic">one connection away.</span>
          </h2>
          <p className="relative mx-auto mt-6 max-w-xl text-pretty text-navy-foreground/80">
            Connect your bank, sync your stack, and let Finvio run the books, the forms, and the filings.
          </p>
          <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="relative h-12 inline-flex items-center justify-center rounded-lg bg-background px-8 text-sm font-bold text-navy shadow-xl transition-transform active:scale-[0.98]"
            >
              Open an Account
            </Link>
            <a
              href="mailto:hello@finvio.ai"
              className="h-12 inline-flex items-center justify-center rounded-lg border border-navy-foreground/20 px-8 text-sm font-bold text-navy-foreground hover:bg-navy-foreground/5"
            >
              Talk to Sales
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
