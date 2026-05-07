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

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const USERINFO_URL = 'https://www.googleapis.com/userinfo/v2/me'

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function getGmailOAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent', // required to always receive a refresh_token
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeGmailCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gmail token exchange failed (${res.status}): ${body}`)
  }
  const tokens = await res.json() as { access_token: string; refresh_token: string }
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Gmail did not return required tokens')
  }

  const infoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const info = infoRes.ok ? (await infoRes.json() as { email?: string }) : {}

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    email: info.email ?? '',
  }
}

async function refreshGmailToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gmail token refresh failed (${res.status}): ${body}`)
  }
  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Gmail refresh returned no access token')
  return data.access_token
}

// ─── Gmail API helpers ────────────────────────────────────────────────────────

interface GmailMessageRef { id: string }

interface GmailListResponse {
  messages?: GmailMessageRef[]
  nextPageToken?: string
}

interface GmailPart {
  mimeType: string
  body?: { data?: string }
  parts?: GmailPart[]
}

interface GmailMessage {
  payload?: GmailPart & {
    headers?: Array<{ name: string; value: string }>
  }
}

function extractBodyText(part: GmailPart, maxLen = 2000): string {
  if (part.mimeType === 'text/plain' && part.body?.data) {
    const text = Buffer.from(part.body.data, 'base64url').toString('utf-8')
    return text.slice(0, maxLen)
  }
  if (part.parts) {
    for (const child of part.parts) {
      const text = extractBodyText(child, maxLen)
      if (text) return text
    }
  }
  // HTML fallback — strip tags
  if (part.mimeType === 'text/html' && part.body?.data) {
    const html = Buffer.from(part.body.data, 'base64url').toString('utf-8')
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen)
  }
  return ''
}

async function listGmailMessages(
  accessToken: string,
  query: string,
  pageToken?: string
): Promise<GmailListResponse> {
  const params = new URLSearchParams({ q: query, maxResults: '50' })
  if (pageToken) params.set('pageToken', pageToken)
  const res = await fetch(`${GMAIL_API_BASE}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('GMAIL_TOKEN_EXPIRED')
    const errBody = await res.text().catch(() => '')
    throw new Error(`Gmail list messages failed (${res.status}): ${errBody}`)
  }
  return res.json() as Promise<GmailListResponse>
}

async function getGmailMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail get message failed (${res.status})`)
  return res.json() as Promise<GmailMessage>
}

// ─── Main sync ────────────────────────────────────────────────────────────────

export async function syncGmailTransactions(
  orgId: string,
  connectionId: string,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number; error?: string }> {
  const { data: conn } = await supabase
    .from('connections')
    .select('encrypted_access_token, encrypted_refresh_token, last_synced_at')
    .eq('id', connectionId)
    .single()

  if (!conn?.encrypted_access_token || !conn.encrypted_refresh_token) {
    return { synced: 0, skipped: 0, error: 'Gmail connection tokens missing' }
  }

  const refreshToken = decrypt(conn.encrypted_refresh_token)

  // Always refresh access token before sync to avoid mid-run expiry
  let accessToken: string
  try {
    accessToken = await refreshGmailToken(refreshToken)
    await supabase
      .from('connections')
      .update({ encrypted_access_token: encrypt(accessToken) })
      .eq('id', connectionId)
  } catch {
    // Fall back to stored access token
    accessToken = decrypt(conn.encrypted_access_token)
  }

  // Date filter: since last sync (with 1-day overlap) or 90-day lookback for first sync
  const lookbackDate = conn.last_synced_at
    ? new Date(new Date(conn.last_synced_at).getTime() - 86_400_000)
    : new Date(Date.now() - 90 * 86_400_000)
  const afterDate = `${lookbackDate.getFullYear()}/${String(lookbackDate.getMonth() + 1).padStart(2, '0')}/${String(lookbackDate.getDate()).padStart(2, '0')}`
  const query = `subject:(invoice OR receipt OR payment OR charge OR billing OR subscription OR renewal OR statement OR order OR deposit) after:${afterDate}`

  let synced = 0
  let skipped = 0
  let pageToken: string | undefined

  try {
    do {
      const listResp = await listGmailMessages(accessToken, query, pageToken)
      pageToken = listResp.nextPageToken

      for (const ref of listResp.messages ?? []) {
        try {
          const msg = await getGmailMessage(accessToken, ref.id)
          const headers = msg.payload?.headers ?? []
          const subject = headers.find((h) => h.name === 'Subject')?.value ?? ''
          const from = headers.find((h) => h.name === 'From')?.value ?? ''
          const dateHeader = headers.find((h) => h.name === 'Date')?.value ?? ''

          if (!isFinancialEmail(subject)) { skipped++; continue }

          const bodyText = msg.payload ? extractBodyText(msg.payload) : ''
          const parsed = extractEmailTransaction(subject, from, bodyText)
          if (!parsed) { skipped++; continue }

          const emailDate = dateHeader
            ? new Date(dateHeader).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10)

          const sourceRefId = `gmail_${ref.id}`

          // Dedup: same email already processed
          const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('org_id', orgId)
            .eq('source_ref_id', sourceRefId)
            .maybeSingle()
          if (existing) { skipped++; continue }

          // Dedup: already tracked via another integration
          const isDuplicate = await checkCrossSourceDuplicate(
            orgId, parsed.amount, parsed.type, emailDate, supabase
          )
          if (isDuplicate) { skipped++; continue }

          // Invoice link hint (income only)
          const senderEmail = (from.match(/<([^>]+)>/) ?? [])[1] ?? from
          let invoiceId: string | null = null
          if (parsed.type === 'income') {
            invoiceId = await findMatchingInvoice(orgId, parsed.amount, senderEmail, bodyText, supabase)
          }

          const cat = await categorize(subject, parsed.type, orgId)

          await supabase.from('transactions').insert({
            org_id: orgId,
            type: parsed.type,
            amount: parsed.amount,
            description: subject,
            date: emailDate,
            source: 'gmail',
            source_ref_id: sourceRefId,
            vendor: parsed.vendor,
            invoice_id: invoiceId,
            category: cat.category,
            category_confidence: cat.confidence,
            category_method: cat.method,
            revenue_type: cat.revenue_type ?? null,
            is_reviewed: false, // always in review queue
            raw_metadata: {
              from,
              subject,
              message_id: ref.id,
              extractor_id: parsed.extractorId,
              invoice_link_hint: invoiceId ? true : undefined,
            },
          })

          synced++
        } catch {
          skipped++
        }
      }
    } while (pageToken)
  } catch (err) {
    return {
      synced,
      skipped,
      error: err instanceof Error ? err.message : 'Gmail sync failed',
    }
  }

  await supabase
    .from('connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connectionId)

  return { synced, skipped }
}
