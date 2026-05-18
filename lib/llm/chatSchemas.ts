import { z } from 'zod'

// ─── Zod helpers ──────────────────────────────────────────────────────────────

// z.preprocess handles null/undefined → fallback before Zod validates.
// Needed because OpenAI JSON mode returns null for missing optional fields
// and z.string().default() only triggers on undefined, not null.
export function strWithDefault(fallback: string) {
  return z.preprocess(v => (v == null || v === '') ? fallback : v, z.string().min(1))
}

export function optionalStr() {
  return z.preprocess(v => v == null ? undefined : v, z.string().optional())
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const ExpenseSchema = z.object({
  title:      strWithDefault('Expense'),
  amount:     z.coerce.number().positive(),
  category:   strWithDefault('Other Expense'),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: z.preprocess(
    v => (v == null || !['monthly','quarterly','annual','one_time'].includes(String(v))) ? undefined : v,
    z.enum(['monthly','quarterly','annual','one_time']).optional()
  ),
  notes: optionalStr(),
})

export const InvoiceSchema = z.object({
  customerName: z.string().min(1),
  amount:       z.coerce.number().positive(),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:        optionalStr(),
})

export const IncomeSchema = z.object({
  description:  strWithDefault('Payment received'),
  amount:       z.coerce.number().positive(),
  category:     strWithDefault('Other Income'),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source:       optionalStr(),
  project_name: optionalStr(),
})
