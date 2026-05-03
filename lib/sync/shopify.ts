import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'

// ─── Shopify OAuth helpers ────────────────────────────────────────────────────

export function getShopifyAuthUrl(shop: string, state: string): string {
  const scopes = 'read_orders,read_customers,read_products'
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

// ─── Shopify order sync ───────────────────────────────────────────────────────

interface ShopifyOrder {
  id: number
  order_number: number
  name: string
  total_price: string
  currency: string
  created_at: string
  financial_status: string
  customer?: { email?: string; first_name?: string; last_name?: string } | null
}

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
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    let url: string | null =
      `https://${shop}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250`

    while (url) {
      const currentUrl: string = url
      const response: Response = await fetch(currentUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) throw new Error(`Shopify API error: ${response.statusText}`)

      const json = await response.json() as { orders: ShopifyOrder[] }
      const orders: ShopifyOrder[] = json.orders ?? []

      for (const order of orders) {
        const refId = `shopify_${order.id}`
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('org_id', orgId)
          .eq('source_ref_id', refId)
          .maybeSingle()

        if (existing) { skipped++; continue }

        const amount = parseFloat(order.total_price)
        const description = `Shopify Order ${order.name}`
        const date = order.created_at.split('T')[0]
        const { category, confidence, method } = await categorize(description, 'income', orgId)

        await supabase.from('transactions').insert({
          org_id: orgId,
          type: 'income',
          amount,
          description,
          date,
          category,
          category_confidence: confidence,
          category_method: method,
          source: 'shopify',
          source_ref_id: refId,
          currency: order.currency.toLowerCase(),
          is_reviewed: false,
          raw_metadata: order as unknown as Record<string, unknown>,
        })
        synced++
      }

      // Shopify uses Link header for pagination
      const linkHeader: string = response.headers.get('Link') ?? ''
      const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      url = nextMatch ? nextMatch[1] : null
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
