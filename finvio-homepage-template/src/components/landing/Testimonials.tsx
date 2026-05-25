const quotes = [
  {
    quote: "Finvio collapsed our finance stack from seven tools to one. The AI advisor catches things our controller would have missed.",
    name: "Maya Chen",
    role: "CFO, Stratos Labs",
  },
  {
    quote: "We onboarded three subsidiaries in a weekend. The multi-entity tax engine alone paid for the year.",
    name: "Daniel Reyes",
    role: "Founder, Equity.One",
  },
  {
    quote: "Project-level P&L by client, automatically. It's the first finance product that actually understands agency work.",
    name: "Priya Anand",
    role: "Owner, Foundry Agency",
  },
];

export function Testimonials() {
  return (
    <section className="border-t border-hairline bg-background py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <span className="font-mono-eyebrow text-accent">Operators on Finvio</span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy md:text-5xl">
            Trusted by founders, <br /> CFOs, and{" "}
            <span className="font-serif-italic">finance teams.</span>
          </h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {quotes.map((q) => (
            <figure key={q.name} className="flex flex-col rounded-2xl border border-hairline p-8">
              <span className="font-serif-italic text-5xl leading-none text-accent">"</span>
              <blockquote className="mt-2 flex-1 text-base leading-relaxed text-navy">
                {q.quote}
              </blockquote>
              <figcaption className="mt-8 border-t border-hairline pt-5">
                <div className="text-sm font-semibold text-navy">{q.name}</div>
                <div className="text-xs text-muted-ink">{q.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
