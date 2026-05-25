import Link from 'next/link'
import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { FinalCta } from '@/components/landing/FinalCta'

export const metadata = {
  title: 'Insights — Finvio',
  description: 'The modern CFO\'s library on autonomous finance, US tax strategy, and multi-entity ops.',
}

export default function InsightsPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main>
        <div className="bg-hero-radial pt-24 pb-16">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <span className="font-mono-eyebrow text-brand">Insights</span>
            <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
              Operational{' '}
              <span className="font-serif-italic text-navy/80">intelligence.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-ink">
              The modern CFO&apos;s library on autonomous finance, US tax strategy, and multi-entity ops.
            </p>
          </div>
        </div>

        <section className="bg-off-white py-32">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <div className="rounded-2xl border border-hairline bg-background p-16">
              <span className="font-mono-eyebrow text-brand">Coming soon</span>
              <h2 className="mt-4 text-2xl font-extrabold text-navy">
                Articles and guides are on their way.
              </h2>
              <p className="mt-4 text-muted-ink">
                We&apos;re building a library of guides on US entity formation, tax strategy,
                multi-entity accounting, and AI-native finance. Check back soon.
              </p>
              <Link
                href="/"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-lg border border-hairline px-6 text-sm font-bold text-navy transition-colors hover:bg-off-white"
              >
                ← Back to home
              </Link>
            </div>
          </div>
        </section>

        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
