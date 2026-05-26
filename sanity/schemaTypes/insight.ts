import { defineField, defineType } from 'sanity'

export const insight = defineType({
  name: 'insight',
  title: 'Insight',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'seo', title: 'SEO & Meta' },
    { name: 'settings', title: 'Settings' },
  ],
  fields: [
    // Core
    defineField({
      name: 'title',
      type: 'string',
      title: 'Title',
      group: 'content',
      validation: (R) => R.required().max(100),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'URL Slug',
      group: 'settings',
      options: { source: 'title', maxLength: 96 },
      validation: (R) => R.required(),
    }),
    defineField({
      name: 'excerpt',
      type: 'text',
      title: 'Excerpt',
      rows: 3,
      group: 'content',
      description: 'Short description for listing cards (max 200 chars)',
      validation: (R) => R.required().max(200),
    }),
    defineField({
      name: 'featuredImage',
      type: 'image',
      title: 'Featured Image',
      group: 'content',
      options: { hotspot: true },
      fields: [
        defineField({ name: 'alt', type: 'string', title: 'Alt text' }),
        defineField({ name: 'caption', type: 'string', title: 'Caption' }),
      ],
    }),
    // Taxonomy
    defineField({
      name: 'category',
      type: 'reference',
      title: 'Category',
      group: 'settings',
      to: [{ type: 'category' }],
      validation: (R) => R.required(),
    }),
    defineField({
      name: 'tags',
      type: 'array',
      title: 'Tags',
      group: 'settings',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),
    defineField({
      name: 'author',
      type: 'reference',
      title: 'Author',
      group: 'settings',
      to: [{ type: 'author' }],
    }),
    // Publishing
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      title: 'Published At',
      group: 'settings',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'status',
      type: 'string',
      title: 'Status',
      group: 'settings',
      options: { list: ['draft', 'published', 'archived'], layout: 'radio' },
      initialValue: 'draft',
      validation: (R) => R.required(),
    }),
    // Content blocks
    defineField({
      name: 'contentBlocks',
      type: 'blockContent',
      title: 'Article Content',
      group: 'content',
    }),
    // FAQ (structured — drives JSON-LD rich results)
    defineField({
      name: 'faq',
      type: 'array',
      title: 'FAQ',
      group: 'content',
      description: 'Structured FAQs for Google rich results',
      of: [
        {
          name: 'faqItem',
          type: 'object',
          fields: [
            { name: 'question', type: 'string', title: 'Question' },
            { name: 'answer', type: 'text', title: 'Answer', rows: 3 },
          ],
        },
      ],
    }),
    // Related
    defineField({
      name: 'relatedInsights',
      type: 'array',
      title: 'Related Insights',
      group: 'content',
      description: 'Up to 3 related articles',
      of: [{ type: 'reference', to: [{ type: 'insight' }] }],
      validation: (R) => R.max(3),
    }),
    // SEO
    defineField({
      name: 'seoTitle',
      type: 'string',
      title: 'SEO Title',
      group: 'seo',
      description: 'Overrides title in search results (50–60 chars ideal)',
      validation: (R) => R.max(60),
    }),
    defineField({
      name: 'metaDescription',
      type: 'text',
      title: 'Meta Description',
      rows: 2,
      group: 'seo',
      description: '150–160 chars ideal',
      validation: (R) => R.max(160),
    }),
  ],
  orderings: [
    { title: 'Newest first', name: 'publishedAtDesc', by: [{ field: 'publishedAt', direction: 'desc' }] },
    { title: 'Oldest first', name: 'publishedAtAsc', by: [{ field: 'publishedAt', direction: 'asc' }] },
    { title: 'Title A–Z', name: 'titleAsc', by: [{ field: 'title', direction: 'asc' }] },
  ],
  preview: {
    select: {
      title: 'title',
      category: 'category.title',
      media: 'featuredImage',
      status: 'status',
    },
    prepare({ title, category, media, status }) {
      return {
        title,
        subtitle: `${category ?? 'No category'} · ${status}`,
        media,
      }
    },
  },
})
