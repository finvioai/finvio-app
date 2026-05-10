import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { categorize } from '@/lib/categorization/rules'
import { decrypt } from '@/lib/encryption'

export function getStripeClient(secretKey?: string) {
  const key = secretKey ?? process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('No Stripe secret key available')
  return new Stripe(key)
}

// ─── Stripe Connect OAuth helpers ─────────────────────────────────────────────

export function getStripeOAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.STRIPE_CLIENT_ID!,
    scope: 'read_write',
    redirect_uri: redirectUri,
    state,
  })
  return `https://connect.stripe.com/oauth/authorize?${params}`
}

export async function exchangeStripeCode(code: string): Promise<{
  accessToken: string
  refreshToken: string
  stripeUserId: string
  email: string
}> {
  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Token exchange failed')

  // Fetch account name for display using the connected account's token
  let email: string = data.stripe_user_id
  try {
    const stripe = getStripeClient(data.access_token)
    const account = await stripe.accounts.retrieve(null as unknown as string)
    email = account.email ?? (account.business_profile as { name?: string })?.name ?? data.stripe_user_id
  } catch {
    // Non-fatal: fall back to stripe_user_id as the display name
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    stripeUserId: data.stripe_user_id,
    email,
  }
}

export async function getStripeClientForOrg(orgId: string, supabase: SupabaseClient): Promise<Stripe> {
  const { data: connection } = await supabase
    .from('connections')
    .select('encrypted_access_token')
    .eq('org_id', orgId)
    .eq('provider', 'stripe')
    .eq('status', 'active')
    .maybeSingle()

  if (connection?.encrypted_access_token) {
    const key = decrypt(connection.encrypted_access_token)
    return getStripeClient(key)
  }
  return getStripeClient()
}

// ─── Customer sync ────────────────────────────────────────────────────────────

export async function syncStripeCustomer(
  orgId: string,
  customer: Stripe.Customer,
  supabase: SupabaseClient
) {
  const existing = await supabase
    .from('customers')
    .select('id')
    .eq('org_id', orgId)
    .eq('external_id', customer.id)
    .maybeSingle()

  const record = {
    org_id: orgId,
    external_id: customer.id,
    email: customer.email ?? null,
    name: customer.name ?? null,
    source: 'stripe',
    status: customer.deleted ? 'churned' : 'active',
    metadata: customer.metadata as Record<string, string> | null,
  }

  if (existing.data) {
    await supabase.from('customers').update(record).eq('id', existing.data.id)
    return existing.data.id
  } else {
    const { data } = await supabase.from('customers').insert(record).select('id').single()
    return data?.id ?? null
  }
}

// ─── Subscription sync ────────────────────────────────────────────────────────

export async function syncStripeSubscription(
  orgId: string,
  sub: Stripe.Subscription,
  customerId: string | null,
  supabase: SupabaseClient
) {
  const plan = sub.items.data[0]
  const amount = plan ? plan.price.unit_amount ?? 0 : 0
  const interval = plan?.price.recurring?.interval ?? 'month'
  const currency = plan?.price.currency ?? 'usd'

  // In Stripe SDK v22+, period dates are on the subscription item, not the subscription itself
  const periodStart = plan?.current_period_start
  const periodEnd = plan?.current_period_end

  const record = {
    org_id: orgId,
    external_id: sub.id,
    customer_id: customerId,
    amount: amount / 100,
    currency,
    interval,
    status: sub.status,
    plan_name: plan?.price.nickname ?? null,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    source: 'stripe',
    metadata: sub.metadata as Record<string, string> | null,
  }

  const existing = await supabase
    .from('subscriptions')
    .select('id')
    .eq('org_id', orgId)
    .eq('external_id', sub.id)
    .maybeSingle()

  if (existing.data) {
    await supabase.from('subscriptions').update(record).eq('id', existing.data.id)
  } else {
    await supabase.from('subscriptions').insert(record)
  }
}

// ─── Charge sync ──────────────────────────────────────────────────────────────

