import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'

// ─── PayPal OAuth helpers ─────────────────────────────────────────────────────

function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

export function getPayPalAuthUrl(state: string): string {
  const baseUrl = process.env.PAYPAL_ENV === 'production'
    ? 'https://www.paypal.com'
    : 'https://www.sandbox.paypal.com'
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connections/paypal/callback`
  return (
    `${baseUrl}/signin/authorize` +
    `?client_id=${process.env.PAYPAL_CLIENT_ID}` +
    `&response_type=code` +
    `&scope=openid%20https://uri.paypal.com/services/reporting/search/read` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`
  )
}

export async function exchangePayPalCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const base = getPayPalBaseUrl()
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connections/paypal/callback`
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })
  if (!res.ok) throw new Error(`PayPal token exchange failed: ${res.statusText}`)
  const json = await res.json() as { access_token: string; refresh_token: string }
  return { accessToken: json.access_token, refreshToken: json.refresh_token }
}

// ─── PayPal transaction sync ──────────────────────────────────────────────────

interface PayPalTransaction {
  transaction_info: {
    transaction_id: string
    transaction_amount: { currency_code: string; value: string }
    transaction_status: string
    transaction_initiation_date: string
    transaction_updated_date: string
    transaction_note?: string
    custom_field?: string
  }
  payer_info?: {
    email_address?: string
    payer_name?: { alternate_full_name?: string }
  }
}

async function getPayPalAccessToken(refreshToken: string): Promise<string> {
  const base = getPayPalBaseUrl()
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })
  if (!res.ok) throw new Error(`PayPal token refresh failed: ${res.statusText}`)
  const json = await res.json() as { access_token: string }
  return json.access_token
}

export async function syncPayPalTransactions(
  orgId: string,
  connectionId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number; error?: string }> {
  const { data: connection } = await supabase
    .from('connections')
    .select('encrypted_access_token, encrypted_refresh_token')
    .eq('id', connectionId)
    .single()

  if (!connection?.encrypted_refresh_token) {
    return { synced: 0, skipped: 0, error: 'No refresh token found' }
  }

  const { data: log } = await supabase
    .from('sync_logs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      provider: 'paypal',
      sync_type: 'pull',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  let synced = 0
  let skipped = 0

  try {
    const refreshToken = decrypt(connection.encrypted_refresh_token)
    const accessToken = await getPayPalAccessToken(refreshToken)
    const base = getPayPalBaseUrl()

    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startStr = startDate.toISOString().replace('.000Z', '+0000')
    const endStr = endDate.toISOString().replace('.000Z', '+0000')

    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = new URL(`${base}/v1/reporting/transactions`)
      url.searchParams.set('start_date', startStr)
      url.searchParams.set('end_date', endStr)
      url.searchParams.set('page', String(page))
      url.searchParams.set('page_size', '500')
      url.searchParams.set('fields', 'transaction_info,payer_info')

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error(`PayPal API error: ${res.statusText}`)

      const json = await res.json() as {
        transaction_details: PayPalTransaction[]
        total_pages: number
      }

      for (const item of json.transaction_details ?? []) {
        const info = item.transaction_info
        if (info.transaction_status !== 'S') { skipped++; continue } // S = success

        const refId = `paypal_${info.transaction_id}`
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('org_id', orgId)
          .eq('source_ref_id', refId)
          .maybeSingle()

        if (existing) { skipped++; continue }

        const rawAmount = parseFloat(info.transaction_amount.value)
        const isIncome = rawAmount > 0
        const amount = Math.abs(rawAmount)
        const type = isIncome ? 'income' : 'expense'
        const description = info.transaction_note ?? info.custom_field ?? 'PayPal transaction'
        const date = info.transaction_initiation_date.split('T')[0]
        const { category, confidence, method } = await categorize(description, type, orgId)

        await supabase.from('transactions').insert({
          org_id: orgId,
          type,
          amount,
          description,
          date,
          category,
          category_confidence: confidence,
          category_method: method,
          source: 'paypal',
          source_ref_id: refId,
          currency: info.transaction_amount.currency_code.toLowerCase(),
          is_reviewed: false,
          vendor: item.payer_info?.payer_name?.alternate_full_name ?? null,
          raw_metadata: item as unknown as Record<string, unknown>,
        })
        synced++
      }

      hasMore = page < json.total_pages
      page++
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
