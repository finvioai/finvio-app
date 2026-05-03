# Finvio Workflow Documentation

In-depth explanations of how each business function works internally. Read these to understand the logic, data flows, and design decisions behind the system.

---

## Documents

| Document | What it covers |
|----------|---------------|
| [categorization.md](./categorization.md) | How transactions are automatically categorized (3-layer system: user overrides → org rules → AI fallback) |
| [ai-chat.md](./ai-chat.md) | How the AI advisor works: intent detection, read vs write paths, confirmation flow, LLM adapter |
| [data-sync.md](./data-sync.md) | How data is fetched from Stripe, Plaid, PayPal, Shopify — auth, API patterns, sync triggers |
| [deduplication.md](./deduplication.md) | How duplicate transactions are prevented across all sources (source_ref_id, reconciliation, webhook idempotency) |
| [transactions.md](./transactions.md) | Transaction lifecycle: creation, review queue, categorization, API, UI display |
| [metrics.md](./metrics.md) | How MRR, ARR, burn rate, runway, P&L, and all other financial numbers are calculated |
| [invoices.md](./invoices.md) | Invoice lifecycle: draft → sent → paid, auto income creation, PDF export, audit |
| [csv-import.md](./csv-import.md) | CSV/XLSX import: column mapping, date/amount parsing, categorization, idempotency |
| [reconciliation.md](./reconciliation.md) | How Stripe payouts are matched to Plaid bank deposits to prevent double-counting |
| [audit-logging.md](./audit-logging.md) | What write actions are logged, the audit_log schema, IP extraction |

---

## Key Design Principles

**1. The LLM never touches raw data directly.**  
All financial numbers are computed by TypeScript functions in `lib/metrics/index.ts` and injected into the LLM's system prompt as verified JSON. The LLM interprets; it never calculates.

**2. Write actions require explicit confirmation.**  
When a user asks the AI to create an expense, invoice, or income entry, the API returns a `pendingAction` — nothing is written to the database until the user clicks Confirm in the UI.

**3. All sensitive credentials are encrypted.**  
Every API key stored in the `connections` table is encrypted with AES-256-GCM before storage and decrypted only in server-side code at the moment of use.

**4. Deduplication is source_ref_id based.**  
Every synced transaction gets a deterministic ID derived from the provider's own identifier. Re-syncing never creates duplicates.

**5. Categorization is a learning system.**  
User corrections are saved as overrides, so the system gets better at categorizing an org's specific transactions over time.
