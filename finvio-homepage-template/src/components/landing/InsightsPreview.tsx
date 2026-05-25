import { Link } from "@tanstack/react-router";
import insightMultiEntity from "@/assets/insight-multi-entity.jpg";
import insightRampBrex from "@/assets/insight-ramp-brex.jpg";
import insightAiFinance from "@/assets/insight-ai-finance.jpg";

const articles = [
  {
    tag: "Comparison",
    title: "Ramp vs Brex: the AI treasury breakdown.",
    desc: "A neutral audit of category mapping, reconciliation speed, and treasury yield.",
    image: insightRampBrex,
  },
  {
    tag: "Guide",
    title: "The founder's guide to multi-entity tax efficiency.",
    desc: "Navigating Delaware C-Corps vs Wyoming LLCs in 2026.",
    image: insightMultiEntity,
  },
  {
    tag: "Intelligence",
    title: "Best QuickBooks alternatives for AI-native finance teams.",
    desc: "Where the legacy ledger ends and autonomous finance begins.",
    image: insightAiFinance,
  },
];

export function InsightsPreview() {
  return (
    <section className="bg-off-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 flex items-end justify-between border-b border-hairline pb-8">
          <div className="max-w-xl">
            <span className="font-mono-eyebrow text-accent">Insights</span>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy">
              Operational <span className="font-serif-italic">intelligence.</span>
            </h2>
            <p className="mt-4 text-muted-ink">
              The modern CFO's library on autonomous finance, US tax strategy, and multi-entity ops.
            </p>
          </div>
          <Link to="/insights" className="hidden font-mono-eyebrow text-navy transition-colors hover:text-accent md:flex md:items-center md:gap-2">
            View library <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {articles.map((a) => (
            <Link key={a.title} to="/insights" className="group block">
              <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-background ring-1 ring-hairline">
                <img
                  src={a.image}
                  alt=""
                  width={800}
                  height={1024}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-6">
                <span className="font-mono-eyebrow text-accent">{a.tag}</span>
                <h3 className="mt-3 font-serif-italic text-2xl text-navy transition-colors group-hover:text-accent">
                  {a.title}
                </h3>
                <p className="mt-3 text-sm text-muted-ink">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
