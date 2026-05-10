# Gmail Integration

Connects your Google Workspace or personal Gmail inbox (read-only) so that financial emails — payment receipts, invoices, billing statements, subscription renewals — are automatically detected and added to your transaction ledger.

---

## How it works

### 1. Connect (OAuth 2.0)

Click **Authorize with Gmail** on the Connections page. You are redirected to Google's OAuth consent screen where you grant read-only access to your inbox. No write or send permissions are requested.

After authorization, Finvio:
- Stores your encrypted access and refresh tokens in the database
- Runs an initial sync covering the last 90 days of emails

### 2. Email filtering

Only emails matching financial keywords in the **subject line** are processed. This pre-filter keeps processing costs low and avoids reading unrelated emails.

**Income signals** (subject contains): `payment received`, `invoice paid`, `order confirmed`, `receipt from`, `funds received`, `thanks for your payment`, etc.

**Expense signals** (subject contains): `invoice from`, `subscription renewed`, `billing statement`, `payment due`, `charge from`, `auto-renewal`, etc.

### 3. Transaction extraction

Each qualifying email is passed through the **extractor chain**:

```
extractEmailTransaction(subject, from, body)
  1. RegexExtractor (current)   — finds dollar amounts via regex,
                                  classifies income vs expense by keyword scoring
  [future] PayPalEmailExtractor — provider-specific format parsing
  [future] AIEmailExtractor     — LLM fallback for ambiguous emails
```

The extractor that first returns a result wins. The `extractorId` is stored in `raw_metadata` for observability.

**Amount extraction:** The largest `$X.XX` / `USD X.XX` amount in the subject + body (first 2,000 chars). If no amount is found the email is skipped.

**Type classification:** Income vs expense by counting keyword matches. If neither side scores, the email is skipped.

