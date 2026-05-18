import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'
import crypto from 'crypto'

// ─── API helpers ──────────────────────────────────────────────────────────────

function apiBase(sandbox: boolean) {
  return sandbox ? 'https://api-sandbox.mercury.com/api/v1' : 'https://api.mercury.com/api/v1'
}

function mercuryHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

async function mercuryGet(apiToken: string, sandbox: boolean, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBase(sandbox)}${path}`, { headers: mercuryHeaders(apiToken) })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mercury API error ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

async function mercuryPost(apiToken: string, sandbox: boolean, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBase(sandbox)}${path}`, {
    method: 'POST',
    headers: mercuryHeaders(apiToken),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mercury API error ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

// ─── Account types ────────────────────────────────────────────────────────────

export interface MercuryAccount {
  id: string
  name: string
  type: string
  status: string
  availableBalance: number
  currentBalance: number
  accountNumber: string
  routingNumber: string
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

export async function validateTokenAndGetAccounts(
  apiToken: string,
  sandbox: boolean,
): Promise<{ accounts: MercuryAccount[]; totalBalance: number }> {
  const json = await mercuryGet(apiToken, sandbox, '/accounts')
  const accounts = (json.accounts as MercuryAccount[]) ?? []
  if (!accounts.length) throw new Error('No accounts found. Make sure this token has the Accounts read scope.')
  const totalBalance = accounts
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + (a.availableBalance ?? 0), 0)
  return { accounts, totalBalance }
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString('hex')
}

export async function registerMercuryWebhook(
  apiToken: string,
  sandbox: boolean,
  webhookUrl: string,
  secret: string,
): Promise<string | null> {
  try {
    const json = await mercuryPost(apiToken, sandbox, '/webhooks', {
      url: webhookUrl,
      subscriptions: ['transaction.created', 'transaction.updated'],
      secret,
    })
    return (json.id as string) ?? null
  } catch {
    return null
  }
}

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyMercurySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature) return false
  try {
    const hmac = crypto.createHmac('sha256', secret)
    const digest = hmac.update(Buffer.from(rawBody)).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(signature, 'utf8'))
  } catch {
    return false
  }
}

export async function getMercuryTokenForOrg(
  orgId: string,
  supabase: SupabaseClient,
): Promise<{ token: string; sandbox: boolean } | null> {
  const { data: conn } = await supabase
    .from('connections')
    .select('encrypted_access_token, metadata')
    .eq('org_id', orgId)
    .eq('provider', 'mercury')
    .eq('status', 'active')
    .maybeSingle()

  if (!conn?.encrypted_access_token) return null
  const meta = (conn.metadata ?? {}) as Record<string, unknown>
  return {
    token: decrypt(conn.encrypted_access_token),
    sandbox: meta.sandbox === true,
  }
}

// ─── Reconciliation helper ────────────────────────────────────────────────────

// Check if a Mercury credit transaction is already covered by a processor payout
// (Stripe payout, or future PayPal/Shopify settlement). Returns the matching txn id if found.
async function findMatchingProcessorPayout(
  orgId: string,
  amount: number,
  date: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const dateObj = new Date(date)
  const startDate = new Date(dateObj)
  startDate.setDate(startDate.getDate() - 4)
  const endDate = new Date(dateObj)
  endDate.setDate(endDate.getDate() + 4)

  const { data } = await supabase
    .from('transactions')
    .select('id, amount, source_ref_id')
    .eq('org_id', orgId)
    .eq('type', 'income')
    .in('source', ['stripe', 'paypal', 'shopify', 'lemonsqueezy'])
    // Payout-type transactions have source_ref_id starting with 'payout_'
    .like('source_ref_id', 'payout_%')
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .eq('is_reconciled', false)

  if (!data?.length) return null

  const match = (data as { id: string; amount: number }[]).find(
    (t) => Math.abs(t.amount - amount) <= 0.01,
  )
  return match?.id ?? null
}

// ─── Transaction sync ─────────────────────────────────────────────────────────

interface MercuryTransaction {
  id: string
  amount: number
  kind: string
  status: string
  createdAt: string
  postedAt: string | null
  bankDescription: string | null
  counterpartyName: string
  counterpartyNickname: string | null
  mercuryCategory: string | null
  note: string | null
  details: {
    debitCredit: 'debit' | 'credit'
    paymentMethod?: string
    [key: string]: unknown
  }
}

const SKIP_STATUSES = new Set(['cancelled', 'failed', 'reversed', 'blocked'])

