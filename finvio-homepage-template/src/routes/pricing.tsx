import { createFileRoute } from "@tanstack/react-router";
import { Pricing } from "@/components/landing/Pricing";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Finvio" },
      { name: "description", content: "Transparent tiers for US LLCs, startups, and enterprises. Free LLC tax submission included on every plan." },
      { property: "og:title", content: "Pricing — Finvio" },
      { property: "og:description", content: "Standardized tiers. No hidden fees." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <main>
      <section className="border-b border-hairline bg-off-white py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="font-mono-eyebrow text-accent">Pricing</span>
          <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
            Priced like <span className="font-serif-italic">infrastructure.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-ink">
            Free LLC tax submission included on every plan. Scale tiers as your entity grows.
          </p>
        </div>
      </section>
      <Pricing />
      <Faq />
      <FinalCta />
    </main>
  );
}
