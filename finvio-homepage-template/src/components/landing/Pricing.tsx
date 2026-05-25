import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

const tiers = [
  {
    name: "Starter",
    price: "$0",
    suffix: "/mo",
    desc: "Single-member LLCs, freelancers, solo operators.",
    features: ["Free LLC tax submission", "1 bank connection", "AI revenue analytics", "Invoices & expenses", "Email support"],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Growth",
    price: "$149",
    suffix: "/mo",
    desc: "Fast-growing startups, agencies, multi-entity operators.",
    features: ["Up to 3 entities", "Advanced AI Advisor", "Real-time tax nexus", "Forecasting & scenarios", "Unlimited integrations", "Priority support"],
    cta: "Start Growth",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    suffix: "",
    desc: "Larger organizations with dedicated treasury operations.",
    features: ["Unlimited entities", "Custom AI model training", "Designated finance ops lead", "Audit-ready reporting", "SOC 2 evidence sharing"],
    cta: "Contact Sales",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <span className="font-mono-eyebrow text-accent">Pricing</span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy md:text-5xl">
            Standardized tiers. <span className="font-serif-italic">No hidden fees.</span>
          </h2>
          <p className="mt-4 text-muted-ink">Engineered to scale with your entity's complexity.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 md:items-start">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-2xl p-8 transition-shadow ${
                t.featured
                  ? "border-2 border-navy bg-background shadow-2xl shadow-navy/10 md:scale-[1.04]"
                  : "border border-hairline bg-background hover:shadow-xl"
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-navy px-3 py-1 font-mono-eyebrow text-navy-foreground">
                  Most Popular
                </span>
              )}
              <div className="font-mono-eyebrow text-muted-ink">{t.name}</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-navy">{t.price}</span>
                <span className="text-lg text-muted-ink">{t.suffix}</span>
              </div>
              <p className="mt-4 text-sm text-muted-ink">{t.desc}</p>
              <ul className="mt-8 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-navy">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className={`mt-10 inline-flex h-12 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                  t.featured
                    ? "bg-navy text-navy-foreground hover:bg-ink"
                    : "border border-hairline text-navy hover:bg-off-white"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
