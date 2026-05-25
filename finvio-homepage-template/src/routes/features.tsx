import { createFileRoute } from "@tanstack/react-router";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { AiAdvisorShowcase } from "@/components/landing/AiAdvisorShowcase";
import { Integrations } from "@/components/landing/Integrations";
import { FinalCta } from "@/components/landing/FinalCta";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Finvio" },
      { name: "description", content: "AI advisor, reconciliation, forecasting, tax forms, voice input, and every primitive a modern US finance team needs." },
      { property: "og:title", content: "Features — Finvio" },
      { property: "og:description", content: "Twelve disciplines. One ledger. Zero spreadsheets." },
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <main>
      <section className="border-b border-hairline bg-off-white py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="font-mono-eyebrow text-accent">Platform</span>
          <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
            Every primitive a modern{" "}
            <span className="font-serif-italic">finance team needs.</span>
          </h1>
        </div>
      </section>
      <FeatureGrid />
      <AiAdvisorShowcase />
      <Integrations />
      <FinalCta />
    </main>
  );
}
