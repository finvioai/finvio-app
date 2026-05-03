# Integration — CSV / XLSX Import

## Route

`POST /api/import`

## UI flow

1. **Upload** — drag-drop or click to upload `.csv` or `.xlsx` file (max 10MB)
2. **Map columns** — select which column maps to date, amount, description, category, type
3. **Preview** — review first 5 rows after mapping
4. **Import** — server parses, validates, and inserts transactions

## Supported file formats

- `.csv` (comma-separated, semicolon-separated, tab-separated — auto-detected)
- `.xlsx` (first sheet only)
- UTF-8 and UTF-8-with-BOM (BOM stripped automatically)

## Column mapping

| Finvio field | Required | Notes |
|---|---|---|
| `date` | Yes | Supports: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, `MM-DD-YYYY`, Unix timestamp |
| `amount` | Yes | Strips `$`, `€`, commas; handles negatives |
| `description` | No | Used for categorization if provided |
| `category` | No | Skips categorization engine if provided |
| `type` | No | `income` or `expense`; inferred from amount sign if omitted |

## Bank statement mode

When importing a bank statement, you specify whether positive amounts are income or expenses (default: positive = income, negative = expense). The UI shows a toggle for this.

## Idempotency

Each row gets a `source_ref_id` of `{import_id}_{row_index}`. Re-importing the same file skips rows that already exist. The import log (`csv_imports` table) tracks per-file success and error counts.

## Error handling

- Rows with unparseable dates or amounts are skipped
- Rows with no amount after parsing are skipped
- All skipped rows are included in the error log returned after import
- The import continues even if individual rows fail

## Auto-categorization

If `category` is not provided in the CSV, each transaction goes through the standard 3-layer categorization engine:
1. Check `category_overrides` (org-specific)
2. Check `category_rules` (org-specific, then system-wide)
3. AI fallback (uses description text only — no amounts sent to LLM)
