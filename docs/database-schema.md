# Database Schema

All tables are in the `public` schema. Every user-data table has an `org_id` column with a foreign key to `organizations.id`, enforced by Supabase RLS.

## Core tables

### `organizations`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() |
| `name` | text | Org display name |
| `currency` | text | ISO 4217 code (default: 'USD') |
| `fiscal_year_start` | integer | 1–12, month number |
| `industry` | text | Optional industry tag |
| `created_at` | timestamptz | |

### `org_members`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK → organizations |
| `user_id` | uuid | FK → auth.users |
| `role` | text | 'owner' \| 'admin' \| 'member' |

### `user_settings`
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | PK, FK → auth.users |
| `llm_provider` | text | 'openai' \| 'anthropic' |
| `llm_model` | text | Model identifier string |

## Financial tables

### `transactions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK |
| `type` | text | 'income' \| 'expense' |
| `amount` | numeric | Always positive |
| `description` | text | |
| `date` | date | |
| `category` | text | |
| `category_confidence` | text | 'high' \| 'medium' \| 'low' |
| `category_method` | text | 'rule' \| 'ai' \| 'user' |
| `source` | text | 'stripe' \| 'plaid' \| 'shopify' \| 'paypal' \| 'manual' \| 'csv' \| 'invoice' \| 'expense_report' |
| `source_ref_id` | text | External ID for idempotency |
| `currency` | text | ISO code |
| `is_reviewed` | boolean | Default false |
| `is_reconciled` | boolean | Default false |
| `reconciled_with` | uuid | FK → transactions (Stripe payout ↔ Plaid deposit) |
| `vendor` | text | Merchant/payee name |
| `notes` | text | |
| `raw_metadata` | jsonb | Full external payload |
| `created_by` | uuid | FK → auth.users |

### `invoices`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK |
| `invoice_number` | text | Unique, e.g. `INV-ABC12345` |
| `customer_name` | text | |
| `customer_email` | text | |
| `amount` | numeric | |
| `status` | text | 'draft' \| 'sent' \| 'paid' \| 'overdue' \| 'cancelled' |
| `due_date` | date | |
| `invoice_date` | date | |
| `paid_at` | timestamptz | Set when status → paid |
| `line_items` | jsonb | Array of `{ description, quantity, unit_price, amount }` |
| `notes` | text | |
| `source` | text | 'manual' \| 'stripe' |

### `expense_reports`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK |
| `title` | text | |
| `amount` | numeric | |
| `category` | text | |
| `date` | date | |
| `status` | text | 'pending' \| 'approved' \| 'rejected' |
| `submitter_id` | uuid | FK → auth.users |
| `reviewed_by` | uuid | FK → auth.users |
| `reviewed_at` | timestamptz | |
| `receipt_url` | text | Supabase Storage path |
| `transaction_id` | uuid | FK → transactions (set on approval) |

## Integration tables

### `connections`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK |
| `provider` | text | 'stripe' \| 'plaid' \| 'shopify' \| 'paypal' |
| `status` | text | 'active' \| 'disconnected' \| 'error' |
| `encrypted_access_token` | text | AES-256-GCM encrypted |
| `encrypted_item_id` | text | Plaid item ID (encrypted) |
| `sync_cursor` | text | Plaid cursor for incremental sync |
| `account_name` | text | Display name |
| `last_synced_at` | timestamptz | |
| `metadata` | jsonb | Balance snapshots etc. |

### `subscriptions`
Stripe subscription records synced from Stripe API.

### `customers`
Customer records from Stripe / Shopify / PayPal, keyed by `external_id`.

## AI & Chat tables

### `chat_sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK |
| `user_id` | uuid | FK |
| `title` | text | Auto-set from first message |

### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → chat_sessions |
| `org_id` | uuid | FK |
| `role` | text | 'user' \| 'assistant' \| 'system' |
| `content` | text | |
| `intent` | text | Detected intent |
| `data_context` | jsonb | Metrics snapshot passed to LLM |

## Ops tables

### `audit_log`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK |
| `user_id` | uuid | nullable (null = system/cron) |
| `entity_type` | text | 'invoice' \| 'expense_report' \| 'transaction' … |
| `entity_id` | uuid | |
| `action` | text | e.g. 'created', 'approved', 'marked_overdue' |
| `before_state` | jsonb | |
| `after_state` | jsonb | |
| `ip_address` | text | From x-forwarded-for |
| `user_agent` | text | |
| `created_at` | timestamptz | |

### `sync_logs`
Per-sync run record with status, record counts, error message.

### `webhook_events`
Stores raw Stripe webhook events for idempotency deduplication.

### `category_rules`
Rule-based categorization patterns. `org_id IS NULL` = system-wide default rules. Org-specific rules override defaults.

### `category_overrides`
Per-org user corrections: description pattern → category mapping. Highest priority in categorization.

### `data_completeness`
Cached completeness scores per org, updated after each sync.

### `monthly_snapshots`
Cached monthly metric snapshots for historical trending.

### `investor_updates`
Saved AI-generated and human-edited investor update drafts.

### `csv_imports`
Metadata about each CSV/XLSX import (filename, row count, error count, mapping config).
