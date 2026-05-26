import { createClient } from 'next-sanity'

// SANITY_PROJECT_ID (no NEXT_PUBLIC_ prefix) is a runtime env var — read fresh
// on every server invocation even without a new build.
// NEXT_PUBLIC_SANITY_PROJECT_ID is baked into the JS bundle at build time and
// is only used as a fallback for client-side Studio rendering.
export const projectId =
  process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
export const dataset =
  process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
export const apiVersion =
  process.env.SANITY_API_VERSION || process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-01-01'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  stega: { enabled: false },
})