**Vendor:** Parsed from the email `From` header (sender's display name, or domain as fallback).

### 4. Deduplication

Three layers prevent double-counting:

| Layer | Check | Action |
|-------|-------|--------|
| Same email | `source_ref_id = gmail_<messageId>` already exists | Skip |
| Already in another integration | Same amount + type within ±2 days from Stripe/QB/Plaid/etc. | Skip (counts as `skipped`) |
| Invoice link hint | Income matches an open invoice by amount + sender email or invoice number | Set `transaction.invoice_id` as a hint |

### 5. Invoice matching (income only)

For income transactions, Finvio checks your open invoices (`status = 'sent'` or `'overdue'`) for a high-confidence match:

- **Amount** matches exactly (within $0.01)
- **AND** either: the sender's email matches `invoice.customer_email`, OR an invoice number pattern (`INV-123`, `#123`) appears in the email body

If a match is found:
- `transaction.invoice_id` is set as a link hint
- The invoice status is **not changed** — the user reviews and confirms the match in the Transactions page
- The transaction still goes into the review queue (`is_reviewed: false`)

### 6. Review queue

All email-sourced transactions start with `is_reviewed: false` and appear with a ⚠ badge in the Transactions page. This applies even when an invoice match is found — the user must confirm every email transaction.

Use the Transactions page to:
- Review the auto-assigned category and correct if needed
- Confirm invoice links
- Mark as reviewed (✓)

---

## Privacy

- **Read-only access only.** Finvio requests `gmail.readonly` scope — it can read email metadata and bodies, but cannot send, delete, or modify any messages.
- **Minimal data stored.** Only the email subject, sender, date, and first 2,000 characters of body are processed. The full email is never stored; `raw_metadata` stores only subject, sender, and the message ID.
- **Tokens encrypted at rest.** Access and refresh tokens are encrypted with AES-256-GCM before being stored in the database.

---

## Sync schedule

| Trigger | Behavior |
|---------|----------|
| On connect / reconnect | Full 90-day lookback sync |
| Manual "Sync Now" | Emails since last sync (1-day overlap) |
| Daily cron (02:00 UTC) | Same as manual sync |

---

## Setup guide (developers)

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Navigate to **APIs & Services → Library**
4. Search for **Gmail API** → Enable it

### 2. Create OAuth 2.0 credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Add your redirect URI under **Authorized redirect URIs**:
   - Production: `https://your-app.vercel.app/api/connections/gmail/callback`
   - Local: `http://localhost:3004/api/connections/gmail/callback`
4. Copy the **Client ID** and **Client Secret**

### 3. Configure OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. User type: **External** (for general use) or **Internal** (G Suite only)
3. Add scopes: `gmail.readonly`, `userinfo.email`
4. Add test users if in development mode

### 4. Set environment variables

```bash
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-...
GMAIL_REDIRECT_URI=https://your-app.vercel.app/api/connections/gmail/callback
```

> **Local development:** Set `GMAIL_REDIRECT_URI=http://localhost:3004/api/connections/gmail/callback` and add this URL to your Google OAuth app's allowed redirect URIs.

---

## Testing with sample emails

Send these emails to the connected Gmail inbox, wait a minute for Gmail to index them, then click **Sync Now** on the Connections page and check the Transactions page.

---

### ✅ Good — will be detected

Passes the subject keyword filter, has a clear `$X.XX` amount, and classifies unambiguously.

**Subject:** `Your subscription renewal – Notion Pro`

**Body:**
```
Hi there,

Your Notion Pro subscription has been automatically renewed.

  Plan:     Notion Pro Monthly
  Amount:   $16.00
  Date:     May 7, 2026
  Card:     ending in 4242

Notion Team <billing@notion.so>
```

**What happens:**
- Subject contains `subscription renewal` → passes `isFinancialEmail()`
- Classified as **expense** (1 expense keyword, 0 income keywords)
- Amount extracted: **$16.00**
- Vendor: `Notion` (parsed from the `From` header)

---

### ⚠️ Okay — detected but review the amount

Passes the filter and finds an amount, but the parser grabs the **largest** dollar figure it sees — which may not be the actual transaction amount. The transaction will land in the review queue; correct the amount there before approving.

**Subject:** `Your billing statement for May 2026 – Acme Cloud`

**Body:**
```
Your monthly statement is ready.

  Previous balance:   $1,200.00
  Payments received:    $750.00
  New charges:          $380.00
  Balance due:          $830.00

Payment is due by May 30, 2026.

Acme Cloud Billing <billing@acmecloud.example.com>
```

**What happens:**
- Subject contains `billing statement` → passes `isFinancialEmail()`
- Classified as **expense**
- Amount extracted: **$1,200.00** ← the largest figure, not the actual new charge
- **Correct the amount to $380.00** (or $830.00 if paying the full balance) in the review queue

---

### ❌ Bad — will be skipped entirely

Two reasons this one fails: the subject has no matching keyword phrase, and the amount uses a non-USD currency symbol.

**Subject:** `Important notice about your Dropbox account`

**Body:**
```
Hi,

We updated your Dropbox plan. Your new monthly charge will be
€9.99 starting June 1, 2026.

Dropbox Team <no-reply@dropbox.com>
```

**Why it's skipped:**
- Gmail API query only fetches emails with `invoice`, `receipt`, `payment`, `charge`, or `billing` in the subject — this one has none, so it is never fetched
- Even if it were fetched, `isFinancialEmail()` checks for compound phrases (`charge from`, `subscription charge`, etc.) — `"charge"` alone does not match
- Even if keyword filtering passed, `AMOUNT_REGEX` only matches `$` and `USD` prefixes — `€9.99` would not be captured

---

## PDF attachments

**Not currently supported.** The sync reads only the email body (plain text or HTML). Emails where the invoice or receipt is a PDF attachment — with no dollar amount in the body — will be skipped even if the subject passes the keyword filter.

### Options to add PDF support (future)

| Option | Best for | Complexity |
|--------|----------|------------|
| **`pdf-parse` (npm)** | Text-based PDFs (most modern invoices from SaaS tools, Stripe, QuickBooks, etc.) | Low — extract raw text, pass through the existing `extractEmailTransaction` parser unchanged |
| **Claude / GPT-4 vision** | Scanned PDFs, image-only PDFs, complex multi-page layouts | Medium — send the PDF as a base64 image to the LLM, return structured JSON; costs ~$0.01–0.05 per email |
| **Google Document AI** | High-volume structured extraction (purchase orders, invoices with line items) | High — requires a separate Google Cloud service, billing, and a schema definition |

**Recommended path:** Start with `pdf-parse` to cover the majority of cases (text-based PDFs). Fall back to Claude vision only when `pdf-parse` returns no parseable amount. This keeps per-email cost near zero for most users.

---

## Limitations

- **Regex-based extraction** may miss emails with non-standard amount formats (e.g., amounts written in words, non-USD currencies without explicit symbol)
- **PDF attachments are not read** — see the section above
- Emails in languages other than English may not match keyword lists
- Very long email threads may be truncated at 2,000 characters before amount extraction
- Gmail API rate limit: 250 quota units/user/second — large inboxes with many financial emails may take a few minutes on first sync
- Cross-source dedup uses a ±2-day window; payments on the exact same day from both Gmail and another integration with identical amounts will be deduplicated, but payments on different days won't

---

## Disconnect

On the Connections page, click **Disconnect** next to Gmail. You will be asked whether to:

- **Keep imported data** — preserves all Gmail-sourced transactions in your ledger
- **Remove imported data** — soft-deletes all transactions with `source = 'gmail'`

Tokens and `last_synced_at` are cleared from the database in either case. Reconnecting always starts with a fresh 90-day lookback, so previously removed data is correctly re-imported. Google access tokens expire naturally; to fully revoke at Google's side, visit [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
