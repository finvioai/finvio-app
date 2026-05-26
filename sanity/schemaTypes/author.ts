import { defineField, defineType } from 'sanity'

export const author = defineType({
  name: 'author',
  title: 'Author',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', title: 'Name', validation: (R) => R.required() }),
    defineField({ name: 'slug', type: 'slug', title: 'Slug', options: { source: 'name' }, validation: (R) => R.required() }),
    defineField({ name: 'role', type: 'string', title: 'Role', placeholder: 'Head of Finance Content' }),
    defineField({ name: 'bio', type: 'text', title: 'Bio', rows: 3 }),
    defineField({ name: 'avatar', type: 'image', title: 'Avatar', options: { hotspot: true } }),
  ],
  preview: {
    select: { title: 'name', media: 'avatar' },
  },
})
