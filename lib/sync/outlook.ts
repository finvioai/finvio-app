import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/encryption'
import { categorize } from '@/lib/categorization/rules'
import {
  isFinancialEmail,
  extractEmailTransaction,
  extractVendor,
  checkCrossSourceDuplicate,
  findMatchingInvoice,
} from './emailParser'

const MS_AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/me'
const MS_SCOPES = 'https://graph.microsoft.com/Mail.Read offline_access User.Read'

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function getOutlookOAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: MS_SCOPES,
    state,
    response_mode: 'query',
  })
  return `${MS_AUTH_BASE}/authorize?${params.toString()}`
}

export async function exchangeOutlookCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const res = await fetch(`${MS_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: MS_SCOPES,
    }).toString(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Outlook token exchange failed (${res.status}): ${body}`)
  }
  const tokens = await res.json() as { access_token?: string; refresh_token?: string }
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Outlook did not return required tokens')
  }

  const meRes = await fetch(`${GRAPH_BASE}`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const me = meRes.ok ? (await meRes.json() as { mail?: string; userPrincipalName?: string }) : {}

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    email: me.mail ?? me.userPrincipalName ?? '',
  }
}

// Microsoft rotates refresh tokens — MUST save the new one after every refresh
async function refreshOutlookToken(
  refreshToken: string
): Promise<{ accessToken: string; newRefreshToken: string }> {
  const res = await fetch(`${MS_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MS_SCOPES,
    }).toString(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Outlook token refresh failed (${res.status}): ${body}`)
  }
  const data = await res.json() as { access_token?: string; refresh_token?: string }
  if (!data.access_token) throw new Error('Outlook refresh returned no access token')
  return {
    accessToken: data.access_token,
    newRefreshToken: data.refresh_token ?? refreshToken, // some flows don't return new one
  }
}

// ─── Graph API helpers ────────────────────────────────────────────────────────

interface GraphEmailAddress { address?: string; name?: string }
interface GraphMessage {
  id: string
  subject?: string
  from?: { emailAddress?: GraphEmailAddress }
  receivedDateTime?: string
  body?: { content?: string; contentType?: string }
  bodyPreview?: string
  '@odata.nextLink'?: string
}

