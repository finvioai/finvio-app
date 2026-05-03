import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ─── Column mapping ───────────────────────────────────────────────────────────

export interface ColumnMapping {
  date: string         // CSV column name for date
  amount?: string      // CSV column name for amount (required unless debit+credit are set)
  description: string  // CSV column name for description
  type?: string        // CSV column name for income/expense (optional)
  category?: string    // CSV column name for category (optional)
  // For debit/credit column style (bank statements)
  debit?: string       // CSV column name for debit amount
  credit?: string      // CSV column name for credit amount
  // Positive amount direction when type column is absent
  positiveIs?: 'income' | 'expense'
}

export interface ParsedRow {
  date: string                    // ISO YYYY-MM-DD
  amount: number
  description: string
  type: 'income' | 'expense'
  category?: string
  rawRow: Record<string, string>  // original row for debugging
  rowIndex: number
}

export interface ParseError {
  rowIndex: number
  reason: string
  rawRow: Record<string, string>
}

export interface ParseResult {
  rows: ParsedRow[]
  errors: ParseError[]
  headers: string[]
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

const DATE_FORMATS: Array<(s: string) => Date | null> = [
  // YYYY-MM-DD
  (s) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(s) : null },
  // MM/DD/YYYY or MM-DD-YYYY
  (s) => { const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); return m ? new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`) : null },
  // DD/MM/YYYY — ambiguous, only used when day > 12
  (s) => { const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); if (!m || parseInt(m[2]) <= 12) return null; return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`) },
  // Month DD, YYYY  e.g. "Jan 15, 2024"
  (s) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d },
]

function parseDate(raw: string): string | null {
  const s = raw.trim()
  for (const tryParse of DATE_FORMATS) {
    const d = tryParse(s)
    if (d && !isNaN(d.getTime())) {
      const y = d.getFullYear()
      if (y < 1900 || y > 2100) continue
      return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }
  return null
}

// ─── Amount parsing ───────────────────────────────────────────────────────────

function parseAmount(raw: string): number | null {
  // Strip currency symbols, spaces, commas; keep digits, dot, minus, parens
  let s = raw.trim().replace(/[\$£€¥,\s]/g, '')
  // Accounting negatives: (1234.56) → -1234.56
  if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1)
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ─── Raw file parsing ─────────────────────────────────────────────────────────

function stripBOM(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

export function parseRawFile(buffer: Buffer, fileType: string): { headers: string[]; rawRows: Record<string, string>[] } {
  if (fileType === 'csv' || fileType === 'text/csv') {
    const text = stripBOM(buffer.toString('utf8'))
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })
    return {
      headers: result.meta.fields ?? [],
      rawRows: result.data,
    }
  }

  // XLSX
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const rawRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? '')]))
  )

  return { headers, rawRows }
}

// ─── Apply column mapping ─────────────────────────────────────────────────────

export function applyColumnMapping(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping
): ParseResult {
  const rows: ParsedRow[] = []
  const errors: ParseError[] = []

  rawRows.forEach((raw, idx) => {
    const rowIndex = idx + 2 // 1-indexed + header row

    // Date
    const rawDate = raw[mapping.date] ?? ''
    const date = parseDate(rawDate)
    if (!date) {
      errors.push({ rowIndex, reason: `Cannot parse date: "${rawDate}"`, rawRow: raw })
      return
    }

    // Amount
    let amount: number
    let type: 'income' | 'expense'

    if (mapping.debit && mapping.credit) {
      // Debit/credit column style (bank statement)
      const debitRaw = raw[mapping.debit] ?? ''
      const creditRaw = raw[mapping.credit] ?? ''
      const debit = debitRaw.trim() ? parseAmount(debitRaw) : null
      const credit = creditRaw.trim() ? parseAmount(creditRaw) : null

      if (credit && !debit) {
        amount = Math.abs(credit)
        type = 'income'
      } else if (debit && !credit) {
        amount = Math.abs(debit)
        type = 'expense'
      } else {
        errors.push({ rowIndex, reason: 'Row has both debit and credit values — skipping', rawRow: raw })
        return
      }
    } else {
      const rawAmt = mapping.amount ? (raw[mapping.amount] ?? '') : ''
      const parsed = parseAmount(rawAmt)
      if (parsed === null) {
        errors.push({ rowIndex, reason: `Cannot parse amount: "${rawAmt}"`, rawRow: raw })
        return
      }

      if (mapping.type) {
        const typeRaw = (raw[mapping.type] ?? '').toLowerCase()
        type = typeRaw.includes('income') || typeRaw.includes('credit') || typeRaw.includes('deposit')
          ? 'income'
          : 'expense'
        amount = Math.abs(parsed)
      } else {
        // Use sign + positiveIs preference
        const positiveIs = mapping.positiveIs ?? 'income'
        if (parsed >= 0) {
          type = positiveIs
        } else {
          type = positiveIs === 'income' ? 'expense' : 'income'
        }
        amount = Math.abs(parsed)
      }
    }

    if (amount === 0) {
      errors.push({ rowIndex, reason: 'Zero-amount row — skipping', rawRow: raw })
      return
    }

    // Description
    const description = (raw[mapping.description] ?? '').trim()
    if (!description) {
      errors.push({ rowIndex, reason: 'Empty description — skipping', rawRow: raw })
      return
    }

    // Category (optional)
    const category = mapping.category ? (raw[mapping.category] ?? '').trim() || undefined : undefined

    rows.push({ date, amount, description, type, category, rawRow: raw, rowIndex })
  })

  return { rows, errors, headers: Object.keys(rawRows[0] ?? {}) }
}
