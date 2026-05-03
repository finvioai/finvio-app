# CSV / XLSX Import

Finvio can import financial data from any CSV or Excel file. The import system handles messy real-world exports from banks, accounting software, and payment processors.

---

## Supported File Types

| Format | Extension | Notes |
|--------|-----------|-------|
| CSV | `.csv` | UTF-8 or UTF-8 BOM |
| Excel | `.xlsx` | First sheet only |

---

## Import Flow

```
User uploads file on /import page
         │
         ▼
POST /api/import (multipart form: file + mapping JSON)
         │
         ▼
parseRawFile() — extract headers and raw rows
         │
         ▼
Column mapping UI — user maps headers to fields
         │
         ▼
applyColumnMapping() — parse dates, amounts, determine direction
         │
         ▼
For each valid row:
  ├── Check source_ref_id for existing row (skip if duplicate)
  ├── Call categorize() if no category column mapped
  └── INSERT into transactions (source='csv', is_reviewed=false)
         │
         ▼
Update csv_imports record with final counts + error log
```

---

## Column Mapping

The user must map their file's column headers to Finvio's required fields. The mapping is submitted as JSON alongside the file.

**Required fields:**
- `date` — which column contains the transaction date
- `description` — which column contains the transaction description

**Amount: two modes**

**Mode 1 — Single amount column:**
```json
{
  "date": "Transaction Date",
  "description": "Memo",
  "amount": "Amount",
  "positiveIs": "income"    // or "expense"
}
```
`positiveIs` tells the system what a positive number means for this file. For bank statements, positive = money coming in (income). For credit card exports, positive = money going out (expense).

**Mode 2 — Debit / Credit columns (bank statement style):**
```json
{
  "date": "Date",
  "description": "Description",
  "debit": "Withdrawals",
  "credit": "Deposits"
}
```
When only the debit column has a value → expense. When only credit has a value → income. If both have values in the same row → that row is skipped with an error.

**Optional fields:**
```json
{
  "type": "Type",       // column containing 'income'/'expense' labels
  "category": "Category"  // skip categorization engine if provided
}
```

---

## Parsing Details

**File:** [lib/csv-parser.ts](../../lib/csv-parser.ts)

### Date Parsing

Recognizes multiple formats in any order:

| Format | Example |
|--------|---------|
| `YYYY-MM-DD` | `2024-03-15` |
| `MM/DD/YYYY` | `03/15/2024` |
| `MM-DD-YYYY` | `03-15-2024` |
| `DD/MM/YYYY` | `15/03/2024` (only when day > 12 to avoid ambiguity) |
| `Month DD, YYYY` | `March 15, 2024` |
| `Mon DD, YYYY` | `Mar 15, 2024` |

Returns ISO date string or `null` (row skipped on null date).

### Amount Parsing

Strips all currency symbols and formatting before parsing:
- Removes `$`, `£`, `€`, `¥`, commas, spaces
- Handles accounting negatives: `(1,234.56)` → `-1234.56`
- Returns number or `null` (row skipped on null amount)

### BOM Stripping

CSV files from Windows/Excel often start with a UTF-8 BOM (`﻿`). This is stripped automatically so the first column header parses correctly.

---

## Categorization During Import

If the mapping does not include a `category` column, each row goes through the full 3-layer categorization engine (user overrides → org rules → system rules → AI fallback) using the description as input.

If the mapping includes a `category` column, the value from the file is used directly. The `category_method` will be set to `'user'` and `category_confidence = 'high'` since the user's own export already categorized it.

---

## Idempotency

Each row gets a `source_ref_id` of `{importId}_{rowIndex}`:
- `importId` is a UUID created once for the entire import session
- `rowIndex` is the 0-based row number within the file

Before inserting each row, the system checks if a transaction with that `source_ref_id` already exists for this org. If yes, the row is skipped. This prevents duplicates from processing the same row twice within a single import run.

**Note:** Re-uploading the same file creates a new `importId`, so rows would be inserted again. The import system does not deduplicate across separate upload sessions.

---

## Import Record

A `csv_imports` row is created before processing begins:

```typescript
{
  id: uuid,                // becomes the importId
  org_id: uuid,
  file_name: string,       // original filename
  file_url: string,        // Supabase Storage path
  status: 'processing' | 'completed' | 'failed',
  total_rows: number,
  imported_rows: number,   // updated on completion
  skipped_rows: number,    // updated on completion
  error_log: object[],     // array of {rowIndex, reason} for failed rows
  created_at: timestamp
}
```

The file is uploaded to Supabase Storage (`csv-imports` bucket) for audit trail purposes before any parsing begins.

---

## Error Handling

Rows that cannot be parsed are added to `error_log` with a reason:
- "Missing date"
- "Invalid date format: {raw value}"
- "Missing amount"
- "Invalid amount: {raw value}"
- "Both debit and credit have values"
- "Zero amount"
- "Missing description"

Failed rows are skipped; processing continues for all other rows. The final response includes `{imported, skipped, errors: [{rowIndex, reason}]}`.

---

## Import Types

The UI lets the user select the import type before uploading:

| Type | Used for |
|------|---------|
| `bank_statement` | Bank CSV with deposits and withdrawals |
| `revenue_export` | Stripe, PayPal, or Shopify CSV exports |
| `expense_export` | Expensify, Ramp, or similar CSV exports |
| `custom` | Any other format |

The import type is stored on the `csv_imports` record and helps set default `positiveIs` suggestions in the column mapping UI.
