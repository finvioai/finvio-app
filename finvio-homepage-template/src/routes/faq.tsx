import { createFileRoute } from "@tanstack/react-router";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Finvio" },
      { name: "description", content: "Answers about Finvio's US entity support, security, AI Advisor capabilities, pricing, and migration." },
      { property: "og:title", content: "FAQ — Finvio" },
      { property: "og:description", content: "Questions, answered." },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <main>
      <section className="border-b border-hairline bg-off-white py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="font-mono-eyebrow text-accent">FAQ</span>
          <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
            Questions, <span className="font-serif-italic">answered.</span>
          </h1>
        </div>
      </section>
      <Faq />
      <FinalCta />
    </main>
  );
}
