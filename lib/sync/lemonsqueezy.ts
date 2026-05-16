import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'
import crypto from 'crypto'

const LS_API_BASE = 'https://api.lemonsqueezy.com/v1'

// ─── Raw API helpers ──────────────────────────────────────────────────────────

function lsHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
  }
}

async function lsGet(apiKey: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${LS_API_BASE}${path}`, { headers: lsHeaders(apiKey) })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Lemon Squeezy API error ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

async function lsPost(apiKey: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${LS_API_BASE}${path}`, {
    method: 'POST',
    headers: lsHeaders(apiKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Lemon Squeezy API error ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

export async function validateApiKeyAndGetStore(apiKey: string): Promise<{
  storeId: string
  storeName: string
  storeSlug: string
  currency: string
}> {
  const json = await lsGet(apiKey, '/stores?page[size]=1')
  const stores = (json.data as unknown[]) ?? []
  if (!stores.length) throw new Error('No stores found. Make sure this API key has access to a store.')

  const store = stores[0] as { id: string; attributes: Record<string, unknown> }
  return {
    storeId: store.id,
    storeName: String(store.attributes.name ?? ''),
    storeSlug: String(store.attributes.slug ?? ''),
    currency: String(store.attributes.currency ?? 'USD').toLowerCase(),
  }
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString('hex')
}

// Registers a webhook and returns the webhook ID. Fails silently if the app URL is localhost.
export async function registerWebhook(
  apiKey: string,
  storeId: string,
  webhookUrl: string,
  secret: string,
): Promise<string | null> {
  try {
    const json = await lsPost(apiKey, '/webhooks', {
      data: {
        type: 'webhooks',
        attributes: {
          url: webhookUrl,
          events: [
            'order_created',
            'order_refunded',
            'subscription_created',
            'subscription_updated',
            'subscription_cancelled',
            'subscription_resumed',
            'subscription_expired',
            'subscription_paused',
            'subscription_unpaused',
            'subscription_payment_success',
            'subscription_payment_failed',
            'subscription_payment_recovered',
          ],
          secret,
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
        },
      },
    })
    const wh = json.data as { id: string } | undefined
    return wh?.id ?? null
  } catch {
    return null
  }
}

export async function getLSApiKeyForOrg(orgId: string, supabase: SupabaseClient): Promise<string> {
  const { data: connection } = await supabase
    .from('connections')
    .select('encrypted_access_token')
    .eq('org_id', orgId)
    .eq('provider', 'lemonsqueezy')
    .eq('status', 'active')
    .maybeSingle()

  if (!connection?.encrypted_access_token) throw new Error('No active Lemon Squeezy connection')
  return decrypt(connection.encrypted_access_token)
}

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(signature, 'utf8'))
  } catch {
    return false
  }
}

// ─── Subscription interval inference ─────────────────────────────────────────

function inferInterval(createdAt: string, renewsAt: string): string {
  const created = new Date(createdAt).getTime()
  const renews = new Date(renewsAt).getTime()
  const days = (renews - created) / 86_400_000
  if (days > 300) return 'year'
  if (days > 85) return 'quarter'
  return 'month'
}

// ─── LS status → our status ───────────────────────────────────────────────────

function mapSubStatus(lsStatus: string): string {
  const map: Record<string, string> = {
    on_trial:  'trialing',
    active:    'active',
    pause:     'paused',
    paused:    'paused',
    past_due:  'past_due',
    unpaid:    'past_due',
    cancelled: 'cancelled',
    expired:   'cancelled',
  }
  return map[lsStatus] ?? lsStatus
}

// ─── Customer sync ────────────────────────────────────────────────────────────

