import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  verifyMercurySignature,
  syncMercuryTransaction,
  updateMercuryBalance,
  validateTokenAndGetAccounts,
  decrypt,
} from '@/lib/sync/mercury'
import type { Json } from '@/types/database'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-mercury-signature') ?? ''
  const eventType = request.headers.get('x-mercury-event') ?? ''

  if (!signature) {
    return NextResponse.json({ error: 'Missing x-mercury-signature header' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: connection } = await supabase
    .from('connections')
    .select('org_id, id, encrypted_access_token, encrypted_refresh_token, metadata')
    .eq('provider', 'mercury')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!connection?.encrypted_refresh_token) {
    return NextResponse.json({ received: true, skipped: 'No active Mercury connection' })
  }

  const webhookSecret = decrypt(connection.encrypted_refresh_token)

  if (!verifyMercurySignature(body, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const orgId = connection.org_id

  // Mercury webhook payload contains the transaction or account object directly
  // The event type is in the X-Mercury-Event header or embedded in payload
  const resolvedEventType = eventType || String(payload.eventType ?? payload.type ?? '')

  // Idempotency
  const resourceId = String(payload.id ?? '')
  const eventId = `mercury_${resolvedEventType}_${resourceId}`

  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id, status')
    .eq('event_id', eventId)
    .maybeSingle()

  if (existing?.status === 'processed') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const { data: eventRecord } = await supabase
    .from('webhook_events')
    .upsert({
      event_id: eventId,
      provider: 'mercury',
      event_type: resolvedEventType,
      payload: payload as unknown as Json,
      status: 'processing',
    }, { onConflict: 'event_id' })
    .select('id')
    .single()

  let processError: string | null = null

  try {
    if (resolvedEventType === 'transaction.created' || resolvedEventType === 'transaction.updated') {
      // Payload is the transaction object
      interface MercuryWebhookTxn {
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
        details: { debitCredit: 'debit' | 'credit'; paymentMethod?: string; [key: string]: unknown }
      }

      const txn = payload as unknown as MercuryWebhookTxn
      if (txn.id && txn.amount !== undefined) {
        await syncMercuryTransaction(orgId, txn, supabase)
      }

      // Refresh balance after transaction
      const meta = (connection.metadata ?? {}) as Record<string, unknown>
      const apiToken = connection.encrypted_access_token ? decrypt(connection.encrypted_access_token) : null
      if (apiToken) {
        try {
          const { totalBalance } = await validateTokenAndGetAccounts(apiToken, meta.sandbox === true)
          await updateMercuryBalance(orgId, connection.id, totalBalance, supabase)
        } catch {
          // Balance refresh failure is non-fatal
        }
      }
    }

    // account.created — refresh account list in metadata
    if (resolvedEventType === 'account.created') {
      const meta = (connection.metadata ?? {}) as Record<string, unknown>
      const apiToken = connection.encrypted_access_token ? decrypt(connection.encrypted_access_token) : null
      if (apiToken) {
        try {
          const { totalBalance, accounts } = await validateTokenAndGetAccounts(apiToken, meta.sandbox === true)
          await supabase.from('connections').update({
            metadata: {
              ...meta,
              balance: totalBalance,
              account_count: accounts.length,
              account_ids: accounts.map((a) => a.id),
            } as unknown as Json,
          }).eq('id', connection.id)
        } catch {
          // Non-fatal
        }
      }
    }
  } catch (err) {
    processError = err instanceof Error ? err.message : 'Unknown error'
  }

  if (eventRecord) {
    await supabase.from('webhook_events').update({
      status: processError ? 'error' : 'processed',
      error: processError,
      processed_at: new Date().toISOString(),
    }).eq('id', eventRecord.id)
  }

  if (processError) {
    console.error(`Mercury webhook error for ${resolvedEventType} ${resourceId}:`, processError)
  }

  return NextResponse.json({ received: true })
}
