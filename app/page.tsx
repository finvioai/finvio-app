import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { Hero } from '@/components/landing/Hero'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { AiAdvisorShowcase } from '@/components/landing/AiAdvisorShowcase'
import { Integrations } from '@/components/landing/Integrations'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
export default function LandingPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main>
        <Hero />
        {/* TrustedBy — hidden until real customer data is available */}
        {/* Testimonials — hidden until real testimonials are collected */}
        <FeatureGrid />
        <AiAdvisorShowcase />
        <Integrations />
        <Pricing />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  )
}
