import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/landing/Hero";
import { TrustedBy } from "@/components/landing/TrustedBy";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { AiAdvisorShowcase } from "@/components/landing/AiAdvisorShowcase";
import { Integrations } from "@/components/landing/Integrations";
import { VerticalsSection } from "@/components/landing/VerticalsSection";
import { InsightsPreview } from "@/components/landing/InsightsPreview";
import { Pricing } from "@/components/landing/Pricing";
import { Testimonials } from "@/components/landing/Testimonials";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finvio — AI-native finance operations for US businesses" },
      {
        name: "description",
        content:
          "Finvio is the AI-powered finance operating system for US LLCs, startups, agencies, and finance teams. Reconciliation, forecasting, tax filings, and treasury in one platform.",
      },
      { property: "og:title", content: "Finvio — AI-native finance operations" },
      {
        property: "og:description",
        content:
          "The operating system for modern capital. Built for US LLCs, startups, and finance teams.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <main>
      <Hero />
      <TrustedBy />
      <FeatureGrid />
      <AiAdvisorShowcase />
      <Integrations />
      <VerticalsSection />
      <InsightsPreview />
      <Pricing />
      <Testimonials />
      <Faq />
      <FinalCta />
    </main>
  );
}