export async function syncMercuryTransaction(
  orgId: string,
  txn: MercuryTransaction,
  supabase: SupabaseClient,
): Promise<'synced' | 'skipped'> {
  // Skip failed/cancelled/reversed transactions
  if (SKIP_STATUSES.has(txn.status)) return 'skipped'

  // Skip internal transfers (money moving between the user's own Mercury accounts — not a P&L event)
  if (txn.kind === 'internalTransfer') return 'skipped'

  const isCredit = txn.details.debitCredit === 'credit'
  const type = isCredit ? 'income' : 'expense'
  const refId = `mercury_${txn.id}`

  // Idempotency — skip if already imported and active
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, deleted_at, is_reconciled')
    .eq('org_id', orgId)
    .eq('source_ref_id', refId)
    .maybeSingle()

  if (existing && !existing.deleted_at) return 'skipped'

  const date = (txn.postedAt ?? txn.createdAt).split('T')[0]
  const description =
    txn.note ??
    txn.bankDescription ??
    txn.counterpartyName ??
    (isCredit ? 'Mercury deposit' : 'Mercury payment')
  const currency = 'usd'

  // Reconciliation: if this credit matches a known processor payout, link them
  let isReconciled = false
  let reconciledWith: string | null = null

  if (isCredit) {
    const matchId = await findMatchingProcessorPayout(orgId, txn.amount, date, supabase)
    if (matchId) {
      isReconciled = true
      reconciledWith = matchId
    }
  }

  const { category, confidence, method, revenue_type } = await categorize(description, type, orgId)

  const payload = {
    org_id: orgId,
    type,
    amount: txn.amount,
    description,
    date,
    category,
    category_confidence: confidence,
    category_method: method,
    revenue_type: isCredit ? (revenue_type ?? 'one_time') : undefined,
    source: 'mercury',
    source_ref_id: refId,
    currency,
    is_reviewed: false,
    deleted_at: null,
    is_reconciled: isReconciled,
    reconciled_with: reconciledWith,
    raw_metadata: txn as unknown as Record<string, unknown>,
    vendor: !isCredit ? (txn.counterpartyName ?? null) : null,
  }

  if (existing?.deleted_at) {
    await supabase.from('transactions').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('transactions').insert(payload)
  }

  // If we matched a payout, mark the payout as reconciled too
  if (isReconciled && reconciledWith) {
    // Get the ID of the Mercury transaction we just inserted
    const { data: newTxn } = await supabase
      .from('transactions')
      .select('id')
      .eq('org_id', orgId)
      .eq('source_ref_id', refId)
      .maybeSingle()

    if (newTxn?.id) {
      await supabase
        .from('transactions')
        .update({ is_reconciled: true, reconciled_with: newTxn.id })
        .eq('id', reconciledWith)
    }
  }

  return 'synced'
}

// ─── Balance snapshot ─────────────────────────────────────────────────────────

export async function updateMercuryBalance(
  orgId: string,
  connectionId: string,
  totalBalance: number,
  supabase: SupabaseClient,
) {
  const { data: conn } = await supabase
    .from('connections')
    .select('metadata')
    .eq('id', connectionId)
    .maybeSingle()

  const existingMeta = ((conn?.metadata ?? {}) as Record<string, unknown>)
  await supabase
    .from('connections')
    .update({ metadata: { ...existingMeta, balance: totalBalance } })
    .eq('id', connectionId)
}

// ─── Pull sync ────────────────────────────────────────────────────────────────

export async function runMercuryPullSync(
  orgId: string,
  connectionId: string,
  apiToken: string,
  sandbox: boolean,
  supabase: SupabaseClient,
): Promise<{ synced: number; skipped: number; error?: string }> {
  const { data: log } = await supabase
    .from('sync_logs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      provider: 'mercury',
      sync_type: 'pull',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  let synced = 0
  let skipped = 0

  try {
    // 1. Get accounts and update cash balance
    const { accounts, totalBalance } = await validateTokenAndGetAccounts(apiToken, sandbox)
    await updateMercuryBalance(orgId, connectionId, totalBalance, supabase)

    // 2. Sync transactions for each account (last 90 days)
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const sinceStr = since.toISOString().split('T')[0]

    for (const account of accounts) {
      if (account.status !== 'active') continue
      if (account.type === 'mercury_treasury') continue // Treasury has different behavior

      let offset = 0
      const limit = 500
      let hasMore = true

      while (hasMore) {
        const qs = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          order: 'desc',
          start: sinceStr,
        })

        const json = await mercuryGet(
          apiToken,
          sandbox,
          `/account/${account.id}/transactions?${qs}`,
        )

        const txns = (json.transactions as MercuryTransaction[]) ?? []

        for (const txn of txns) {
          const result = await syncMercuryTransaction(orgId, txn, supabase)
          if (result === 'synced') synced++; else skipped++
        }

        hasMore = txns.length === limit
        offset += limit
      }
    }

    // 3. Run reconciliation pass
    const { reconcileOrgTransactions } = await import('@/lib/sync/reconciliation')
    await reconcileOrgTransactions(orgId, supabase)

    // 4. Update connection
    await supabase
      .from('connections')
      .update({ last_synced_at: new Date().toISOString(), status: 'active' })
      .eq('id', connectionId)

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

export { encrypt, decrypt }
