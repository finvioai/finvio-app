import Link from 'next/link'
import Image from 'next/image'
import { DashboardMockup } from './DashboardMockup'

export function Hero() {
  return (
    <header className="bg-hero-radial relative overflow-hidden pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-6 lg:pl-20 lg:pr-6">

        {/* Two-column split: stacked on mobile, side-by-side on lg+ */}
        <div className="animate-reveal flex flex-col items-center lg:flex-row lg:items-center lg:gap-12 xl:gap-20">

          {/* Left column — text & CTAs */}
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-background/70 px-3 py-1 font-mono-eyebrow text-brand backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand" />
              Built for US LLCs &amp; foreign-owned entities
            </span>
            <h1 className="max-w-xl text-5xl font-extrabold leading-[1.05] tracking-tight text-navy lg:text-6xl xl:text-7xl">
              The <span className="text-brand-gradient">AI CFO</span> for
              <br />
              <span className="font-serif-italic text-navy/85">modern founders.</span>
            </h1>
            <p className="mt-7 max-w-lg text-pretty text-lg leading-relaxed text-muted-ink">
              Centralize your company finances across banking, accounting, payments,
              compliance, and tax workflows with AI-powered operations.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
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
          </div>

          {/* Right column — ecosystem illustration */}
          <div className="mt-12 flex flex-1 items-center justify-center lg:mt-0">
            <Image
              src="/illustrate.webp"
              alt="Finvio financial ecosystem connecting banking, accounting, and payments securely"
              width={4096}
              height={2940}
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="h-auto w-full max-w-full"
            />
          </div>
        </div>

        {/* Trust line — sits below the split on all screen sizes */}
        <p className="mt-8 text-center font-mono-eyebrow text-muted-ink/70">
          FORM 5472 SUPPORT • ENCRYPTED DATA • SECURE BANK CONNECTIONS
        </p>

        {/* Dashboard mockup */}
        <div className="animate-reveal mt-20 hidden sm:block" style={{ animationDelay: '200ms' }}>
          <DashboardMockup />
        </div>
      </div>
    </header>
  )
}
