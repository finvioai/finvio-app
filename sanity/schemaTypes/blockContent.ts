import { defineArrayMember, defineField, defineType } from 'sanity'

export const blockContent = defineType({
  name: 'blockContent',
  title: 'Block Content',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'H2', value: 'h2' },
        { title: 'H3', value: 'h3' },
        { title: 'H4', value: 'h4' },
        { title: 'Quote', value: 'blockquote' },
      ],
      lists: [
        { title: 'Bullet', value: 'bullet' },
        { title: 'Numbered', value: 'number' },
      ],
      marks: {
        decorators: [
          { title: 'Bold', value: 'strong' },
          { title: 'Italic', value: 'em' },
          { title: 'Code', value: 'code' },
          { title: 'Underline', value: 'underline' },
        ],
        annotations: [
          {
            name: 'link',
            type: 'object',
            title: 'URL',
            fields: [
              { name: 'href', type: 'url', title: 'URL' },
              {
                name: 'blank',
                type: 'boolean',
                title: 'Open in new tab',
                initialValue: false,
              },
            ],
          },
        ],
      },
    }),
    // Inline image
    defineArrayMember({
      name: 'imageBlock',
      type: 'object',
      title: 'Image',
      fields: [
        defineField({
          name: 'image',
          type: 'image',
          title: 'Image',
          options: { hotspot: true },
          validation: (R) => R.required(),
        }),
        defineField({ name: 'alt', type: 'string', title: 'Alt text', validation: (R) => R.required() }),
        defineField({ name: 'caption', type: 'string', title: 'Caption' }),
        defineField({ name: 'fullWidth', type: 'boolean', title: 'Full width', initialValue: false }),
      ],
      preview: { select: { title: 'alt', media: 'image' } },
    }),
    // Callout (tip/info/warning/danger)
    defineArrayMember({
      name: 'callout',
      type: 'object',
      title: 'Callout',
      fields: [
        defineField({
          name: 'type',
          type: 'string',
          title: 'Type',
          options: { list: ['info', 'tip', 'warning', 'danger'], layout: 'radio' },
          initialValue: 'info',
          validation: (R) => R.required(),
        }),
        defineField({ name: 'text', type: 'text', title: 'Text', rows: 2, validation: (R) => R.required() }),
      ],
      preview: { select: { title: 'text', subtitle: 'type' } },
    }),
    // Code block
    defineArrayMember({
      name: 'codeBlock',
      type: 'object',
      title: 'Code Block',
      fields: [
        defineField({
          name: 'language',
          type: 'string',
          title: 'Language',
          options: {
            list: ['javascript', 'typescript', 'python', 'bash', 'json', 'sql', 'text'],
            layout: 'dropdown',
          },
          initialValue: 'text',
        }),
        defineField({ name: 'filename', type: 'string', title: 'Filename (optional)' }),
        defineField({ name: 'code', type: 'text', title: 'Code', rows: 8, validation: (R) => R.required() }),
      ],
      preview: { select: { title: 'filename', subtitle: 'language' } },
    }),
    // Data table
    defineArrayMember({
      name: 'table',
      type: 'object',
      title: 'Table',
      fields: [
        defineField({ name: 'caption', type: 'string', title: 'Caption' }),
        defineField({
          name: 'rows',
          type: 'array',
          title: 'Rows',
          of: [
            defineArrayMember({
              name: 'tableRow',
              type: 'object',
              fields: [
                defineField({ name: 'cells', type: 'array', of: [{ type: 'string' }], title: 'Cells' }),
                defineField({ name: 'isHeader', type: 'boolean', title: 'Header row', initialValue: false }),
              ],
            }),
          ],
        }),
      ],
      preview: { select: { title: 'caption' } },
    }),
    // Comparison table (feature comparison)
    defineArrayMember({
      name: 'comparisonTable',
      type: 'object',
      title: 'Comparison Table',
      fields: [
        defineField({ name: 'title', type: 'string', title: 'Title' }),
        defineField({ name: 'headers', type: 'array', of: [{ type: 'string' }], title: 'Column Headers' }),
        defineField({
          name: 'rows',
          type: 'array',
          title: 'Rows',
          of: [
            defineArrayMember({
              name: 'compRow',
              type: 'object',
              fields: [
                defineField({ name: 'cells', type: 'array', of: [{ type: 'string' }], title: 'Cells' }),
                defineField({ name: 'highlighted', type: 'boolean', title: 'Highlight row', initialValue: false }),
              ],
            }),
          ],
        }),
      ],
    }),
    // Inline FAQ block
    defineArrayMember({
      name: 'faqBlock',
      type: 'object',
      title: 'FAQ Block',
      fields: [
        defineField({
          name: 'title',
          type: 'string',
          title: 'Section title',
          initialValue: 'Frequently Asked Questions',
        }),
        defineField({
          name: 'items',
          type: 'array',
          title: 'Items',
          of: [
            defineArrayMember({
              name: 'faqItem',
              type: 'object',
              fields: [
                defineField({ name: 'question', type: 'string', title: 'Question', validation: (R) => R.required() }),
                defineField({ name: 'answer', type: 'text', title: 'Answer', rows: 3, validation: (R) => R.required() }),
              ],
            }),
          ],
        }),
      ],
    }),
    // CTA block
    defineArrayMember({
      name: 'ctaBlock',
      type: 'object',
      title: 'CTA Block',
      fields: [
        defineField({ name: 'title', type: 'string', title: 'Title', validation: (R) => R.required() }),
        defineField({ name: 'description', type: 'text', title: 'Description', rows: 2 }),
        defineField({ name: 'buttonText', type: 'string', title: 'Button text', initialValue: 'Get started free' }),
        defineField({ name: 'buttonUrl', type: 'string', title: 'Button URL', initialValue: '/signup' }),
        defineField({
          name: 'variant',
          type: 'string',
          title: 'Variant',
          options: { list: ['brand', 'navy', 'subtle'], layout: 'radio' },
          initialValue: 'brand',
        }),
      ],
    }),
  ],
})
