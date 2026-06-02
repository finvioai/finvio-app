import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { Faq } from '@/components/landing/Faq'
import { FinalCta } from '@/components/landing/FinalCta'

export const metadata = {
  title: 'FAQ — Finvio',
  description: 'Common questions about Finvio — entity types, security, AI Advisor, migration, and more.',
  openGraph: {
    title: 'FAQ — Finvio',
    description: 'Common questions about Finvio — entity types, security, AI Advisor, migration, and more.',
    url: 'https://finvio.ai/faq',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Finvio FAQ' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ — Finvio',
    description: 'Common questions about Finvio — entity types, security, AI Advisor, migration, and more.',
    images: ['/og-default.png'],
  },
}

export default function FaqPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main>
        {/* Page header */}
        <div className="bg-hero-radial pt-24 pb-4">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <span className="font-mono-eyebrow text-brand">FAQ</span>
            <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
              Questions,{' '}
              <span className="font-serif-italic text-navy/80">answered.</span>
            </h1>
          </div>
        </div>

        <Faq showHeader={false} />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