export async function syncStripeCharge(
  orgId: string,
  charge: Stripe.Charge,
  supabase: SupabaseClient
) {
  if (!charge.paid) return

  const amount = charge.amount / 100
  const description = charge.description ?? charge.statement_descriptor ?? 'Stripe payment'
  const date = new Date(charge.created * 1000).toISOString().split('T')[0]

  // Idempotency — skip if already imported (active). Restore if soft-deleted.
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, deleted_at')
    .eq('org_id', orgId)
    .eq('source_ref_id', charge.id)
    .maybeSingle()

  if (existing && !existing.deleted_at) return

  const { category, confidence, method, revenue_type } = await categorize(description, 'income', orgId)

  const payload = {
    org_id: orgId,
    type: 'income' as const,
    amount,
    description,
    date,
    category,
    category_confidence: confidence,
    category_method: method,
    revenue_type: revenue_type ?? 'recurring',
    source: 'stripe',
    source_ref_id: charge.id,
    currency: charge.currency,
    is_reviewed: false,
    deleted_at: null,
    raw_metadata: charge as unknown as Record<string, unknown>,
    vendor: charge.billing_details?.name ?? null,
  }

  if (existing?.deleted_at) {
    await supabase.from('transactions').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('transactions').insert(payload)
  }

  // If this charge has a refund, record it as an expense
  if (charge.amount_refunded > 0) {
    const refundId = `${charge.id}_refund`
    const { data: refundExists } = await supabase
      .from('transactions')
      .select('id, deleted_at')
      .eq('org_id', orgId)
      .eq('source_ref_id', refundId)
      .maybeSingle()

    if (!refundExists || refundExists.deleted_at) {
      const refundPayload = {
        org_id: orgId,
        type: 'expense' as const,
        amount: charge.amount_refunded / 100,
        description: `Refund: ${description}`,
        date,
        category: 'Refunds',
        category_confidence: 'high',
        category_method: 'rule',
        source: 'stripe',
        source_ref_id: refundId,
        currency: charge.currency,
        is_reviewed: true,
        deleted_at: null,
      }
      if (refundExists?.deleted_at) {
        await supabase.from('transactions').update(refundPayload).eq('id', refundExists.id)
      } else {
        await supabase.from('transactions').insert(refundPayload)
      }
    }
  }
}

// ─── Invoice.paid sync ────────────────────────────────────────────────────────

export async function syncStripeInvoicePaid(
  orgId: string,
  invoice: Stripe.Invoice,
  supabase: SupabaseClient
) {
  const amount = (invoice.amount_paid ?? 0) / 100
  if (amount <= 0) return

  const refId = `invoice_${invoice.id}`
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, deleted_at')
    .eq('org_id', orgId)
    .eq('source_ref_id', refId)
    .maybeSingle()

  if (existing && !existing.deleted_at) return

  const date = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  const description = invoice.description ?? `Invoice ${invoice.number ?? invoice.id}`

  const payload = {
    org_id: orgId,
    type: 'income' as const,
    amount,
    description,
    date,
    category: 'Subscription Revenue',
    category_confidence: 'high',
    category_method: 'rule',
    revenue_type: 'recurring',
    source: 'stripe',
    source_ref_id: refId,
    currency: invoice.currency,
    is_reviewed: false,
    deleted_at: null,
    raw_metadata: invoice as unknown as Record<string, unknown>,
  }

  if (existing?.deleted_at) {
    await supabase.from('transactions').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('transactions').insert(payload)
  }
}

// ─── Payout sync ─────────────────────────────────────────────────────────────

export async function syncStripePayout(
  orgId: string,
  payout: Stripe.Payout,
  supabase: SupabaseClient
) {
  const refId = `payout_${payout.id}`
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, deleted_at')
    .eq('org_id', orgId)
    .eq('source_ref_id', refId)
    .maybeSingle()

  if (existing && !existing.deleted_at) return

  const date = new Date(payout.arrival_date * 1000).toISOString().split('T')[0]

  const payload = {
    org_id: orgId,
    type: 'income' as const,
    amount: payout.amount / 100,
    description: `Stripe payout${payout.description ? ` — ${payout.description}` : ''}`,
    date,
    category: 'Subscription Revenue',
    category_confidence: 'high',
    category_method: 'rule',
    revenue_type: 'recurring',
    source: 'stripe',
    source_ref_id: refId,
    currency: payout.currency,
    is_reviewed: true,
    deleted_at: null,
    raw_metadata: payout as unknown as Record<string, unknown>,
  }

  if (existing?.deleted_at) {
    await supabase.from('transactions').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('transactions').insert(payload)
  }
}

// ─── Pull sync (on-demand, last 30 days) ─────────────────────────────────────

export async function runStripePullSync(
  orgId: string,
  connectionId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number; error?: string }> {
  const stripe = await getStripeClientForOrg(orgId, supabase)

  // Log sync start
  const { data: log } = await supabase
    .from('sync_logs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      provider: 'stripe',
      sync_type: 'pull',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  let synced = 0
  let skipped = 0

  try {
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60

    // Pull charges
    for await (const charge of stripe.charges.list({ created: { gte: since }, limit: 100 })) {
      const before = synced
      await syncStripeCharge(orgId, charge, supabase)
      if (synced === before) skipped++; else synced++
    }

    // Pull customers
    for await (const customer of stripe.customers.list({ created: { gte: since }, limit: 100 })) {
      if (!customer.deleted) {
        await syncStripeCustomer(orgId, customer as Stripe.Customer, supabase)
      }
    }

    // Pull subscriptions
    for await (const sub of stripe.subscriptions.list({ limit: 100 })) {
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
    }

    // Update connection last_synced_at
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
