import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Private Beta — Finvio',
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white px-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 h-8 bg-brand/15 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tighter text-navy">
            FINVIO<span className="text-brand">.ai</span>
          </span>
        </div>

        <div className="rounded-2xl border border-hairline bg-white px-8 py-10 shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <svg className="h-6 w-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-navy">Finvio is currently in private beta.</h1>
          <p className="text-sm leading-relaxed text-muted-ink">
            Join the waitlist to get early access when we open to the public.
          </p>

          <Link
            href="/waitlist"
            className="bg-brand-gradient shadow-brand-glow mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-bold text-navy-foreground transition-transform active:scale-[0.98]"
          >
            Join the Waitlist
          </Link>

          <p className="text-xs text-muted-ink/70">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand hover:text-navy">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
