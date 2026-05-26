export interface SanityAuthor {
  name: string
  role?: string
  bio?: string
  avatarUrl?: string
}

export interface SanityCategory {
  title: string
  slug: string
}

export interface SanityFaqItem {
  _key: string
  question: string
  answer: string
}

export interface ContentBlock {
  _type: string
  _key: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface SanityInsightCard {
  _id: string
  title: string
  slug: string
  excerpt: string
  featuredImageUrl?: string
  category: SanityCategory
  tags?: string[]
  author?: SanityAuthor
  publishedAt: string
}

export interface SanityInsight extends SanityInsightCard {
  featuredImage?: {
    url: string
    alt?: string
    caption?: string
    dimensions?: { width: number; height: number }
  }
  seoTitle?: string
  metaDescription?: string
  contentBlocks?: ContentBlock[]
  faq?: SanityFaqItem[]
  relatedInsights?: SanityInsightCard[]
}
