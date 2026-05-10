import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'

// ─── Shopify OAuth helpers ────────────────────────────────────────────────────

export function getShopifyAuthUrl(shop: string, state: string): string {
  const scopes = 'read_orders'
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connections/shopify/callback`
  return (
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`
  )
}

export async function exchangeShopifyCode(
  shop: string,
  code: string
): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  })
  if (!res.ok) throw new Error(`Shopify token exchange failed: ${res.statusText}`)
  const json = await res.json() as { access_token: string }
  return json.access_token
}

// ─── Shopify GraphQL types ────────────────────────────────────────────────────

interface GQLOrder {
  id: string             // "gid://shopify/Order/123456789"
  legacyResourceId: string  // numeric string "123456789"
  name: string           // "#1001"
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }
  createdAt: string      // ISO datetime
}

interface GQLResponse {
  data?: {
    orders?: {
      edges?: Array<{ node: GQLOrder }>
      pageInfo?: { hasNextPage: boolean; endCursor: string | null }
    }
  }
  errors?: Array<{ message: string }>
}

// GraphQL query — no customer fields, avoids Shopify protected data restriction
const ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String!) {
    orders(first: $first, after: $after, query: $query) {
      edges { node {
        id legacyResourceId name createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
      }}
      pageInfo { hasNextPage endCursor }
    }
  }
`

async function fetchOrderPage(
  shop: string,
  accessToken: string,
  sinceIso: string,
  after: string | null
): Promise<{ orders: GQLOrder[]; hasNextPage: boolean; endCursor: string | null }> {
  const res = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ORDERS_QUERY,
      variables: { first: 250, after, query: `financial_status:paid created_at:>${sinceIso}` },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Shopify GraphQL error (${res.status}): ${body || res.statusText}`)
  }

  const json = await res.json() as GQLResponse
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL: ${json.errors.map((e) => e.message).join(', ')}`)
  }

  return {
    orders: json.data?.orders?.edges?.map((e) => e.node) ?? [],
    hasNextPage: json.data?.orders?.pageInfo?.hasNextPage ?? false,
    endCursor: json.data?.orders?.pageInfo?.endCursor ?? null,
  }
}

// ─── Shopify order sync ───────────────────────────────────────────────────────

export async function syncShopifyOrders(
  orgId: string,
  connectionId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number; error?: string }> {
  const { data: connection } = await supabase
    .from('connections')
    .select('encrypted_access_token, metadata')
    .eq('id', connectionId)
    .single()

  if (!connection?.encrypted_access_token) {
    return { synced: 0, skipped: 0, error: 'No access token found' }
  }

  const accessToken = decrypt(connection.encrypted_access_token)
  const shop = (connection.metadata as Record<string, string> | null)?.shop
  if (!shop) return { synced: 0, skipped: 0, error: 'Shop domain not found in connection metadata' }

  const { data: log } = await supabase
    .from('sync_logs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      provider: 'shopify',
      sync_type: 'pull',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  let synced = 0
  let skipped = 0

  try {
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    let cursor: string | null = null
    let hasMore = true

    while (hasMore) {
      const page = await fetchOrderPage(shop, accessToken, sinceIso, cursor)
      hasMore = page.hasNextPage
      cursor = page.endCursor

      for (const order of page.orders) {
        const refId = `shopify_${order.legacyResourceId}`
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('org_id', orgId)
          .eq('source_ref_id', refId)
          .maybeSingle()

        if (existing) { skipped++; continue }

        const amount = parseFloat(order.totalPriceSet.shopMoney.amount)
        const currency = order.totalPriceSet.shopMoney.currencyCode.toLowerCase()
        const description = `Shopify Order ${order.name}`
        const date = order.createdAt.split('T')[0]
        const { category, confidence, method, revenue_type } = await categorize(description, 'income', orgId)

        await supabase.from('transactions').insert({
          org_id: orgId,
          type: 'income',
          amount,
          description,
          date,
          category,
          category_confidence: confidence,
          category_method: method,
          revenue_type: revenue_type ?? 'one_time',
          source: 'shopify',
          source_ref_id: refId,
          currency,
          is_reviewed: false,
          raw_metadata: { shopify_id: order.id, name: order.name },
        })
        synced++
      }
    }

    await supabase.from('connections').update({
      last_synced_at: new Date().toISOString(),
      status: 'active',
    }).eq('id', connectionId)

    if (log) {
      await supabase.from('sync_logs').update({
        status: 'success',
        records_synced: synced,
        records_skipped: skipped,
        completed_at: new Date().toISOString(),
      }).eq('id', log.id)
    }

    return { synced, skipped }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    if (log) {
      await supabase.from('sync_logs').update({
        status: 'error',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      }).eq('id', log.id)
    }
    return { synced, skipped, error: errorMessage }
  }
}
