import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import {
  syncStripeCharge,
  syncStripeCustomer,
  syncStripeInvoicePaid,
  syncStripeSubscription,
  syncStripePayout,
  getStripeClient,
} from '@/lib/sync/stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Idempotency: check if event already processed
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id, status')
    .eq('event_id', event.id)
    .maybeSingle()

  if (existing?.status === 'processed') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Record event as received
  const { data: eventRecord } = await supabase
    .from('webhook_events')
    .upsert({
      event_id: event.id,
      provider: 'stripe',
      event_type: event.type,
      payload: event as unknown as import('@/types/database').Json,
      status: 'processing',
    }, { onConflict: 'event_id' })
    .select('id')
    .single()

  // Find the org that owns this Stripe account
  // In multi-tenant setup, we match via the connection's metadata or a dedicated org→stripe account mapping.
  // For now we look for a stripe connection and process for its org.
  const { data: connection } = await supabase
    .from('connections')
    .select('org_id, id')
    .eq('provider', 'stripe')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!connection) {
    // Mark as skipped — no Stripe connection configured
    if (eventRecord) {
      await supabase.from('webhook_events').update({ status: 'skipped' }).eq('id', eventRecord.id)
    }
    return NextResponse.json({ received: true, skipped: 'No active Stripe connection' })
  }

  const { org_id: orgId } = connection
  let processError: string | null = null

  try {
    switch (event.type) {
      case 'charge.succeeded':
      case 'charge.updated': {
        const charge = event.data.object as Stripe.Charge
        await syncStripeCharge(orgId, charge, supabase)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await syncStripeInvoicePaid(orgId, invoice, supabase)
        break
      }

      case 'customer.created':
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer
        await syncStripeCustomer(orgId, customer, supabase)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        let internalCustomerId: string | null = null
        if (custId) {
          const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('org_id', orgId)
            .eq('external_id', custId)
            .maybeSingle()
          internalCustomerId = data?.id ?? null
        }
        await syncStripeSubscription(orgId, sub, internalCustomerId, supabase)
        break
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout
        await syncStripePayout(orgId, payout, supabase)
        break
      }

      default:
        // Unhandled event type — acknowledge receipt without processing
        break
    }
  } catch (err) {
    processError = err instanceof Error ? err.message : 'Unknown error'
  }

  // Update event record with final status
  if (eventRecord) {
    await supabase.from('webhook_events').update({
      status: processError ? 'error' : 'processed',
      error: processError,
      processed_at: new Date().toISOString(),
    }).eq('id', eventRecord.id)
  }

  if (processError) {
    console.error(`Stripe webhook processing error for ${event.type}:`, processError)
    // Still return 200 so Stripe doesn't retry (error is logged, not transient)
  }

  return NextResponse.json({ received: true })
}
