import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { VerticalsSection } from '@/components/landing/VerticalsSection'
import { FinalCta } from '@/components/landing/FinalCta'

export const metadata = {
  title: 'Features — Finvio',
  description: 'Automated financial syncing, AI transaction categorization, real-time MRR/ARR, invoice management, and workflow automation — built for founders.',
  openGraph: {
    title: 'Features — Finvio',
    description: 'Automated financial syncing, AI transaction categorization, real-time MRR/ARR, invoice management, and workflow automation — built for founders.',
    url: 'https://finvio.ai/features',
    images: [{ url: '/og-features.png', width: 1200, height: 630, alt: 'Finvio Features' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Features — Finvio',
    description: 'Automated financial syncing, AI transaction categorization, real-time MRR/ARR, invoice management, and workflow automation — built for founders.',
    images: ['/og-features.png'],
  },
}

export default function FeaturesPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main>
        {/* Page header */}
        <div className="bg-hero-radial pt-24 pb-4">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <span className="font-mono-eyebrow text-brand">The platform</span>
            <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
              Every primitive a modern{' '}
              <span className="font-serif-italic text-navy/80">finance team needs.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-ink">
              From the first bank connection to the final IRS form — one platform,
              nothing missing, nothing unnecessary.
            </p>
          </div>
        </div>

        <FeatureGrid showHeader={false} />
        <VerticalsSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
