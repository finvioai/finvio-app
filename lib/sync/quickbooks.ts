import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

interface QBMeta {
  realm_id: string
  environment: 'sandbox' | 'production'
}

interface StoredConnection {
  encrypted_access_token: string
  encrypted_refresh_token: string
  metadata: QBMeta
}

function getApiBase(environment: string) {
  return environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

async function refreshAccessToken(conn: StoredConnection): Promise<string> {
  const clientId = process.env.QB_CLIENT_ID
  const clientSecret = process.env.QB_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('QuickBooks platform credentials not configured')

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const refreshToken = decrypt(conn.encrypted_refresh_token)

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.access_token as string
}

async function qbQuery<T>(
  accessToken: string,
  realmId: string,
  environment: string,
  query: string
): Promise<T[]> {
  const apiBase = getApiBase(environment)
  const url = `${apiBase}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`QuickBooks API error (${res.status}): ${body}`)
  }

  const data = await res.json()
  // QB returns { QueryResponse: { <EntityName>: [...] } }
  const queryResponse = data.QueryResponse ?? {}
  const values = Object.values(queryResponse)
  return (values.find(Array.isArray) as T[] | undefined) ?? []
}

// ─── Main sync ────────────────────────────────────────────────────────────────

export async function syncQuickBooksData(
  orgId: string,
  connectionId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number; error?: string }> {
  const { data: conn } = await supabase
    .from('connections')
    .select('encrypted_access_token, encrypted_refresh_token, metadata')
    .eq('id', connectionId)
    .single()

  if (!conn?.encrypted_access_token || !conn?.encrypted_refresh_token) {
    return { synced: 0, skipped: 0, error: 'No tokens found. Please reconnect QuickBooks.' }
  }

  const { data: log } = await supabase
    .from('sync_logs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      provider: 'quickbooks',
      sync_type: 'incremental',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const meta = conn.metadata as QBMeta
  const { realm_id: realmId, environment = 'sandbox' } = meta

  let accessToken: string
  try {
    accessToken = await refreshAccessToken(conn as StoredConnection)
    await supabase
      .from('connections')
      .update({ encrypted_access_token: encrypt(accessToken) })
      .eq('id', connectionId)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Token refresh failed'
    if (log) {
      await supabase.from('sync_logs').update({
        status: 'error',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      }).eq('id', log.id)
    }
    return { synced: 0, skipped: 0, error: errorMessage }
  }

  // 30-day lookback
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceDate = since.toISOString().split('T')[0]

  let synced = 0
  let skipped = 0

  try {
    // ── Purchases → expenses ──────────────────────────────────────────────────
    type QBPurchase = {
      Id: string
      TotalAmt: number
      TxnDate: string
      EntityRef?: { name?: string }
      Line?: Array<{ Description?: string }>
    }

    const purchases = await qbQuery<QBPurchase>(
      accessToken, realmId, environment,
      `SELECT * FROM Purchase WHERE TxnDate >= '${sinceDate}' MAXRESULTS 1000`
    )

    for (const p of purchases) {
      const refId = `qb_purchase_${p.Id}`
      const { data: existing } = await supabase
        .from('transactions')
        .select('id, deleted_at')
        .eq('org_id', orgId)
        .eq('source_ref_id', refId)
        .maybeSingle()

      if (existing && !existing.deleted_at) { skipped++; continue }

      const description = p.Line?.[0]?.Description ?? p.EntityRef?.name ?? 'QuickBooks expense'
      const vendor = p.EntityRef?.name ?? null
      const { category, confidence, method, revenue_type } = await categorize(description, 'expense', orgId)

      const payload = {
        org_id: orgId,
        type: 'expense' as const,
        amount: Math.abs(p.TotalAmt),
        description,
        date: p.TxnDate,
        category,
        category_confidence: confidence,
        category_method: method,
        revenue_type: revenue_type ?? null,
        source: 'quickbooks',
        source_ref_id: refId,
        currency: 'usd',
        is_reviewed: false,
        deleted_at: null,
        vendor,
        raw_metadata: p as unknown as Record<string, unknown>,
      }

      const { error } = existing?.deleted_at
        ? await supabase.from('transactions').update(payload).eq('id', existing.id)
        : await supabase.from('transactions').insert(payload)
      if (!error) synced++
    }

    // ── Paid Invoices → income ────────────────────────────────────────────────
    type QBInvoice = {
      Id: string
      TotalAmt: number
      TxnDate: string
      CustomerRef?: { name?: string }
    }

    const invoices = await qbQuery<QBInvoice>(
      accessToken, realmId, environment,
      `SELECT * FROM Invoice WHERE TxnDate >= '${sinceDate}' AND Balance = '0' MAXRESULTS 1000`
    )

    for (const inv of invoices) {
      const refId = `qb_invoice_${inv.Id}`
      const { data: existing } = await supabase
        .from('transactions')
        .select('id, deleted_at')
        .eq('org_id', orgId)
        .eq('source_ref_id', refId)
        .maybeSingle()

      if (existing && !existing.deleted_at) { skipped++; continue }

      const description = inv.CustomerRef?.name
        ? `Invoice payment from ${inv.CustomerRef.name}`
        : 'QuickBooks invoice payment'
      const { category, confidence, method, revenue_type } = await categorize(description, 'income', orgId)

      const payload = {
        org_id: orgId,
        type: 'income' as const,
        amount: inv.TotalAmt,
        description,
        date: inv.TxnDate,
        category,
        category_confidence: confidence,
        category_method: method,
        revenue_type: revenue_type ?? null,
        source: 'quickbooks',
        source_ref_id: refId,
        currency: 'usd',
        is_reviewed: false,
        deleted_at: null,
        vendor: inv.CustomerRef?.name ?? null,
        raw_metadata: inv as unknown as Record<string, unknown>,
      }

      const { error } = existing?.deleted_at
        ? await supabase.from('transactions').update(payload).eq('id', existing.id)
        : await supabase.from('transactions').insert(payload)
      if (!error) synced++
    }

    // ── Sales Receipts → income ───────────────────────────────────────────────
    type QBReceipt = {
      Id: string
      TotalAmt: number
      TxnDate: string
      CustomerRef?: { name?: string }
      Line?: Array<{ Description?: string }>
    }

    const receipts = await qbQuery<QBReceipt>(
      accessToken, realmId, environment,
      `SELECT * FROM SalesReceipt WHERE TxnDate >= '${sinceDate}' MAXRESULTS 1000`
    )

    for (const r of receipts) {
      const refId = `qb_receipt_${r.Id}`
      const { data: existing } = await supabase
        .from('transactions')
        .select('id, deleted_at')
        .eq('org_id', orgId)
        .eq('source_ref_id', refId)
        .maybeSingle()

      if (existing && !existing.deleted_at) { skipped++; continue }

      const description = r.CustomerRef?.name
        ? `Sales receipt from ${r.CustomerRef.name}`
        : r.Line?.[0]?.Description ?? 'QuickBooks sales receipt'
      const { category, confidence, method, revenue_type } = await categorize(description, 'income', orgId)

      const payload = {
        org_id: orgId,
        type: 'income' as const,
        amount: r.TotalAmt,
        description,
        date: r.TxnDate,
        category,
        category_confidence: confidence,
        category_method: method,
        revenue_type: revenue_type ?? null,
        source: 'quickbooks',
        source_ref_id: refId,
        currency: 'usd',
        is_reviewed: false,
        deleted_at: null,
        vendor: r.CustomerRef?.name ?? null,
        raw_metadata: r as unknown as Record<string, unknown>,
      }

      const { error } = existing?.deleted_at
        ? await supabase.from('transactions').update(payload).eq('id', existing.id)
        : await supabase.from('transactions').insert(payload)
      if (!error) synced++
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
