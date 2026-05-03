import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Shared within one server render (layout + page share the same resolved value).
// Uses getSession() — reads JWT from cookie locally, no network call to auth server.
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
})

// Cached for 5 minutes across requests, keyed by userId.
// Uses service client so it works inside unstable_cache (no cookie dependency).
const _getCachedOrgInfo = unstable_cache(
  async (userId: string) => {
    const supabase = createServiceClient()
    const { data: member } = await supabase
      .from('org_members')
      .select('org_id, organizations(name)')
      .eq('user_id', userId)
      .single()
    return {
      orgId: (member?.org_id ?? null) as string | null,
      orgName: ((member?.organizations as { name: string } | null)?.name ?? null) as string | null,
    }
  },
  ['org-info'],
  { revalidate: 300 }
)

// React.cache wraps the unstable_cache call so within one request,
// layout and page both calling getOrgInfo() share the same in-flight Promise.
export const getOrgInfo = cache(async () => {
  const session = await getSession()
  if (!session?.user) return { orgId: null as string | null, orgName: null as string | null }
  return _getCachedOrgInfo(session.user.id)
})
