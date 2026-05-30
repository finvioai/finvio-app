'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  {
    q: 'Which US entity types does Finvio support?',
    a: 'Single and multi-member LLCs, C-Corps, S-Corps, and sole proprietorships. We support Delaware, Wyoming, and all 50 states for filings.',
  },
  {
    q: 'How does the free LLC tax submission work?',
    a: 'Every Finvio account includes annual federal filing for a single US LLC at no charge. Multi-entity filings are included on Growth and Enterprise.',
  },
  {
    q: 'Is my financial data secure?',
    a: "Finvio uses 256-bit encryption at rest and in transit, and never trains models on your data.",
  },
  {
    q: 'Can the AI Advisor act on my behalf?',
    a: 'By default the Advisor is advisory only. You can grant scoped autonomous actions per workflow — reconciliation, invoicing, or tax provisioning.',
  },
  {
    q: 'Do you replace my accountant?',
    a: 'Finvio augments your accountant. We close the books, file taxes, and surface insights — your CPA reviews and signs off.',
  },
  {
    q: 'What does migration look like?',
    a: 'Finvio imports historical data from QuickBooks, Xero, Stripe, and Plaid in under an hour. Most teams are fully migrated within a week.',
  },
]

export function Faq({ showHeader = true }: { showHeader?: boolean }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-off-white py-32">
      <div className="mx-auto max-w-3xl px-6">
        {showHeader && (
          <div className="mb-12 text-center">
            <span className="font-mono-eyebrow text-brand">FAQ</span>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-navy md:text-5xl">
              Questions, <span className="font-serif-italic">answered.</span>
            </h2>
          </div>
        )}
        <div className="divide-y divide-hairline">
          {faqs.map((f, i) => (
            <div key={i}>
              <button
                className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold text-navy"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                {f.q}
                {open === i ? (
                  <Minus className="size-4 shrink-0 text-brand" />
                ) : (
                  <Plus className="size-4 shrink-0 text-muted-ink" />
                )}
              </button>
              {open === i && (
                <p className="pb-5 text-sm leading-relaxed text-muted-ink">{f.a}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-hairline bg-background p-8">
          <h3 className="text-lg font-bold text-navy">Still have a question?</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-ink">
            Can&apos;t find the answer you&apos;re looking for? Send us an email and we&apos;ll
            get back to you as soon as possible.
          </p>
          <div className="mt-6 flex justify-center">
            <a
              href="mailto:hello@finvio.ai"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-navy px-6 text-sm font-semibold text-navy-foreground transition-colors hover:bg-ink"
            >
              Send email
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
