import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'

function getPlaidClient() {
  const env = (process.env.PLAID_ENV ?? 'sandbox') as keyof typeof PlaidEnvironments
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  })
  return new PlaidApi(configuration)
}

// ─── Create link token (called by frontend to initialize Plaid Link) ──────────

export async function createLinkToken(orgId: string, userId: string): Promise<string> {
  const client = getPlaidClient()
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'FinPilot',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  })
  return response.data.link_token
}

// ─── Exchange public token → access token, encrypt, store ────────────────────

export async function exchangePublicToken(
  orgId: string,
  publicToken: string,
  supabase: SupabaseClient
): Promise<string> {
  const client = getPlaidClient()
  const response = await client.itemPublicTokenExchange({ public_token: publicToken })
  const { access_token, item_id } = response.data

  const encryptedToken = encrypt(access_token)
  const encryptedItemId = encrypt(item_id)

  // Get account info for display name
  let accountName: string | null = null
  try {
    const accountsResp = await client.accountsGet({ access_token })
    const account = accountsResp.data.accounts[0]
    if (account) accountName = `${account.name} (${account.mask ?? '****'})`
  } catch {
    // non-critical
  }

  // Upsert connection for this org
  const existing = await supabase
    .from('connections')
    .select('id')
    .eq('org_id', orgId)
    .eq('provider', 'plaid')
    .maybeSingle()

  if (existing.data) {
    await supabase.from('connections').update({
      encrypted_access_token: encryptedToken,
      encrypted_item_id: encryptedItemId,
      account_name: accountName,
      status: 'active',
      last_synced_at: null,
    }).eq('id', existing.data.id)
    return existing.data.id
  } else {
    const { data } = await supabase.from('connections').insert({
      org_id: orgId,
      provider: 'plaid',
      encrypted_access_token: encryptedToken,
      encrypted_item_id: encryptedItemId,
      account_name: accountName,
      status: 'active',
    }).select('id').single()
    return data!.id
  }
}

// ─── Sync transactions from Plaid ────────────────────────────────────────────

export async function syncPlaidTransactions(
  orgId: string,
  connectionId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number; error?: string }> {
  const client = getPlaidClient()

  const { data: connection } = await supabase
    .from('connections')
    .select('encrypted_access_token, sync_cursor, last_synced_at')
    .eq('id', connectionId)
    .single()

  if (!connection?.encrypted_access_token) {
    return { synced: 0, skipped: 0, error: 'No access token found' }
  }

  const accessToken = decrypt(connection.encrypted_access_token)

  const { data: log } = await supabase
    .from('sync_logs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      provider: 'plaid',
      sync_type: 'incremental',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  let synced = 0
  let skipped = 0
  let cursor = connection.sync_cursor ?? undefined

  try {
    let hasMore = true

    while (hasMore) {
      const response = await client.transactionsSync({
        access_token: accessToken,
        cursor,
        count: 500,
      })

      const { added, modified, next_cursor, has_more } = response.data
      cursor = next_cursor
      hasMore = has_more

      for (const txn of [...added, ...modified]) {
        if (txn.pending) { skipped++; continue }

        const refId = `plaid_${txn.transaction_id}`
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('org_id', orgId)
          .eq('source_ref_id', refId)
          .maybeSingle()

        // Plaid amounts: positive = debit (expense), negative = credit (income)
        const isExpense = txn.amount > 0
        const absAmount = Math.abs(txn.amount)
        const type = isExpense ? 'expense' : 'income'
        const description = txn.name ?? txn.merchant_name ?? 'Bank transaction'
        const date = txn.date

        if (existing) {
          // Update if modified
          await supabase.from('transactions').update({
            amount: absAmount,
            description,
            date,
          }).eq('id', existing.id)
          skipped++
          continue
        }

        const { category, confidence, method } = await categorize(description, type, orgId)

        await supabase.from('transactions').insert({
          org_id: orgId,
          type,
          amount: absAmount,
          description,
          date,
          category,
          category_confidence: confidence,
          category_method: method,
          source: 'plaid',
          source_ref_id: refId,
          currency: 'usd',
          is_reviewed: false,
          vendor: txn.merchant_name ?? null,
          raw_metadata: txn as unknown as Record<string, unknown>,
        })
        synced++
      }
    }

    // Persist new cursor for next incremental sync
    await supabase.from('connections').update({
      sync_cursor: cursor,
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
