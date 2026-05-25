import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { Hero } from '@/components/landing/Hero'
import { TrustedBy } from '@/components/landing/TrustedBy'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { AiAdvisorShowcase } from '@/components/landing/AiAdvisorShowcase'
import { Integrations } from '@/components/landing/Integrations'
import { Testimonials } from '@/components/landing/Testimonials'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { FinalCta } from '@/components/landing/FinalCta'

export default function LandingPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main>
        <Hero />
        <TrustedBy />
        <FeatureGrid />
        <AiAdvisorShowcase />
        <Integrations />
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
