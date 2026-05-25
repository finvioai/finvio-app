export function AiAdvisorShowcase() {
  return (
    <section className="bg-off-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-16 md:grid-cols-2">
          <div>
            <span className="font-mono-eyebrow text-accent">AI Advisor</span>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy md:text-5xl">
              A CFO that never <br />
              <span className="font-serif-italic">leaves the room.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-ink">
              Voice-enabled financial intelligence that understands complex US tax
              code, multi-entity accounting, and real-time treasury management.
              Just ask.
            </p>
            <div className="mt-10 space-y-5">
              {[
                ["01", "Autonomous reconciliation", "Auto-categorize transactions across 12,000+ banks via Plaid."],
                ["02", "Tax nexus mapping", "Real-time visibility into state-by-state tax obligations."],
                ["03", "Strategic forecasting", "Model hiring, ARR, and runway scenarios in seconds."],
              ].map(([n, t, d]) => (
                <div key={n} className="flex items-start gap-4">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/20 font-mono-eyebrow text-accent">
                    {n}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy">{t}</p>
                    <p className="mt-1 text-sm text-muted-ink">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-navy p-8 shadow-2xl ring-1 ring-navy/5">
            <div className="space-y-5">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-navy-foreground/10 px-4 py-3 text-sm text-navy-foreground">
                  Analyze our exposure to Delaware franchise tax for the new Q3 entity.
                </div>
              </div>
              <div className="space-y-2">
                <div className="rounded-2xl rounded-bl-sm bg-background p-4 text-sm text-navy shadow-lg">
                  The Q3 entity is currently under the minimum asset threshold for Delaware. If you
                  cross $1M in capital, liability increases by <span className="font-semibold">$450/yr</span>.
                  I'd suggest restructuring secondary holdings to a Wyoming holding company.
                </div>
                <div className="flex gap-2">
                  <button className="rounded-full border border-navy-foreground/20 bg-navy-foreground/5 px-3 py-1 font-mono-eyebrow text-navy-foreground">
                    Show analysis
                  </button>
                  <button className="rounded-full border border-navy-foreground/20 bg-navy-foreground/5 px-3 py-1 font-mono-eyebrow text-navy-foreground">
                    Execute move
                  </button>
                  <button className="rounded-full border border-navy-foreground/20 bg-navy-foreground/5 px-3 py-1 font-mono-eyebrow text-navy-foreground">
                    Save scenario
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-navy-foreground/10 px-4 py-3 text-sm text-navy-foreground">
                  Save scenario and notify the CFO.
                </div>
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-background p-4 text-sm text-navy shadow-lg">
                Saved as <span className="font-mono">FY26-Q3-DELAWARE</span>. CFO notified via email and Slack.
              </div>
            </div>
            <div className="mt-6 flex h-12 items-center justify-between rounded-xl border border-navy-foreground/15 bg-navy-foreground/5 px-4">
              <span className="font-mono-eyebrow text-navy-foreground/50">Ask Finvio…</span>
              <span className="flex items-center gap-2 font-mono-eyebrow text-navy-foreground/60">
                <span className="size-1.5 rounded-full bg-accent" /> Voice ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
