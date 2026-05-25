export function DashboardMockup() {
  return (
    <div className="shadow-brand-glow relative mx-auto max-w-6xl rounded-2xl border border-hairline bg-background p-3 ring-1 ring-brand/10">
      <div className="flex min-h-[520px] gap-4 overflow-hidden rounded-xl bg-off-white p-4">
        {/* Sidebar */}
        <aside className="hidden w-48 shrink-0 flex-col gap-2 rounded-lg bg-background p-3 ring-1 ring-hairline md:flex">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="size-6 rounded bg-navy" />
            <span className="text-xs font-bold text-navy">Acme Holdings</span>
          </div>
          <div className="mt-2 space-y-1">
            {["Overview", "Treasury", "Reconciliation", "Tax & Forms", "Invoices", "Insights"].map((label, i) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium ${
                  i === 0 ? "bg-navy/5 text-navy" : "text-muted-ink"
                }`}
              >
                <div className="size-1.5 rounded-full bg-current opacity-50" />
                {label}
              </div>
            ))}
          </div>
          <div className="mt-auto rounded-md bg-off-white p-3">
            <div className="font-mono-eyebrow text-muted-ink/60">Tax reserve</div>
            <div className="mt-1 text-sm font-bold text-navy">$128,402</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col gap-4 p-1">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Net Position" value="$1.24M" delta="+12.4%" positive />
            <KpiCard label="Burn Rate" value="$42.1K" delta="Steady" />
            <KpiCard label="Tax Liability" value="$12,402" delta="Provisioned" accent />
          </div>
          <div className="flex-1 rounded-xl bg-background p-5 ring-1 ring-hairline">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-mono-eyebrow text-muted-ink">Revenue analytics</div>
                <div className="mt-1 text-sm font-semibold text-navy">Last 12 months</div>
              </div>
              <div className="flex gap-1">
                {["1M", "3M", "6M", "12M", "ALL"].map((p) => (
                  <span
                    key={p}
                    className={`rounded px-2 py-1 text-[10px] font-semibold ${
                      p === "12M" ? "bg-navy text-navy-foreground" : "text-muted-ink"
                    }`}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <Sparkline />
          </div>
        </main>

        {/* AI Advisor */}
        <aside className="hidden w-64 shrink-0 flex-col rounded-xl bg-navy p-4 text-navy-foreground md:flex">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">AI Advisor</span>
            <span className="flex items-center gap-1 font-mono-eyebrow text-navy-foreground/60">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Live
            </span>
          </div>
          <div className="mt-5 space-y-3 text-[11px] leading-relaxed">
            <div className="rounded-lg bg-navy-foreground/10 p-3">
              Detected 15% AWS spend increase. Reserved instances at 12% utilization — pausing them saves ~$420/mo.
            </div>
            <div className="ml-6 rounded-lg bg-brand p-3 text-navy-foreground">
              Pause them and reallocate to tax reserve.
            </div>
            <div className="rounded-lg bg-navy-foreground/10 p-3">
              Done. $420/mo moved to Q3 tax provision. Want a forecast update?
            </div>
          </div>
          <div className="mt-auto flex h-10 items-center rounded-md border border-navy-foreground/15 bg-navy-foreground/5 px-3 font-mono-eyebrow text-navy-foreground/50">
            Ask anything…
          </div>
        </aside>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  positive,
  accent,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-background p-4 ring-1 ring-hairline">
      <div className="font-mono-eyebrow text-muted-ink">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${accent ? "text-accent" : "text-navy"}`}>
        {value}
      </div>
      <div
        className={`mt-2 text-[10px] font-semibold ${
          positive ? "text-emerald-600" : "text-muted-ink"
        }`}
      >
        {delta}
      </div>
    </div>
  );
}

function Sparkline() {
  // Deterministic path; deep navy stroke + subtle gradient fill
  const points = [10, 18, 14, 24, 22, 32, 28, 40, 36, 48, 45, 58, 54, 70];
  const W = 600;
  const H = 180;
  const max = Math.max(...points);
  const step = W / (points.length - 1);
  const coords = points.map((p, i) => [i * step, H - (p / max) * (H - 20) - 10]);
  const linePath = coords.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full">
      <defs>
        <linearGradient id="fv-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-navy)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-navy)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#fv-grad)" />
      <path d={linePath} fill="none" stroke="var(--color-navy)" strokeWidth="2" />
      {coords.filter((_, i) => i % 3 === 0).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="var(--color-accent)" />
      ))}
    </svg>
  );
}
