'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from './Logo'

const links = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/insights', label: 'Insights' },
  { href: '/faq', label: 'FAQ' },
]

export function SiteNav() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-hairline bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <div className="hidden items-center gap-7 text-sm font-medium text-muted-ink md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-navy"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-muted-ink transition-colors hover:text-navy sm:inline"
          >
            Login
          </Link>
          <Link
            href="/waitlist"
            className="bg-brand-gradient shadow-brand-glow hidden rounded-md px-4 py-2 text-sm font-semibold text-navy-foreground transition-transform active:scale-[0.98] sm:inline-flex"
          >
            Join Waitlist
          </Link>
          <button
            className="md:hidden p-1.5 text-muted-ink hover:text-navy"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-hairline bg-background px-6 py-4 space-y-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-sm font-medium text-muted-ink hover:text-navy py-1"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="block text-sm font-medium text-muted-ink hover:text-navy py-1"
            onClick={() => setOpen(false)}
          >
            Login
          </Link>
          <Link
            href="/waitlist"
            className="block text-sm font-semibold text-brand py-1"
            onClick={() => setOpen(false)}
          >
            Join Waitlist →
          </Link>
        </div>
      )}
    </nav>
  )
}
