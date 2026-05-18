import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'

const BREX_AUTH_URL = 'https://accounts.brex.com/oauth2/v1/auth'
const BREX_TOKEN_URL = 'https://accounts.brex.com/oauth2/v1/token'
const BREX_API_BASE = 'https://platform.brexapis.com'

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

// ─── OAuth URL builder ────────────────────────────────────────────────────────

export function getBrexOAuthUrl(state: string, codeChallenge: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.BREX_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: 'openid offline_access transactions.readonly accounts.readonly',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${BREX_AUTH_URL}?${params}`
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function getBasicAuthHeader(): string {
  const clientId = process.env.BREX_CLIENT_ID
  const clientSecret = process.env.BREX_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Brex client credentials not configured')
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

async function brexTokenRequest(params: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(BREX_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
    },
    body: params.toString(),
  })
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) {
    throw new Error(String(data.error_description ?? data.error ?? `Token request failed (${res.status})`))
  }
  return data
}

export async function exchangeBrexCode(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const data = await brexTokenRequest(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  }))
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) ?? '',
  }
}

async function refreshBrexToken(refreshToken: string): Promise<string> {
  const data = await brexTokenRequest(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }))
  return data.access_token as string
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function brexGet<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${BREX_API_BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brex API ${res.status} ${path}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── Account info ─────────────────────────────────────────────────────────────

interface BrexMoney { amount: number; currency: string }
interface BrexList<T> { items: T[]; next_cursor?: string }

interface BrexCashAccount {
  id: string
  name: string
  status: string
  current_balance?: BrexMoney
  available_balance?: BrexMoney
}

export async function getBrexAccountInfo(accessToken: string): Promise<{
  companyName: string
  cashAccounts: { id: string; name: string }[]
  totalCashBalance: number
}> {
  let companyName = 'Brex'
  try {
    const company = await brexGet<{ legal_name?: string }>('/v1/company', accessToken)
    if (company.legal_name) companyName = company.legal_name
  } catch {
    // Non-fatal — use default
  }

  const cashRes = await brexGet<BrexList<BrexCashAccount>>('/v2/accounts/cash', accessToken)
  const activeCash = (cashRes.items ?? []).filter((a) => a.status === 'ACTIVE')
  const totalCashBalance = activeCash.reduce((sum, a) => {
    const bal = a.available_balance ?? a.current_balance
    return sum + (bal ? bal.amount / 100 : 0)
  }, 0)

  return {
    companyName,
    cashAccounts: activeCash.map((a) => ({ id: a.id, name: a.name })),
    totalCashBalance,
  }
}

// ─── Card transaction sync ────────────────────────────────────────────────────

interface BrexCardTxn {
  id: string
  card_id: string
  description: string
  amount: BrexMoney
  initiated_at_date?: string
  posted_at_date?: string
  status: string
  merchant?: {
    raw_descriptor?: string
    mcc?: string
    country?: string
  }
}

const SKIP_CARD_STATUSES = new Set(['PENDING', 'DECLINED'])

async function syncBrexCardTransactions(
  orgId: string,
  accessToken: string,
  startDate: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number }> {
  let synced = 0
  let skipped = 0
  let cursor: string | undefined

  do {
    const params: Record<string, string> = { start_date: startDate }
    if (cursor) params.cursor = cursor

    const page = await brexGet<BrexList<BrexCardTxn>>(
      '/v2/transactions/card/primary',
      accessToken,
      params
    )

    for (const txn of page.items ?? []) {
      if (SKIP_CARD_STATUSES.has(txn.status)) { skipped++; continue }

      const refId = `brex_card_${txn.id}`
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('org_id', orgId)
        .eq('source_ref_id', refId)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing) { skipped++; continue }

      const date = txn.posted_at_date ?? txn.initiated_at_date ?? new Date().toISOString().split('T')[0]
      const amount = Math.abs(txn.amount.amount) / 100
      const description = txn.merchant?.raw_descriptor ?? txn.description ?? 'Brex card charge'

      const { category } = await categorize(description, 'expense', orgId)

      const { error } = await supabase.from('transactions').insert({
        org_id: orgId,
        source: 'brex',
        source_ref_id: refId,
        type: 'expense',
        amount,
        date,
        description,
        category,
        currency: (txn.amount.currency ?? 'USD').toLowerCase(),
        metadata: {
          status: txn.status,
          card_id: txn.card_id,
          mcc: txn.merchant?.mcc,
          merchant_country: txn.merchant?.country,
        },
      })

      if (!error) synced++
      else skipped++
    }

    cursor = page.next_cursor
  } while (cursor)

  return { synced, skipped }
}

// ─── Cash transaction sync ────────────────────────────────────────────────────

interface BrexCashTxn {
  id: string
  date: string
  amount: BrexMoney
  description: string
  type: string
}

// CARD type in cash account = batch card statement settlement — skip to avoid
// double-counting individual card transactions already synced from the card endpoint
const SKIP_CASH_TYPES = new Set(['CARD'])

async function syncBrexCashTransactions(
  orgId: string,
  accessToken: string,
  startDate: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number }> {
  let synced = 0
  let skipped = 0
  let cursor: string | undefined

  do {
    const params: Record<string, string> = { start_date: startDate }
    if (cursor) params.cursor = cursor

    const page = await brexGet<BrexList<BrexCashTxn>>(
      '/v2/transactions/cash',
      accessToken,
      params
    )

    for (const txn of page.items ?? []) {
      if (SKIP_CASH_TYPES.has(txn.type)) { skipped++; continue }

      const refId = `brex_cash_${txn.id}`
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('org_id', orgId)
        .eq('source_ref_id', refId)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing) { skipped++; continue }

      const rawAmount = txn.amount.amount  // negative = debit, positive = credit
      if (rawAmount === 0) { skipped++; continue }

      const isCredit = rawAmount > 0
      const type = isCredit ? 'income' : 'expense'
      const amount = Math.abs(rawAmount) / 100

      const description = txn.description ?? `Brex ${txn.type}`
      const { category } = await categorize(description, type, orgId)

      const { error } = await supabase.from('transactions').insert({
        org_id: orgId,
        source: 'brex',
        source_ref_id: refId,
        type,
        amount,
        date: txn.date,
        description,
        category,
        currency: (txn.amount.currency ?? 'USD').toLowerCase(),
        metadata: { cash_type: txn.type },
      })

      if (!error) synced++
      else skipped++
    }

    cursor = page.next_cursor
  } while (cursor)

  return { synced, skipped }
}

// ─── Pull sync orchestrator ───────────────────────────────────────────────────

export async function runBrexPullSync(
  orgId: string,
  connectionId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number; error?: string }> {
  const { data: conn } = await supabase
    .from('connections')
    .select('encrypted_refresh_token, metadata, last_synced_at')
    .eq('id', connectionId)
    .single()

  if (!conn?.encrypted_refresh_token) {
    return { synced: 0, skipped: 0, error: 'No credentials found. Please reconnect.' }
  }

  let accessToken: string
  try {
    const refreshToken = decrypt(conn.encrypted_refresh_token)
    accessToken = await refreshBrexToken(refreshToken)
    await supabase
      .from('connections')
      .update({ encrypted_access_token: encrypt(accessToken) })
      .eq('id', connectionId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token refresh failed'
    return { synced: 0, skipped: 0, error: `${msg} — please reconnect Brex.` }
  }

  // 90-day window for initial sync; subsequent syncs start from last_synced_at
  const startDate = conn.last_synced_at
    ? new Date(conn.last_synced_at).toISOString().split('T')[0]
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let totalSynced = 0
  let totalSkipped = 0

  try {
    const [cardResult, cashResult] = await Promise.all([
      syncBrexCardTransactions(orgId, accessToken, startDate, supabase),
      syncBrexCashTransactions(orgId, accessToken, startDate, supabase),
    ])
    totalSynced = cardResult.synced + cashResult.synced
    totalSkipped = cardResult.skipped + cashResult.skipped

    // Update balance in metadata (non-fatal)
    let balanceMeta: Record<string, unknown> = {}
    try {
      const { totalCashBalance } = await getBrexAccountInfo(accessToken)
      const meta = (conn.metadata ?? {}) as Record<string, unknown>
      balanceMeta = { ...meta, balance: totalCashBalance }
    } catch {
      balanceMeta = (conn.metadata ?? {}) as Record<string, unknown>
    }

    await supabase
      .from('connections')
      .update({ metadata: balanceMeta, last_synced_at: new Date().toISOString() })
      .eq('id', connectionId)

    return { synced: totalSynced, skipped: totalSkipped }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    // Persist last_synced_at even on partial failure
    await supabase
      .from('connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connectionId)
    return { synced: totalSynced, skipped: totalSkipped, error: msg }
  }
}
