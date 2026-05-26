import Link from 'next/link'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { FinalCta } from '@/components/landing/FinalCta'
import { InsightCard } from '@/components/insights/InsightCard'
import { InsightsFilter } from '@/components/insights/InsightsFilter'
import { getInsights, getCategories, PER_PAGE } from '@/sanity/lib/queries'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Insights — Finvio',
  description: "The modern CFO's library on autonomous finance, US tax strategy, and multi-entity ops.",
  openGraph: {
    title: 'Insights — Finvio',
    description: "The modern CFO's library on autonomous finance, US tax strategy, and multi-entity ops.",
  },
}

interface PageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))

  const [{ insights, total, pages }, categories] = await Promise.all([
    getInsights({ category: params.category, q: params.q, page }),
    getCategories(),
  ])

  const hasNextPage = page < pages
  const hasPrevPage = page > 1
  const activeCategory = categories.find((c) => c.slug === params.category)

  return (
    <div data-landing>
      <SiteNav />
      <main>
        {/* Hero */}
        <div className="bg-hero-radial pt-24 pb-16">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <span className="font-mono-eyebrow text-brand">Insights</span>
            <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-navy md:text-6xl">
              Operational{' '}
              <span className="font-serif-italic text-navy/80">intelligence.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-ink">
              The modern CFO&apos;s library on autonomous finance, US tax strategy, and multi-entity ops.
            </p>
          </div>
        </div>

        <section className="bg-off-white py-16">
          <div className="mx-auto max-w-7xl px-6">
            {/* Filter bar */}
            <Suspense fallback={null}>
              <InsightsFilter categories={categories} />
            </Suspense>

            {/* Active filter label */}
            {(activeCategory || params.q) && (
              <p className="mt-6 text-sm text-muted-ink">
                {params.q && !activeCategory && (
                  <>Results for <span className="font-semibold text-navy">&ldquo;{params.q}&rdquo;</span></>
                )}
                {activeCategory && !params.q && (
                  <>Category: <span className="font-semibold text-navy">{activeCategory.title}</span></>
                )}
                {activeCategory && params.q && (
                  <><span className="font-semibold text-navy">{activeCategory.title}</span> — <span className="font-semibold text-navy">&ldquo;{params.q}&rdquo;</span></>
                )}
                {total > 0 && (
                  <span className="ml-2 text-muted-ink/60">({total} article{total !== 1 ? 's' : ''})</span>
                )}
              </p>
            )}

            {/* Grid */}
            {insights.length > 0 ? (
              <>
                {/* Feature top article on first page with no filters */}
                {page === 1 && !params.q && !params.category && insights.length > 0 && (
                  <div className="mt-10">
                    <InsightCard insight={insights[0]} featured />
                  </div>
                )}

                <div className={`mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${page === 1 && !params.q && !params.category ? '' : 'mt-10'}`}>
                  {(page === 1 && !params.q && !params.category ? insights.slice(1) : insights).map((insight) => (
                    <InsightCard key={insight._id} insight={insight} />
                  ))}
                </div>

                {/* Pagination */}
                {pages > 1 && (
                  <div className="mt-12 flex items-center justify-center gap-3">
                    {hasPrevPage && (
                      <Link
                        href={buildPaginationUrl(params, page - 1)}
                        className="flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-off-white transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Link>
                    )}
                    <span className="font-mono-eyebrow text-sm text-muted-ink">
                      Page {page} of {pages}
                    </span>
                    {hasNextPage && (
                      <Link
                        href={buildPaginationUrl(params, page + 1)}
                        className="flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-off-white transition-colors"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                )}

                {/* Item count */}
                {total > PER_PAGE && (
                  <p className="mt-4 text-center font-mono-eyebrow text-xs text-muted-ink/60">
                    Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-10 rounded-2xl border border-dashed border-hairline bg-white p-16 text-center">
                <p className="text-sm font-semibold text-navy">
                  {params.q || params.category ? 'No articles match your filters.' : 'No articles published yet.'}
                </p>
                <p className="mt-2 text-sm text-muted-ink">
                  {params.q || params.category
                    ? 'Try a different search term or category.'
                    : 'Check back soon — we\'re writing our first guides now.'}
                </p>
                {(params.q || params.category) && (
                  <Link
                    href="/insights"
                    className="mt-6 inline-flex h-9 items-center rounded-lg border border-hairline px-4 text-sm font-medium text-navy hover:bg-off-white transition-colors"
                  >
                    Clear filters
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

function buildPaginationUrl(
  params: { category?: string; q?: string },
  page: number
): string {
  const p = new URLSearchParams()
  if (params.category) p.set('category', params.category)
  if (params.q) p.set('q', params.q)
  if (page > 1) p.set('page', String(page))
  const qs = p.toString()
  return `/insights${qs ? `?${qs}` : ''}`
}
