'use client'

import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './sanity/schemaTypes'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ''
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'

export default defineConfig({
  basePath: '/studio',
  projectId,
  dataset,
  title: 'Finvio Insights CMS',
  schema: { types: schemaTypes },
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Finvio Insights')
          .items([
            S.listItem()
              .title('Published Insights')
              .child(
                S.documentList()
                  .title('Published')
                  .filter('_type == "insight" && status == "published"')
                  .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])
              ),
            S.listItem()
              .title('Drafts')
              .child(
                S.documentList()
                  .title('Drafts')
                  .filter('_type == "insight" && status == "draft"')
              ),
            S.listItem()
              .title('All Insights')
              .child(
                S.documentList()
                  .title('All Insights')
                  .filter('_type == "insight"')
              ),
            S.divider(),
            S.listItem()
              .title('Authors')
              .child(S.documentList().title('Authors').filter('_type == "author"')),
            S.listItem()
              .title('Categories')
              .child(S.documentList().title('Categories').filter('_type == "category"')),
          ]),
    }),
    visionTool({ defaultApiVersion: '2024-01-01' }),
  ],
})
