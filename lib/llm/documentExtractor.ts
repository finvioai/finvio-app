import type { PendingAction } from '@/types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/types'
import { getLLMAdapter } from './factory'
import { ExpenseSchema, InvoiceSchema, IncomeSchema } from './chatSchemas'

export type DocumentType =
  | 'receipt'
  | 'invoice_received'
  | 'invoice_sent'
  | 'quotation'
  | 'payment_confirmation'
  | 'unknown'

export interface ExtractedDocument {
  documentType: DocumentType
  pendingAction: PendingAction | null
  extractedFields: Record<string, unknown>
  confidence: 'high' | 'medium' | 'low'
}

export async function extractDocumentData(
  textContent: string,
  provider: string,
  model: string,
): Promise<ExtractedDocument> {
  const adapter = getLLMAdapter(provider as 'openai' | 'anthropic', model)
  const today = new Date().toISOString().split('T')[0]

  let raw: Record<string, unknown> = {}

  try {
    raw = await adapter.extractStructuredOutput<Record<string, unknown>>(
      `You are a financial document parser. The following is text extracted from a PDF document.

<document>
${textContent}
</document>

Identify the document type and extract key financial data.

documentType rules:
- receipt: proof of a purchase or payment the business made (has vendor name + amount paid)
- invoice_received: a bill sent TO the business that they owe (accounts payable)
- invoice_sent: a bill the business issued to a customer (accounts receivable)
- quotation: an estimate or quote for services, to be converted into an invoice
- payment_confirmation: confirmation that someone paid the business
- unknown: cannot determine

Extract:
1. documentType (one of the values above)
2. vendor: the other party's name — supplier/vendor for expenses, or client/customer for invoices/quotations
3. amount: the total amount as a plain number (no $ or commas)
4. date: document date as YYYY-MM-DD (default to ${today} if not found)
5. description: brief label — invoice number, product name, or service description
6. currency: 3-letter ISO code (default "usd")
7. confidence: "high" if amount + vendor both clearly found, "medium" if one is uncertain, "low" if both are unclear`,
      {
        documentType: 'receipt | invoice_received | invoice_sent | quotation | payment_confirmation | unknown',
        vendor: 'string',
        amount: 'number',
        date: 'YYYY-MM-DD',
        description: 'string',
        currency: 'string (3-letter ISO code)',
        confidence: 'high | medium | low',
      }
    )
  } catch {
    return { documentType: 'unknown', pendingAction: null, extractedFields: {}, confidence: 'low' }
  }

  const documentType = (raw.documentType as DocumentType) ?? 'unknown'
  const confidence = (raw.confidence as 'high' | 'medium' | 'low') ?? 'low'

  const pendingAction = buildPendingAction(documentType, raw, today)

  return { documentType, pendingAction, extractedFields: raw, confidence }
}

function buildPendingAction(
  documentType: DocumentType,
  raw: Record<string, unknown>,
  today: string
): PendingAction | null {
  const amount = typeof raw.amount === 'number' ? raw.amount : parseFloat(String(raw.amount ?? '0').replace(/[^0-9.]/g, ''))
  const vendor = String(raw.vendor ?? '')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date)) ? String(raw.date) : today
  const description = String(raw.description ?? vendor ?? 'Document')

  if (!amount || amount <= 0) return null

  if (documentType === 'invoice_sent' || documentType === 'quotation') {
    const parsed = InvoiceSchema.safeParse({
      customerName: vendor || 'Customer',
      amount,
      dueDate: date,
      notes: description,
    })
    if (!parsed.success) return null
    return { type: 'create_invoice', params: parsed.data }
  }

  if (documentType === 'payment_confirmation') {
    const parsed = IncomeSchema.safeParse({
      description: description || `Payment from ${vendor}`,
      amount,
      category: 'Other Income',
      date,
      source: vendor || undefined,
    })
    if (!parsed.success) return null
    return { type: 'add_income', params: parsed.data }
  }

  // receipt | invoice_received | unknown → create_expense
  const bestCategory = guessCategoryFromText(description + ' ' + vendor, EXPENSE_CATEGORIES)
  const parsed = ExpenseSchema.safeParse({
    title: vendor || description || 'Expense',
    amount,
    category: bestCategory,
    date,
    notes: description !== vendor ? description : undefined,
  })
  if (!parsed.success) return null
  return { type: 'create_expense', params: parsed.data }
}

function guessCategoryFromText(text: string, categories: readonly string[]): string {
  const lower = text.toLowerCase()
  const categoryKeywords: Record<string, string[]> = {
    'Software & Tools': ['software', 'saas', 'subscription', 'license', 'tool', 'app', 'plugin'],
    'Marketing': ['marketing', 'advertising', 'ads', 'google', 'facebook', 'meta', 'seo'],
    'Infrastructure': ['aws', 'azure', 'gcp', 'hosting', 'server', 'cloud', 'infrastructure'],
    'Office Supplies': ['office', 'supplies', 'stationery', 'printer', 'paper'],
    'Professional Services': ['consulting', 'legal', 'accounting', 'lawyer', 'attorney', 'audit'],
    'Travel': ['travel', 'flight', 'hotel', 'airbnb', 'uber', 'lyft', 'taxi'],
    'Meals & Entertainment': ['restaurant', 'food', 'meal', 'lunch', 'dinner', 'coffee'],
    'Payroll': ['salary', 'payroll', 'wages', 'paycheck'],
    'Rent & Utilities': ['rent', 'lease', 'electricity', 'water', 'utility', 'internet'],
    'Insurance': ['insurance', 'policy', 'premium'],
  }

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (categories.includes(category) && keywords.some(k => lower.includes(k))) {
      return category
    }
  }

  return categories.includes('Other Expense') ? 'Other Expense' : (categories[0] ?? 'Other Expense')
}
