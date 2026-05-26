import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { InsightCard } from '@/components/insights/InsightCard'
import { ContentRenderer, extractHeadings } from '@/components/insights/ContentRenderer'
import { getInsightBySlug, getAllInsightSlugs, getReadingTime } from '@/sanity/lib/queries'
import { Calendar, Clock, Tag, ChevronRight, Share2 } from 'lucide-react'

export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://finvio.ai'

export async function generateStaticParams() {
  const slugs = await getAllInsightSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const insight = await getInsightBySlug(slug)
  if (!insight) return {}

  const title = `${insight.seoTitle ?? insight.title} — Finvio Insights`
  const description = insight.metaDescription ?? insight.excerpt

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/insights/${insight.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${SITE_URL}/insights/${insight.slug}`,
      publishedTime: insight.publishedAt,
      authors: insight.author ? [insight.author.name] : [],
      images: insight.featuredImage?.url
        ? [{ url: insight.featuredImage.url, alt: insight.featuredImage.alt ?? insight.title }]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: insight.featuredImage?.url ? [insight.featuredImage.url] : [],
    },
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function InsightDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const insight = await getInsightBySlug(slug)

  if (!insight) notFound()

  const readTime = getReadingTime(insight.contentBlocks ?? [])
  const headings = extractHeadings(insight.contentBlocks ?? [])

  // JSON-LD schemas
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: insight.title,
    description: insight.excerpt,
    image: insight.featuredImage?.url,
    datePublished: insight.publishedAt,
    dateModified: insight.publishedAt,
    author: insight.author
      ? { '@type': 'Person', name: insight.author.name }
      : { '@type': 'Organization', name: 'Finvio' },
    publisher: {
      '@type': 'Organization',
      name: 'Finvio',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.ico` },
    },
    url: `${SITE_URL}/insights/${insight.slug}`,
  }

  const faqSchema =
    insight.faq && insight.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: insight.faq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }
      : null

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: `${SITE_URL}/insights` },
      { '@type': 'ListItem', position: 3, name: insight.title, item: `${SITE_URL}/insights/${insight.slug}` },
    ],
  }

  return (
    <div data-landing>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}

      <SiteNav />
      <main>
        {/* Featured image hero */}
        {insight.featuredImage?.url && (
          <div className="relative h-72 md:h-96 w-full overflow-hidden bg-navy">
            <Image
              src={insight.featuredImage.url}
              alt={insight.featuredImage.alt ?? insight.title}
              fill
              priority
              className="object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/20 to-transparent" />
          </div>
        )}

        {/* Breadcrumb */}
        <div className={`bg-off-white border-b border-hairline ${insight.featuredImage?.url ? '' : 'pt-20'}`}>
          <div className="mx-auto max-w-7xl px-6 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-muted-ink">
              <Link href="/" className="hover:text-navy transition-colors">Home</Link>
              <ChevronRight className="h-3 w-3" />
              <Link href="/insights" className="hover:text-navy transition-colors">Insights</Link>
              {insight.category && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <Link href={`/insights?category=${insight.category.slug}`} className="hover:text-navy transition-colors">
                    {insight.category.title}
                  </Link>
                </>
              )}
              <ChevronRight className="h-3 w-3" />
              <span className="text-navy font-medium truncate max-w-xs">{insight.title}</span>
            </nav>
          </div>
        </div>

        {/* Content area */}
        <div className="bg-white">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
              {/* Main article */}
              <article>
                {/* Article header */}
                <header className="mb-10">
                  {insight.category && (
                    <Link
                      href={`/insights?category=${insight.category.slug}`}
                      className="inline-flex items-center rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand hover:bg-brand hover:text-navy-foreground transition-colors mb-4"
                    >
                      {insight.category.title}
                    </Link>
                  )}

                  <h1 className="text-3xl font-extrabold tracking-tight text-navy leading-tight md:text-4xl lg:text-5xl">
                    {insight.title}
                  </h1>

                  <p className="mt-4 text-lg text-muted-ink leading-relaxed">{insight.excerpt}</p>

                  <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-ink border-t border-hairline pt-6">
                    {insight.author && (
                      <div className="flex items-center gap-2">
                        {insight.author.avatarUrl ? (
                          <Image src={insight.author.avatarUrl} alt={insight.author.name} width={32} height={32} className="rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-brand-tint flex items-center justify-center text-xs font-bold text-brand">
                            {insight.author.name[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-navy text-sm">{insight.author.name}</p>
                          {insight.author.role && <p className="text-xs text-muted-ink">{insight.author.role}</p>}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-mono-eyebrow text-xs">{fmtDate(insight.publishedAt)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-mono-eyebrow text-xs">{readTime} min read</span>
                    </div>
                  </div>

                  {insight.tags && insight.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-muted-ink/50" />
                      {insight.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={`/insights?q=${encodeURIComponent(tag)}`}
                          className="rounded border border-hairline px-2 py-0.5 text-xs text-muted-ink hover:border-brand/30 hover:text-brand transition-colors"
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>
                  )}
                </header>

                {/* Article content */}
                {insight.contentBlocks && insight.contentBlocks.length > 0 && (
                  <ContentRenderer blocks={insight.contentBlocks} />
                )}

                {/* Structured FAQ section */}
                {insight.faq && insight.faq.length > 0 && (
                  <section className="mt-12 pt-10 border-t border-hairline">
                    <h2 className="text-2xl font-bold text-navy mb-6">Frequently Asked Questions</h2>
                    <div className="space-y-2">
                      {insight.faq.map((item) => (
                        <details key={item._key} className="group rounded-xl border border-hairline bg-off-white overflow-hidden">
                          <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 font-semibold text-navy hover:bg-brand-tint/30 transition-colors list-none">
                            <span>{item.question}</span>
                            <span className="shrink-0 text-brand group-open:rotate-45 transition-transform duration-200 text-xl leading-none">+</span>
                          </summary>
                          <div className="border-t border-hairline/60 bg-white px-5 py-4">
                            <p className="text-sm leading-relaxed text-muted-ink">{item.answer}</p>
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                )}

                {/* Share */}
                <div className="mt-10 pt-8 border-t border-hairline flex items-center gap-3">
                  <Share2 className="h-4 w-4 text-muted-ink" />
                  <span className="text-sm text-muted-ink">Share this article</span>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(insight.title)}&url=${encodeURIComponent(`${SITE_URL}/insights/${insight.slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-navy hover:bg-off-white transition-colors"
                  >
                    X / Twitter
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${SITE_URL}/insights/${insight.slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-navy hover:bg-off-white transition-colors"
                  >
                    LinkedIn
                  </a>
                </div>
              </article>

              {/* Sticky sidebar */}
              <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-6">
                  {/* Table of contents */}
                  {headings.length > 0 && (
                    <div className="rounded-xl border border-hairline bg-off-white p-5">
                      <p className="font-mono-eyebrow text-xs text-brand mb-3">Contents</p>
                      <nav className="space-y-1">
                        {headings.map((h) => (
                          <a
                            key={h.id}
                            href={`#${h.id}`}
                            className={`block text-sm text-muted-ink hover:text-brand transition-colors leading-snug py-0.5 ${h.level === 3 ? 'pl-3 border-l border-hairline' : ''}`}
                          >
                            {h.text}
                          </a>
                        ))}
                      </nav>
                    </div>
                  )}

                  {/* Author card */}
                  {insight.author && insight.author.bio && (
                    <div className="rounded-xl border border-hairline bg-white p-5">
                      <p className="font-mono-eyebrow text-xs text-muted-ink mb-3">About the author</p>
                      <div className="flex items-center gap-3 mb-3">
                        {insight.author.avatarUrl ? (
                          <Image src={insight.author.avatarUrl} alt={insight.author.name} width={40} height={40} className="rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-brand-tint flex items-center justify-center text-sm font-bold text-brand">
                            {insight.author.name[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-navy text-sm">{insight.author.name}</p>
                          {insight.author.role && <p className="text-xs text-muted-ink">{insight.author.role}</p>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-ink leading-relaxed">{insight.author.bio}</p>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="rounded-xl bg-navy p-5 text-center">
                    <p className="text-sm font-bold text-navy-foreground">AI-powered finance for founders</p>
                    <p className="mt-1.5 text-xs text-navy-foreground/70">Automate your financial ops with Finvio.</p>
                    <Link
                      href="/signup"
                      className="mt-4 inline-flex w-full h-9 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-navy-foreground hover:bg-brand/90 transition-colors"
                    >
                      Start free trial
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>

        {/* Related insights */}
        {insight.relatedInsights && insight.relatedInsights.length > 0 && (
          <section className="bg-off-white py-16">
            <div className="mx-auto max-w-7xl px-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-navy">Related Insights</h2>
                <Link href="/insights" className="text-sm font-medium text-brand hover:text-navy transition-colors">
                  View all →
                </Link>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {insight.relatedInsights.map((related) => (
                  <InsightCard key={related._id} insight={related} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
