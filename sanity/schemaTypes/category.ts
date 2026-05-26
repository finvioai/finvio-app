import { defineField, defineType } from 'sanity'

export const category = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', title: 'Title', validation: (R) => R.required() }),
    defineField({ name: 'slug', type: 'slug', title: 'Slug', options: { source: 'title' }, validation: (R) => R.required() }),
    defineField({ name: 'description', type: 'text', title: 'Description', rows: 2 }),
  ],
  preview: { select: { title: 'title', subtitle: 'description' } },
})
