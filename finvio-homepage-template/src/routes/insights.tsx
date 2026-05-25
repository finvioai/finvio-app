import { createFileRoute } from "@tanstack/react-router";
import insightMultiEntity from "@/assets/insight-multi-entity.jpg";
import insightRampBrex from "@/assets/insight-ramp-brex.jpg";
import insightAiFinance from "@/assets/insight-ai-finance.jpg";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Finvio" },
      { name: "description", content: "Comparisons, finance guides, and AI operations content for modern US founders and CFOs." },
      { property: "og:title", content: "Insights — Finvio" },
      { property: "og:description", content: "The modern CFO's library on autonomous finance, US tax strategy, and multi-entity ops." },
    ],
  }),
  component: InsightsPage,
});

const featured = {
  tag: "Deep dive",
  title: "The multi-entity paradox: centralizing accounting for global LLC structures.",
  desc: "Managing financial hygiene across borders requires more than spreadsheets. A modern architecture for consolidated ledgers, intercompany flows, and tax nexus mapping.",
  image: insightMultiEntity,
};

const articles = [
  { tag: "Comparison", title: "Ramp vs Brex: the AI treasury breakdown.", image: insightRampBrex },
  { tag: "Intelligence", title: "Best QuickBooks alternatives for AI-native finance teams.", image: insightAiFinance },
  { tag: "Tax advisory", title: "SaaS R&D tax credits: a 2026 survival guide.", image: insightMultiEntity },
  { tag: "Operations", title: "How to close the month in under an hour.", image: insightAiFinance },
  { tag: "Comparison", title: "Mercury vs Brex: choosing the right operating account.", image: insightRampBrex },
  { tag: "Guide", title: "Delaware C-Corp vs Wyoming LLC: founder edition.", image: insightMultiEntity },
];

function InsightsPage() {
  return (
    <main>
      <section className="border-b border-hairline bg-off-white py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="font-mono-eyebrow text-accent">Insights</span>
          <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
            Operational <span className="font-serif-italic">intelligence.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-ink">
            Comparisons, guides, and analyses for modern US finance teams.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <article className="group grid cursor-pointer gap-10 md:grid-cols-2 md:items-center">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-hairline">
              <img src={featured.image} alt="" width={1200} height={900} loading="eager" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
            </div>
            <div>
              <span className="font-mono-eyebrow text-accent">{featured.tag}</span>
              <h2 className="mt-4 text-balance font-serif-italic text-4xl text-navy transition-colors group-hover:text-accent md:text-5xl">
                {featured.title}
              </h2>
              <p className="mt-5 text-muted-ink">{featured.desc}</p>
              <span className="mt-8 inline-flex items-center gap-2 font-mono-eyebrow text-navy">
                Read essay <span aria-hidden>→</span>
              </span>
            </div>
          </article>
        </div>
      </section>

      <section className="border-t border-hairline bg-off-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 flex items-end justify-between border-b border-hairline pb-6">
            <h2 className="text-2xl font-bold text-navy">Library</h2>
            <span className="font-mono-eyebrow text-muted-ink">{articles.length} essays</span>
          </div>
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <article key={a.title} className="group cursor-pointer">
                <div className="aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-hairline">
                  <img src={a.image} alt="" width={800} height={1000} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                </div>
                <div className="mt-5">
                  <span className="font-mono-eyebrow text-accent">{a.tag}</span>
                  <h3 className="mt-3 font-serif-italic text-2xl text-navy transition-colors group-hover:text-accent">
                    {a.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
