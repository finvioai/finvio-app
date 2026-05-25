import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="bg-navy py-20 text-navy-foreground">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <span className="text-2xl font-extrabold tracking-tighter">
              FINVIO<span className="text-brand">.ai</span>
            </span>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-navy-foreground/60">
              Autonomous finance operations for modern capital. Built for US LLCs,
              startups, and growing enterprises.
            </p>
          </div>
          <div>
            <h4 className="font-mono-eyebrow text-brand">Product</h4>
            <ul className="mt-6 space-y-3 text-sm text-navy-foreground/70">
              <li><Link href="/features" className="hover:text-navy-foreground transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-navy-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/insights" className="hover:text-navy-foreground transition-colors">Insights</Link></li>
              <li><Link href="/faq" className="hover:text-navy-foreground transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono-eyebrow text-brand">Company</h4>
            <ul className="mt-6 space-y-3 text-sm text-navy-foreground/70">
              <li><a href="#" className="hover:text-navy-foreground transition-colors">About</a></li>
              <li><a href="#" className="hover:text-navy-foreground transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-navy-foreground transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-navy-foreground transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-20 flex flex-col items-center justify-between gap-4 border-t border-navy-foreground/10 pt-10 md:flex-row">
          <p className="font-mono-eyebrow text-navy-foreground/40">© 2026 Finvio Technologies Inc.</p>
          <div className="flex gap-3">
            <span className="rounded border border-navy-foreground/15 px-2 py-1 font-mono-eyebrow text-navy-foreground/50">SOC 2 Type II</span>
            <span className="rounded border border-navy-foreground/15 px-2 py-1 font-mono-eyebrow text-navy-foreground/50">256-bit Encryption</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
