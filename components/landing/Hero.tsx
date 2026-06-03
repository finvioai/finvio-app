import Link from 'next/link'
import { DashboardMockup } from './DashboardMockup'

export function Hero() {
  return (
    <header className="bg-hero-radial relative overflow-hidden pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <div className="animate-reveal">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-background/70 px-3 py-1 font-mono-eyebrow text-brand backdrop-blur">
            <span className="size-1.5 rounded-full bg-brand" />
            Built for US LLCs &amp; foreign-owned entities
          </span>
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight text-navy md:text-7xl">
            The <span className="text-brand-gradient">AI CFO</span> for
            <br />
            <span className="font-serif-italic text-navy/85">modern founders.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-muted-ink">
            Centralize your company finances across banking, accounting, payments,
            compliance, and tax workflows with AI-powered operations.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="bg-brand-gradient shadow-brand-glow h-12 inline-flex items-center justify-center rounded-lg px-8 text-sm font-bold text-navy-foreground transition-transform active:scale-[0.98]"
            >
              Start Free | Connect Your Bank
            </Link>
            <a
              href="mailto:hello@finvio.ai"
              className="h-12 inline-flex items-center justify-center rounded-lg border border-hairline bg-background/80 px-8 text-sm font-bold text-navy backdrop-blur transition-colors hover:bg-off-white"
            >
              Talk to Sales
            </a>
          </div>
          <p className="mt-5 font-mono-eyebrow text-muted-ink/70">
            FORM 5472 SUPPORT • ENCRYPTED DATA • SECURE BANK CONNECTIONS
          </p>
        </div>

        <div className="animate-reveal mt-20 hidden sm:block" style={{ animationDelay: '200ms' }}>
          <DashboardMockup />
        </div>
      </div>
    </header>
  )
}
