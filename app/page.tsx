'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  BarChart3, Brain, FileText, Receipt, TrendingUp, Globe,
  ChevronRight, Menu, X, Play, Check, CreditCard, Building2, Layers, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Brain,
    title: 'AI Financial Advisor',
    description: 'Ask anything about your finances in plain English. Get instant answers, log expenses by chatting, and act — all in one interface.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: BarChart3,
    title: 'Revenue Analytics',
    description: 'MRR, ARR, churn, and growth automatically tracked and visualized. Adapts to your business model without any setup.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: FileText,
    title: 'P&L Reports',
    description: 'Month-by-month profit & loss with trend comparison and one-click CSV export. Always up to date.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: Receipt,
    title: 'Expense Management',
    description: 'Track, categorize, and approve expenses. Attach receipts and bills. Full audit trail for every transaction.',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: TrendingUp,
    title: 'Cash Flow Forecast',
    description: 'Model-aware forecasting gives you runway visibility and growth projections based on your real data.',
    color: 'bg-teal-50 text-teal-600',
  },
  {
    icon: Globe,
    title: 'Integrations',
    description: 'Connect Stripe, Plaid, Shopify, PayPal, QuickBooks, and more. Your financial data, unified.',
    color: 'bg-indigo-50 text-indigo-600',
  },
]

const personas = [
  {
    icon: Layers,
    title: 'SaaS Founders',
    description: 'Track MRR, churn, ARR, and runway. Know exactly where your growth is coming from and how long it lasts.',
  },
  {
    icon: Building2,
    title: 'SMB Owners',
    description: 'Simple P&L, cash flow, and expense tracking — without the accounting degree or the big software bill.',
  },
  {
    icon: CreditCard,
    title: 'Agencies & Consultants',
    description: 'Project-level P&L, invoice tracking, and client billing — all connected and automatically categorized.',
  },
]

const integrations = [
  { name: 'Stripe', desc: 'Revenue & payouts' },
  { name: 'Plaid', desc: 'Bank accounts' },
  { name: 'Shopify', desc: 'E-commerce sales' },
  { name: 'PayPal', desc: 'Payments' },
  { name: 'QuickBooks', desc: 'Accounting sync' },
  { name: 'CSV Import', desc: 'Any source' },
]

const chatDemo = [
  { role: 'user', msg: "What's my burn rate this month?" },
  { role: 'ai', msg: "Your burn rate this month is $12,400 — up 8% vs last month. The main driver is SaaS subscriptions (+$900). At this rate, your runway is ~14 months." },
  { role: 'user', msg: "Log a $299 Figma expense for today." },
  { role: 'ai', msg: "Done! Expense logged: $299 for Figma (Software & Tools) on May 5, 2026." },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              Finvio
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
              <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
              <a href="#who-its-for" className="hover:text-gray-900 transition-colors">Who it&apos;s for</a>
              <a href="#integrations" className="hover:text-gray-900 transition-colors">Integrations</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Login
            </Link>
            <Link href="/signup">
              <Button size="sm">Start Free</Button>
            </Link>
            <button
              className="md:hidden p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#who-its-for" className="block text-sm text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Who it&apos;s for</a>
            <a href="#integrations" className="block text-sm text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Integrations</a>
            <Link href="/login" className="block text-sm text-gray-600 hover:text-gray-900">Login</Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 via-white to-white pt-20 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700 mb-8">
            <Zap className="h-3.5 w-3.5" />
            AI-powered financial intelligence
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Know your numbers.<br />
            <span className="text-blue-600">Grow with confidence.</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
            Finvio connects your revenue, expenses, and cash flow in one place — then lets you ask questions in plain English and get instant answers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto gap-2 px-8">
                Start for free
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
                Login
              </Button>
            </Link>
          </div>
          <p className="text-xs text-gray-400">No credit card required · Free forever plan available</p>
        </div>

        {/* Demo video */}
        <div className="max-w-4xl mx-auto mt-14">
          <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-2xl bg-gray-900 aspect-video group">
            {/*
              Replace the src below with your actual demo video URL.
              Example: <source src="https://your-cdn.com/finvio-demo.mp4" type="video/mp4" />
              Or swap the entire block for an <iframe> YouTube/Loom embed.
            */}
            <video
              className="w-full h-full object-cover"
              poster=""
              preload="none"
            >
              {/* <source src="/demo.mp4" type="video/mp4" /> */}
            </video>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-900/80 via-gray-900/60 to-purple-900/80 group-hover:from-blue-900/70 group-hover:to-purple-900/70 transition-all">
              <button
                className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 group-hover:bg-white/30 transition-all mb-4"
                aria-label="Play demo video"
              >
                <Play className="h-7 w-7 text-white fill-white ml-1" />
              </button>
              <p className="text-white font-medium text-sm opacity-80">Watch 2-min product demo</p>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations strip */}
      <section className="py-10 px-4 border-y border-gray-100 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Works with the tools you already use
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {integrations.map(({ name }) => (
              <span key={name} className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything your business needs
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              From AI-powered insights to automated reporting — Finvio replaces the spreadsheets and the manual work.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center mb-4', f.color)}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Advisor highlight */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 mb-6">
              <Brain className="h-3 w-3" />
              AI Advisor
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
              Ask your financials anything
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-8">
              No more hunting through spreadsheets. Just ask: &quot;What was my burn rate last quarter?&quot; or &quot;Log a $500 AWS expense for today&quot; — and Finvio handles it instantly.
            </p>
            <ul className="space-y-3">
              {[
                'Instant financial Q&A in plain English',
                'Create expenses and invoices by chatting',
                'AI adapts to your business model automatically',
                'Full audit trail for every AI-assisted action',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <Check className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href="/signup">
                <Button className="gap-2">
                  Try it free
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Chat illustration */}
          <div className="rounded-2xl border border-blue-100 bg-white shadow-xl overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="ml-2 text-xs text-gray-400">AI Advisor — Finvio</span>
            </div>
            <div className="p-5 space-y-4 min-h-[280px]">
              {chatDemo.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  )}>
                    {m.msg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section id="who-its-for" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Built for how you work
            </h2>
            <p className="text-gray-500 text-lg">
              Finvio detects your business model from your data and adapts — no manual setup required.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {personas.map((p) => (
              <div key={p.title} className="rounded-xl border border-gray-200 bg-white p-8 text-center hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
                  <p.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-3 text-lg">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations detail */}
      <section id="integrations" className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Connect your entire stack
          </h2>
          <p className="text-gray-500 text-lg mb-12">
            One-click integrations with the tools startups and SMBs actually use.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {integrations.map((intg) => (
              <div key={intg.name} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
                <p className="font-semibold text-gray-900 mb-1">{intg.name}</p>
                <p className="text-xs text-gray-500">{intg.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5">
            Ready to understand your finances?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            Join founders and business owners who use Finvio to make faster, smarter financial decisions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 gap-2 px-8 w-full sm:w-auto">
                Start for free
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 w-full sm:w-auto">
                Login
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-blue-200">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center">
              <BarChart3 className="h-3 w-3 text-white" />
            </div>
            Finvio
          </div>
          <p className="text-xs text-gray-400">© 2026 Finvio. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <Link href="/login" className="hover:text-gray-700">Login</Link>
            <Link href="/signup" className="hover:text-gray-700">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
