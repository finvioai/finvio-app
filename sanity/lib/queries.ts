import { groq } from 'next-sanity'
import { client } from './client'
import type { SanityInsightCard, SanityInsight, SanityCategory, ContentBlock } from './types'

const CARD_FIELDS = groq`
  _id,
  title,
  "slug": slug.current,
  excerpt,
  "featuredImageUrl": featuredImage.asset->url,
  category->{title, "slug": slug.current},
  tags,
  author->{name, role, "avatarUrl": avatar.asset->url},
  publishedAt
`

export const PER_PAGE = 12

export async function getInsights({
  category,
  q,
  page = 1,
}: {
  category?: string | null
  q?: string | null
  page?: number
} = {}): Promise<{ insights: SanityInsightCard[]; total: number; pages: number }> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    return { insights: [], total: 0, pages: 0 }
  }

  const start = (page - 1) * PER_PAGE
  const end = page * PER_PAGE
  const searchTerm = q ? `${q}*` : null

  const filter = groq`
    _type == "insight" &&
    status == "published" &&
    (!defined($category) || category->slug.current == $category) &&
    (!defined($searchTerm) || title match $searchTerm || excerpt match $searchTerm)
  `

  const [insights, total] = await Promise.all([
    client.fetch<SanityInsightCard[]>(
      groq`*[${filter}] | order(publishedAt desc) [$start...$end]{${CARD_FIELDS}}`,
      { category: category ?? null, searchTerm, start, end },
      { next: { revalidate: 60 } }
    ),
    client.fetch<number>(
      groq`count(*[${filter}])`,
      { category: category ?? null, searchTerm },
      { next: { revalidate: 60 } }
    ),
  ])

  return { insights, total, pages: Math.ceil(total / PER_PAGE) }
}

export async function getInsightBySlug(slug: string): Promise<SanityInsight | null> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) return null

  return client.fetch<SanityInsight | null>(
    groq`*[_type == "insight" && slug.current == $slug && status == "published"][0]{
      _id,
      title,
      "slug": slug.current,
      excerpt,
      "featuredImage": featuredImage{
        alt,
        caption,
        "url": asset->url,
        "dimensions": asset->metadata.dimensions
      },
      category->{title, "slug": slug.current},
      tags,
      author->{name, role, bio, "avatarUrl": avatar.asset->url},
      publishedAt,
      seoTitle,
      metaDescription,
      contentBlocks[]{
        ...,
        _type == "imageBlock" => {
          ...,
          "imageUrl": image.asset->url,
          "imageDimensions": image.asset->metadata.dimensions
        }
      },
      faq,
      "relatedInsights": relatedInsights[]->{${CARD_FIELDS}}
    }`,
    { slug },
    { next: { revalidate: 60 } }
  )
}

export async function getAllInsightSlugs(): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) return []

  const slugs = await client.fetch<{ slug: string }[]>(
    groq`*[_type == "insight" && status == "published"]{"slug": slug.current}`,
    {},
    { next: { revalidate: 3600 } }
  )
  return slugs.map((s) => s.slug)
}

export async function getCategories(): Promise<SanityCategory[]> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) return []

  return client.fetch<SanityCategory[]>(
    groq`*[_type == "category"] | order(title asc){title, "slug": slug.current}`,
    {},
    { next: { revalidate: 3600 } }
  )
}

export function getReadingTime(blocks: ContentBlock[]): number {
  if (!blocks?.length) return 1
  const text = blocks
    .map((b) => {
      if (b._type === 'block' && Array.isArray(b.children)) {
        return b.children.map((c: { text?: string }) => c.text ?? '').join(' ')
      }
      return ''
    })
    .join(' ')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

