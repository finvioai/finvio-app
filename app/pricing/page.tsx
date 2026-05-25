import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { FinalCta } from '@/components/landing/FinalCta'

export const metadata = {
  title: 'Pricing — Finvio',
  description: 'Free LLC tax submission included on every plan. Scale tiers as your entity grows.',
}

export default function PricingPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main>
        {/* Page header */}
        <div className="bg-hero-radial pt-24 pb-4">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <span className="font-mono-eyebrow text-brand">Pricing</span>
            <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
              Standardized tiers.<br />
              <span className="font-serif-italic text-navy/80">No hidden fees.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-ink">
              Free LLC tax submission included on every plan.
              Scale tiers as your entity grows.
            </p>
          </div>
        </div>

        <Pricing showHeader={false} />
        <Faq showHeader={false} />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
