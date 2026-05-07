import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedEmailTransaction {
  amount: number
  type: 'income' | 'expense'
  vendor: string
  extractorId: string
}

// ─── Extractor interface ──────────────────────────────────────────────────────

interface EmailExtractor {
  readonly id: string
  canHandle(subject: string, from: string, body: string): boolean
  extract(subject: string, from: string, body: string): ParsedEmailTransaction | null
}

// ─── Keyword lists ────────────────────────────────────────────────────────────

const INCOME_KEYWORDS = [
  'payment received', 'you received', 'you were paid',
  'payment confirmation', 'payment processed', 'payment successful',
  'invoice paid', 'paid invoice', 'order confirmed', 'order placed',
  'purchase confirmation', 'receipt from', 'thanks for your payment',
  "we've received your payment", 'we received your payment',
  'funds received', 'deposit confirmation', 'money received',
  'transfer received', 'you got paid',
]

const EXPENSE_KEYWORDS = [
  'invoice from', 'invoice #', 'your invoice', 'new invoice',
  'payment due', 'payment reminder', 'amount due', 'balance due',
  'subscription renewed', 'subscription renewal', 'subscription charge',
  'billing statement', 'your statement', 'charge from',
  'auto-renewal', 'automatic payment', 'recurring charge',
  'renewal notice', 'service renewal', 'your receipt',
  'receipt for your', 'order receipt', 'charged to your',
]

// Matches: $10, $10.99, $1,000.00, USD 10.00
const AMOUNT_REGEX = /(?:\$|USD\s*)\s*([\d,]+(?:\.\d{1,2})?)/gi

// ─── RegexExtractor — universal fallback ─────────────────────────────────────

function classifyEmailText(subject: string, body: string): 'income' | 'expense' | null {
  const text = `${subject} ${body}`.toLowerCase()
  const incomeScore = INCOME_KEYWORDS.filter((kw) => text.includes(kw)).length
  const expenseScore = EXPENSE_KEYWORDS.filter((kw) => text.includes(kw)).length
  if (incomeScore === 0 && expenseScore === 0) return null
  return incomeScore >= expenseScore ? 'income' : 'expense'
}

function extractLargestAmount(subject: string, body: string): number | null {
  const text = `${subject} ${body}`
  const matches = [...text.matchAll(AMOUNT_REGEX)]
  if (matches.length === 0) return null
  const amounts = matches
    .map((m) => parseFloat(m[1].replace(/,/g, '')))
    .filter((n) => !isNaN(n) && n > 0 && n < 1_000_000)
  return amounts.length > 0 ? Math.max(...amounts) : null
}

class RegexExtractor implements EmailExtractor {
  readonly id = 'regex-v1'

  canHandle(): boolean {
    return true // universal fallback — always try
  }

  extract(subject: string, from: string, body: string): ParsedEmailTransaction | null {
    const amount = extractLargestAmount(subject, body)
    if (amount === null) return null

    const type = classifyEmailText(subject, body)
    if (type === null) return null

    return { amount, type, vendor: extractVendor(from), extractorId: this.id }
  }
}

// ─── Extractor chain ──────────────────────────────────────────────────────────
// Ordered: provider-specific (future) → regex → AI (future, last resort)

const EXTRACTORS: EmailExtractor[] = [
  new RegexExtractor(),
]

// ─── Public API ───────────────────────────────────────────────────────────────

export function isFinancialEmail(subject: string): boolean {
  const lower = subject.toLowerCase()
  return [...INCOME_KEYWORDS, ...EXPENSE_KEYWORDS].some((kw) => lower.includes(kw))
}

export function extractEmailTransaction(
  subject: string,
  from: string,
  body: string
): ParsedEmailTransaction | null {
  for (const extractor of EXTRACTORS) {
    if (extractor.canHandle(subject, from, body)) {
      const result = extractor.extract(subject, from, body)
      if (result) return result
    }
  }
  return null
}

export function extractVendor(fromHeader: string): string {
  // "Company Name <email@domain.com>" → "Company Name"
  const nameMatch = fromHeader.match(/^([^<]+)</)
  if (nameMatch) return nameMatch[1].trim()
  // "email@domain.com" → "domain" (strip TLD)
  const domainMatch = fromHeader.match(/@([\w-]+)(?:\.[\w.]+)?/)
  if (domainMatch) return domainMatch[1]
  return fromHeader.trim()
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function checkCrossSourceDuplicate(
  orgId: string,
  amount: number,
  type: 'income' | 'expense',
  date: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const d = new Date(date)
  const minus2 = new Date(d.getTime() - 2 * 86_400_000).toISOString().slice(0, 10)
  const plus2 = new Date(d.getTime() + 2 * 86_400_000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('org_id', orgId)
    .eq('amount', amount)
    .eq('type', type)
    .gte('date', minus2)
    .lte('date', plus2)
    .not('source', 'in', '(gmail,outlook)')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  return !!data
}

// Returns invoiceId if a high-confidence match is found; does NOT update the invoice.
// The user reviews the link via the review queue (is_reviewed: false).
export async function findMatchingInvoice(
  orgId: string,
  amount: number,
  senderEmail: string,
  emailBody: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, total_amount, customer_email')
    .eq('org_id', orgId)
    .in('status', ['sent', 'overdue'])

  if (!openInvoices?.length) return null

  // Invoice number patterns: INV-123, Invoice #123, #123
  const invNumMatch = emailBody.match(/(?:invoice\s*#?|INV-|inv-)\s*(\w[\w-]*)/i)
  const emailInvoiceNum = invNumMatch?.[1]?.toLowerCase()

  for (const inv of openInvoices) {
    const invoiceAmount = inv.total_amount ?? inv.amount
    if (Math.abs(invoiceAmount - amount) > 0.01) continue

    const emailMatches =
      senderEmail &&
      inv.customer_email &&
      inv.customer_email.toLowerCase() === senderEmail.toLowerCase()

    const invNumMatches =
      emailInvoiceNum &&
      inv.invoice_number.toLowerCase().includes(emailInvoiceNum)

    if (emailMatches || invNumMatches) return inv.id
  }

  return null
}
