import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { LaunchListWidget } from '@/components/landing/LaunchListWidget'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join the Waitlist — Finvio',
  description:
    'Get early access to Finvio — the AI CFO built for modern founders. Join thousands of founders on the waitlist.',
  openGraph: {
    title: 'Join the Waitlist — Finvio',
    description: 'Get early access to Finvio, the AI CFO for modern founders.',
    url: 'https://finvio.ai/waitlist',
  },
}

export default function WaitlistPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main className="flex min-h-[80vh] flex-col items-center justify-center bg-hero-radial px-6 py-24">
        <div className="mx-auto w-full max-w-2xl text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-background/70 px-3 py-1 font-mono-eyebrow text-brand backdrop-blur">
            <span className="size-1.5 rounded-full bg-brand" />
            Early Access
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-navy md:text-6xl">
            Your AI CFO is{' '}
            <span className="font-serif-italic">almost ready.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-ink">
            Finvio is rolling out to a limited group of founders first. Drop your email
            and we&apos;ll let you know the moment your spot is ready.
          </p>

          <div className="mx-auto mt-12 w-full max-w-md">
            <LaunchListWidget />
          </div>

          <ul className="mt-10 flex flex-col items-center justify-center gap-4 text-sm text-muted-ink sm:flex-row sm:gap-8">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-brand" />
              Free during early access
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-brand" />
              No credit card required
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-brand" />
              Cancel anytime
            </li>
          </ul>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