interface GraphMessagesResponse {
  value?: GraphMessage[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function fetchGraphMessages(
  accessToken: string,
  urlOrFilter: string
): Promise<GraphMessagesResponse> {
  const res = await fetch(urlOrFilter, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('OUTLOOK_TOKEN_EXPIRED')
    throw new Error(`Graph API failed (${res.status})`)
  }
  return res.json() as Promise<GraphMessagesResponse>
}

// ─── Main sync ────────────────────────────────────────────────────────────────

export async function syncOutlookTransactions(
  orgId: string,
  connectionId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number; error?: string }> {
  const { data: conn } = await supabase
    .from('connections')
    .select('encrypted_access_token, encrypted_refresh_token, sync_cursor, last_synced_at')
    .eq('id', connectionId)
    .single()

  if (!conn?.encrypted_access_token || !conn.encrypted_refresh_token) {
    return { synced: 0, skipped: 0, error: 'Outlook connection tokens missing' }
  }

  const storedRefreshToken = decrypt(conn.encrypted_refresh_token)

  // Always refresh before sync; Microsoft rotates refresh tokens — save new one
  let accessToken: string
  try {
    const refreshed = await refreshOutlookToken(storedRefreshToken)
    accessToken = refreshed.accessToken
    await supabase
      .from('connections')
      .update({
        encrypted_access_token: encrypt(accessToken),
        encrypted_refresh_token: encrypt(refreshed.newRefreshToken),
      })
      .eq('id', connectionId)
  } catch {
    accessToken = decrypt(conn.encrypted_access_token)
  }

  // Build initial request URL
  let nextUrl: string
  const deltaLink = conn.sync_cursor as string | null

  if (deltaLink) {
    // Incremental sync using stored delta link
    nextUrl = deltaLink
  } else {
    // Full sync: messages from last 90 days
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const params = new URLSearchParams({
      '$filter': `receivedDateTime ge ${since}`,
      '$select': 'id,subject,from,receivedDateTime,body,bodyPreview',
      '$top': '50',
      '$orderby': 'receivedDateTime desc',
    })
    nextUrl = `${GRAPH_BASE}/messages?${params.toString()}`
  }

  let synced = 0
  let skipped = 0
  let finalDeltaLink: string | undefined

  try {
    while (nextUrl) {
      const page = await fetchGraphMessages(accessToken, nextUrl)
      finalDeltaLink = page['@odata.deltaLink']
      nextUrl = page['@odata.nextLink'] ?? ''

      for (const msg of page.value ?? []) {
        try {
          const subject = msg.subject ?? ''
          const from = msg.from?.emailAddress
            ? `${msg.from.emailAddress.name ?? ''} <${msg.from.emailAddress.address ?? ''}>`.trim()
            : ''
          const emailDate = msg.receivedDateTime
            ? msg.receivedDateTime.slice(0, 10)
            : new Date().toISOString().slice(0, 10)

          if (!isFinancialEmail(subject)) { skipped++; continue }

          const rawBody = msg.body?.content ?? msg.bodyPreview ?? ''
          const bodyText = msg.body?.contentType === 'html'
            ? stripHtml(rawBody).slice(0, 2000)
            : rawBody.slice(0, 2000)

          const parsed = extractEmailTransaction(subject, from, bodyText)
          if (!parsed) { skipped++; continue }

          const sourceRefId = `outlook_${msg.id}`

          // Dedup: check including soft-deleted so we can restore rather than re-insert
          const { data: existing } = await supabase
            .from('transactions')
            .select('id, deleted_at')
            .eq('org_id', orgId)
            .eq('source_ref_id', sourceRefId)
            .maybeSingle()
          if (existing && !existing.deleted_at) { skipped++; continue }

          // Cross-source dedup (only for truly new records, not restores)
          if (!existing) {
            const isDuplicate = await checkCrossSourceDuplicate(
              orgId, parsed.amount, parsed.type, emailDate, supabase
            )
            if (isDuplicate) { skipped++; continue }
          }

          // Invoice link hint (income only)
          const senderEmail = msg.from?.emailAddress?.address ?? ''
          let invoiceId: string | null = null
          if (parsed.type === 'income') {
            invoiceId = await findMatchingInvoice(orgId, parsed.amount, senderEmail, bodyText, supabase)
          }

          const cat = await categorize(subject, parsed.type, orgId)

          const payload = {
            org_id: orgId,
            type: parsed.type,
            amount: parsed.amount,
            description: subject,
            date: emailDate,
            source: 'outlook',
            source_ref_id: sourceRefId,
            vendor: parsed.vendor,
            invoice_id: invoiceId,
            category: cat.category,
            category_confidence: cat.confidence,
            category_method: cat.method,
            revenue_type: cat.revenue_type ?? null,
            is_reviewed: false,
            deleted_at: null,
            raw_metadata: {
              from,
              subject,
              message_id: msg.id,
              extractor_id: parsed.extractorId,
              invoice_link_hint: invoiceId ? true : undefined,
            },
          }

          const { error } = existing?.deleted_at
            ? await supabase.from('transactions').update(payload).eq('id', existing.id)
            : await supabase.from('transactions').insert(payload)

          if (!error) synced++
        } catch {
          skipped++
        }
      }
    }
  } catch (err) {
    return {
      synced,
      skipped,
      error: err instanceof Error ? err.message : 'Outlook sync failed',
    }
  }

  await supabase
    .from('connections')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_cursor: finalDeltaLink ?? conn.sync_cursor ?? null,
    })
    .eq('id', connectionId)

  return { synced, skipped }
}
