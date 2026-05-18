import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  verifyWebhookSignature,
  syncLSOrder,
  syncLSSubscription,
  syncLSSubscriptionInvoice,
  decrypt,
} from '@/lib/sync/lemonsqueezy'
import type { Json } from '@/types/database'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-signature') ?? ''
  const eventName = request.headers.get('x-event-name') ?? ''

  if (!signature || !eventName) {
    return NextResponse.json({ error: 'Missing signature or event name' }, { status: 400 })
  }

  const supabase = await createClient()

  // Find the org's Lemon Squeezy connection to get the webhook secret
  const { data: connection } = await supabase
    .from('connections')
    .select('org_id, id, encrypted_refresh_token, metadata')
    .eq('provider', 'lemonsqueezy')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!connection?.encrypted_refresh_token) {
    return NextResponse.json({ received: true, skipped: 'No active Lemon Squeezy connection' })
  }

  const webhookSecret = decrypt(connection.encrypted_refresh_token)

  if (!verifyWebhookSignature(body, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const orgId = connection.org_id
  const meta = connection.metadata as Record<string, unknown> | null
  const storeId = meta?.store_id ? String(meta.store_id) : ''

  // Extract data and attributes from JSON:API payload
  const data = payload.data as { id: string; attributes: Record<string, unknown> } | undefined
  if (!data?.id) {
    return NextResponse.json({ received: true })
  }
  const attrs = data.attributes
  const resourceId = data.id

  // Idempotency: check if event already processed
  const eventId = `ls_${eventName}_${resourceId}_${(attrs.updated_at as string) ?? Date.now()}`
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
      provider: 'lemonsqueezy',
      event_type: eventName,
      payload: payload as unknown as Json,
      status: 'processing',
    }, { onConflict: 'event_id' })
    .select('id')
    .single()

  let processError: string | null = null

  try {
    switch (eventName) {
      case 'order_created': {
        if ((attrs.status as string) === 'paid') {
          await syncLSOrder(orgId, resourceId, attrs, supabase)
        }
        break
      }

      case 'order_refunded': {
        // Sync the order (will handle refund internally)
        await syncLSOrder(orgId, resourceId, attrs, supabase)
        break
      }

      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_cancelled':
      case 'subscription_resumed':
      case 'subscription_expired':
      case 'subscription_paused':
      case 'subscription_unpaused': {
        const lsCustId = attrs.customer_id ? String(attrs.customer_id) : null
        let internalCustomerId: string | null = null
        if (lsCustId) {
          const { data: cust } = await supabase
            .from('customers')
            .select('id')
            .eq('org_id', orgId)
            .eq('external_id', `ls_cust_${lsCustId}`)
            .maybeSingle()
          internalCustomerId = cust?.id ?? null
        }
        await syncLSSubscription(orgId, resourceId, attrs, internalCustomerId, supabase)
        break
      }

      case 'subscription_payment_success':
      case 'subscription_payment_recovered': {
        // The payload data object is the subscription invoice
        const { amount, subId } = await syncLSSubscriptionInvoice(orgId, resourceId, attrs, supabase)

        // Update subscription amount from this payment
        if (subId && amount > 0) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('org_id', orgId)
            .eq('external_id', `ls_sub_${subId}`)
            .maybeSingle()
          if (sub) {
            await supabase.from('subscriptions').update({ amount }).eq('id', sub.id)
          }
        }
        break
      }

      case 'subscription_payment_failed': {
        // Update subscription status to past_due
        const lsSubId = attrs.subscription_id ? String(attrs.subscription_id) : null
        if (lsSubId) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('org_id', orgId)
            .eq('external_id', `ls_sub_${lsSubId}`)
        }
        break
      }

      default:
        break
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
    console.error(`Lemon Squeezy webhook error for ${eventName} ${resourceId}:`, processError)
  }

  return NextResponse.json({ received: true })
}