export async function syncLSCustomer(
  orgId: string,
  custId: string,
  attrs: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string | null> {
  const externalId = `ls_cust_${custId}`
  const record = {
    org_id: orgId,
    external_id: externalId,
    email: (attrs.email as string) ?? null,
    name: (attrs.name as string) ?? null,
    source: 'lemonsqueezy',
    status: (attrs.status as string) === 'archived' ? 'inactive' : 'active',
    metadata: { ls_status: attrs.status } as Record<string, unknown>,
  }

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('org_id', orgId)
    .eq('external_id', externalId)
    .maybeSingle()

  if (existing) {
    await supabase.from('customers').update(record).eq('id', existing.id)
    return existing.id
  } else {
    const { data } = await supabase.from('customers').insert(record).select('id').single()
    return data?.id ?? null
  }
}

// ─── Subscription sync ────────────────────────────────────────────────────────

export async function syncLSSubscription(
  orgId: string,
  subId: string,
  attrs: Record<string, unknown>,
  customerId: string | null,
  supabase: SupabaseClient,
  amountOverride?: number,
) {
  const lsStatus = String(attrs.status ?? 'active')
  const status = mapSubStatus(lsStatus)
  const createdAt = String(attrs.created_at ?? new Date().toISOString())
  const renewsAt = String(attrs.renews_at ?? new Date().toISOString())
  const endsAt = (attrs.ends_at as string | null) ?? null
  const cancelledAt = (attrs.cancelled as boolean) ? endsAt : null
  const interval = inferInterval(createdAt, renewsAt)
  const planName = String(attrs.variant_name ?? attrs.product_name ?? '')

  const record = {
    org_id: orgId,
    external_id: `ls_sub_${subId}`,
    customer_id: customerId,
    amount: amountOverride ?? 0,
    currency: 'usd',
    interval,
    status,
    plan_name: planName || null,
    current_period_start: null as string | null,
    current_period_end: renewsAt,
    cancelled_at: cancelledAt,
    source: 'lemonsqueezy',
    metadata: { ls_status: lsStatus, renews_at: renewsAt } as Record<string, unknown>,
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, amount')
    .eq('org_id', orgId)
    .eq('external_id', `ls_sub_${subId}`)
    .maybeSingle()

  if (existing) {
    // Only update amount if we have a concrete value; don't overwrite known amount with 0
    if (!amountOverride && existing.amount > 0) {
      const { amount: _unused, ...rest } = record
      void _unused
      await supabase.from('subscriptions').update(rest).eq('id', existing.id)
    } else {
      await supabase.from('subscriptions').update(record).eq('id', existing.id)
    }
  } else {
    await supabase.from('subscriptions').insert(record)
  }
}

// ─── Order sync (one-time revenue) ───────────────────────────────────────────

export async function syncLSOrder(
  orgId: string,
  orderId: string,
  attrs: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  if ((attrs.status as string) !== 'paid') return

  const amount = ((attrs.total as number) ?? 0) / 100
  if (amount <= 0) return

  const date = String(attrs.created_at ?? new Date().toISOString()).split('T')[0]
  const customerName = String(attrs.user_name ?? '')
  const customerEmail = String(attrs.user_email ?? '')
  const orderNumber = String(attrs.order_number ?? orderId)
  const currency = String(attrs.currency ?? 'usd').toLowerCase()
  const description = `Order #${orderNumber}${customerName ? ` — ${customerName}` : ''}`
  const refId = `ls_order_${orderId}`

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, deleted_at')
    .eq('org_id', orgId)
    .eq('source_ref_id', refId)
    .maybeSingle()

  if (existing && !existing.deleted_at) {
    // Handle refund update even if income already exists
    if (attrs.refunded as boolean) await syncLSOrderRefund(orgId, orderId, attrs, supabase)
    return
  }

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
    revenue_type: revenue_type ?? 'one_time',
    source: 'lemonsqueezy',
    source_ref_id: refId,
    currency,
    is_reviewed: false,
    deleted_at: null,
    raw_metadata: attrs as Record<string, unknown>,
    vendor: customerEmail || null,
  }

  if (existing?.deleted_at) {
    await supabase.from('transactions').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('transactions').insert(payload)
  }

  if (attrs.refunded as boolean) {
    await syncLSOrderRefund(orgId, orderId, attrs, supabase)
  }
}

async function syncLSOrderRefund(
  orgId: string,
  orderId: string,
  attrs: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const refundId = `ls_order_${orderId}_refund`
  const { data: refundExists } = await supabase
    .from('transactions')
    .select('id, deleted_at')
    .eq('org_id', orgId)
    .eq('source_ref_id', refundId)
    .maybeSingle()

  if (refundExists && !refundExists.deleted_at) return

  const refundAmount = ((attrs.refunded_amount as number) ?? (attrs.total as number) ?? 0) / 100
  if (refundAmount <= 0) return

  const date = String(attrs.refunded_at ?? attrs.created_at ?? new Date().toISOString()).split('T')[0]
  const orderNumber = String(attrs.order_number ?? orderId)
  const currency = String(attrs.currency ?? 'usd').toLowerCase()

  const refundPayload = {
    org_id: orgId,
    type: 'expense' as const,
    amount: refundAmount,
    description: `Refund: Order #${orderNumber}`,
    date,
    category: 'Refund Issued',
    category_confidence: 'high' as const,
    category_method: 'rule' as const,
    source: 'lemonsqueezy',
    source_ref_id: refundId,
    currency,
    is_reviewed: true,
    deleted_at: null,
  }

  if (refundExists?.deleted_at) {
    await supabase.from('transactions').update(refundPayload).eq('id', refundExists.id)
  } else {
    await supabase.from('transactions').insert(refundPayload)
  }
}

// ─── Subscription invoice sync ────────────────────────────────────────────────

export async function syncLSSubscriptionInvoice(
  orgId: string,
  invoiceId: string,
  attrs: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ subId: string | null; amount: number }> {
  const status = String(attrs.status ?? '')
  const subId = attrs.subscription_id ? String(attrs.subscription_id) : null
  const amount = ((attrs.total as number) ?? 0) / 100
  const refunded = attrs.refunded as boolean

  if (status !== 'paid' || amount <= 0) return { subId, amount: 0 }

  const refId = `ls_subinv_${invoiceId}`
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, deleted_at')
    .eq('org_id', orgId)
    .eq('source_ref_id', refId)
    .maybeSingle()

  if (existing && !existing.deleted_at) return { subId, amount }

  const date = String(attrs.created_at ?? new Date().toISOString()).split('T')[0]
  const currency = String(attrs.currency ?? 'usd').toLowerCase()
  const customerName = String(attrs.user_name ?? '')
  const billingReason = String(attrs.billing_reason ?? 'renewal')
  const description = `Lemon Squeezy subscription ${billingReason}${customerName ? ` — ${customerName}` : ''}`

  const payload = {
    org_id: orgId,
    type: 'income' as const,
    amount,
    description,
    date,
    category: 'Subscription Revenue',
    category_confidence: 'high' as const,
    category_method: 'rule' as const,
    revenue_type: 'recurring' as const,
    source: 'lemonsqueezy',
    source_ref_id: refId,
    currency,
    is_reviewed: false,
    deleted_at: null,
    raw_metadata: attrs as Record<string, unknown>,
  }

  if (existing?.deleted_at) {
    await supabase.from('transactions').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('transactions').insert(payload)
  }

  // If refunded, record the refund as an expense
  if (refunded) {
    const refundId = `ls_subinv_${invoiceId}_refund`
    const { data: refundExists } = await supabase
      .from('transactions')
      .select('id, deleted_at')
      .eq('org_id', orgId)
      .eq('source_ref_id', refundId)
      .maybeSingle()

    if (!refundExists || refundExists.deleted_at) {
      const refundDate = String(attrs.refunded_at ?? attrs.created_at ?? new Date().toISOString()).split('T')[0]
      const refundPayload = {
        org_id: orgId,
        type: 'expense' as const,
        amount,
        description: `Refund: ${description}`,
        date: refundDate,
        category: 'Refund Issued',
        category_confidence: 'high' as const,
        category_method: 'rule' as const,
        source: 'lemonsqueezy',
        source_ref_id: refundId,
        currency,
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

  return { subId, amount }
}

// ─── Pull sync ────────────────────────────────────────────────────────────────

export async function runLSPullSync(
  orgId: string,
  connectionId: string,
  apiKey: string,
  storeId: string,
  supabase: SupabaseClient,
): Promise<{ synced: number; skipped: number; error?: string }> {
  const { data: log } = await supabase
    .from('sync_logs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      provider: 'lemonsqueezy',
      sync_type: 'pull',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  let synced = 0
  let skipped = 0

  try {
    // 1. Sync customers
    const customersJson = await lsGet(apiKey, `/customers?filter[store_id]=${storeId}&page[size]=100`)
    for (const cust of (customersJson.data as Array<{ id: string; attributes: Record<string, unknown> }>) ?? []) {
      await syncLSCustomer(orgId, cust.id, cust.attributes, supabase)
    }

    // 2. Sync subscriptions (status tracking only; amounts come from invoices below)
    const subsJson = await lsGet(apiKey, `/subscriptions?filter[store_id]=${storeId}&page[size]=100`)
    const subAttrsMap = new Map<string, { attrs: Record<string, unknown>; customerId: string | null }>()

    for (const sub of (subsJson.data as Array<{ id: string; attributes: Record<string, unknown> }>) ?? []) {
      const lsCustId = sub.attributes.customer_id ? String(sub.attributes.customer_id) : null
      let internalCustomerId: string | null = null
      if (lsCustId) {
        const { data } = await supabase
          .from('customers')
          .select('id')
          .eq('org_id', orgId)
          .eq('external_id', `ls_cust_${lsCustId}`)
          .maybeSingle()
        internalCustomerId = data?.id ?? null
      }
      subAttrsMap.set(sub.id, { attrs: sub.attributes, customerId: internalCustomerId })
      await syncLSSubscription(orgId, sub.id, sub.attributes, internalCustomerId, supabase)
    }

    // 3. Sync subscription invoices — also update subscription amounts
    const subAmounts = new Map<string, number>() // ls_sub_id → latest paid amount

    let invPage = `/subscription-invoices?filter[store_id]=${storeId}&filter[status]=paid&page[size]=100`
    while (invPage) {
      const invJson = await lsGet(apiKey, invPage.startsWith('http') ? invPage.replace(LS_API_BASE, '') : invPage)
      for (const inv of (invJson.data as Array<{ id: string; attributes: Record<string, unknown> }>) ?? []) {
        const before = synced
        const { subId, amount } = await syncLSSubscriptionInvoice(orgId, inv.id, inv.attributes, supabase)
        if (synced === before) skipped++; else synced++
        if (subId && amount > 0 && !subAmounts.has(subId)) {
          subAmounts.set(subId, amount)
        }
      }
      const links = invJson.links as Record<string, string | null> | undefined
      invPage = links?.next ? String(links.next).replace(LS_API_BASE, '') : ''
      if (invPage) await new Promise((r) => setTimeout(r, 1100)) // respect 60 req/min
    }

    // Update subscription amounts from invoices
    for (const [subId, amount] of subAmounts) {
      const subEntry = subAttrsMap.get(subId)
      if (subEntry) {
        await syncLSSubscription(orgId, subId, subEntry.attrs, subEntry.customerId, supabase, amount)
      }
    }

    // 4. Sync paid orders (one-time revenue)
    let orderPage = `/orders?filter[store_id]=${storeId}&filter[status]=paid&page[size]=100`
    while (orderPage) {
      const ordersJson = await lsGet(
        apiKey,
        orderPage.startsWith('http') ? orderPage.replace(LS_API_BASE, '') : orderPage,
      )
      for (const order of (ordersJson.data as Array<{ id: string; attributes: Record<string, unknown> }>) ?? []) {
        const before = synced
        await syncLSOrder(orgId, order.id, order.attributes, supabase)
        if (synced === before) skipped++; else synced++
      }
      const links = ordersJson.links as Record<string, string | null> | undefined
      orderPage = links?.next ? String(links.next).replace(LS_API_BASE, '') : ''
      if (orderPage) await new Promise((r) => setTimeout(r, 1100))
    }

    // 5. Update connection
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

// Re-export encrypt so connection routes can use the same lib
export { encrypt, decrypt }
