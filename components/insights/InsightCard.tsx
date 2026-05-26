import Link from 'next/link'
import Image from 'next/image'
import type { SanityInsightCard } from '@/sanity/lib/types'
import { getReadingTime } from '@/sanity/lib/queries'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface InsightCardProps {
  insight: SanityInsightCard
  featured?: boolean
}

export function InsightCard({ insight, featured = false }: InsightCardProps) {
  const readTime = getReadingTime([])

  return (
    <Link
      href={`/insights/${insight.slug}`}
      className={`group block rounded-2xl border border-hairline bg-white overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-brand/20 ${featured ? 'lg:flex' : ''}`}
    >
      {insight.featuredImageUrl && (
        <div className={`overflow-hidden bg-off-white ${featured ? 'lg:w-2/5 shrink-0 aspect-video lg:aspect-auto' : 'aspect-video'}`}>
          <Image
            src={insight.featuredImageUrl}
            alt={insight.title}
            width={featured ? 640 : 480}
            height={featured ? 400 : 270}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}

      {!insight.featuredImageUrl && (
        <div className={`bg-gradient-to-br from-brand/8 to-navy/5 flex items-center justify-center ${featured ? 'lg:w-2/5 shrink-0 aspect-video lg:aspect-auto min-h-48' : 'aspect-video'}`}>
          <svg className="w-10 h-10 text-brand/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      )}

      <div className={`p-5 flex flex-col ${featured ? 'lg:p-8 justify-center' : ''}`}>
        <div className="flex items-center gap-2 mb-3">
          {insight.category && (
            <span className="inline-flex items-center rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand">
              {insight.category.title}
            </span>
          )}
          <span className="font-mono-eyebrow text-muted-ink/70 text-xs">{readTime} min read</span>
        </div>

        <h3 className={`font-bold text-navy leading-snug transition-colors group-hover:text-brand ${featured ? 'text-xl lg:text-2xl' : 'text-base line-clamp-2'}`}>
          {insight.title}
        </h3>

        <p className={`mt-2 text-sm text-muted-ink leading-relaxed ${featured ? 'line-clamp-3' : 'line-clamp-2'}`}>
          {insight.excerpt}
        </p>

        {insight.tags && insight.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {insight.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded border border-hairline px-1.5 py-0.5 text-xs text-muted-ink">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2.5 pt-3 border-t border-hairline/60">
          {insight.author?.avatarUrl ? (
            <Image
              src={insight.author.avatarUrl}
              alt={insight.author.name}
              width={24}
              height={24}
              className="rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-brand-tint flex items-center justify-center text-xs font-bold text-brand">
              {insight.author?.name?.[0] ?? 'F'}
            </div>
          )}
          <span className="text-xs text-muted-ink">{insight.author?.name ?? 'Finvio'}</span>
          <span className="ml-auto font-mono-eyebrow text-xs text-muted-ink/60">
            {fmtDate(insight.publishedAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}
