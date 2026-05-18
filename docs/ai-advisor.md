# AI Financial Advisor

The AI Advisor (`/advisor`) is a conversational assistant that answers financial questions, creates records with your approval, and processes uploaded PDF documents.

---

## What the advisor can do

### 1. Answer financial questions

Ask anything about your business finances in natural language:

| Question | What's returned |
|---|---|
| "What are my expenses this month?" | Total + category breakdown + top 5 transactions |
| "What's my burn rate?" | Rolling monthly average expenses |
| "What's my runway?" | Cash ÷ net burn in months |
| "What's my MRR?" | Monthly recurring revenue |
| "Show me a P&L summary" | Revenue and expense line items by category |
| "What's my churn rate?" | Monthly subscription churn % |
| "Forecast my MRR for next 6 months" | Projected MRR/ARR/runway |
| "How are my projects doing?" | Per-project income, expenses, and outstanding |
| "What's my gross profit this month?" | Revenue − expenses |

The advisor **only uses your actual data** — it never estimates or makes up numbers. If data is missing it says so and suggests what to connect.

---

### 2. App navigation and how-to

Ask how to use Finvio:

- "How do I connect Stripe?" → step-by-step OAuth instructions
- "Where are my invoices?" → points to `/invoices`
- "How do I add an expense?" → explains text chat, PDF upload, and manual entry options
- "What is the Connections page for?" → explains integrations

---

### 3. Create records with approval

The advisor never saves anything without your explicit confirmation.

**Expense:**
> "Add a $200 monthly expense for Figma"

The advisor extracts vendor, amount, category, and recurrence, then shows a **confirmation card** with editable fields. Click **Confirm** to save.

**Income:**
> "Access Engineering paid $3,000 today"

The advisor creates an income entry (optionally linked to a project) and shows a confirmation card.

**Invoice:**
> "Create an invoice for Acme Corp for $5,000 due June 30"

The advisor drafts the invoice and shows a confirmation card. Click Confirm to save it to `/invoices`.

---

### 4. Convert quotations to invoices

**Via text** — paste a quotation directly into the chat:

> "Here's a quotation for a client: Web redesign project — $4,500, due in 30 days, client is TechCorp"

The advisor detects it as a quotation and creates a `create_invoice` confirmation card.

**Via PDF upload** — click the 📎 button and upload the quotation PDF. The advisor extracts the details and shows the confirmation card.

---

### 5. Process PDF receipts and invoices

Click the **📎 (paperclip)** button in the chat input to upload a PDF document.

| Document type | What happens |
|---|---|
| Receipt | Extracts vendor, amount, date → `create_expense` confirmation card |
| Invoice received (accounts payable) | Extracts supplier, amount → `create_expense` confirmation card |
| Invoice sent / quotation | Extracts client, amount, due date → `create_invoice` confirmation card |
| Payment confirmation | Extracts payer, amount → `add_income` confirmation card |

**Limits:**
- PDF only (not images or scanned documents)
- Max file size: **5 MB**
- Max uploads per hour: **5**
- Text-based PDFs only — scanned/image-based PDFs cannot be read. If the PDF has no extractable text, the advisor asks you to paste the content as a message instead.

---

## Guardrails

The advisor only answers questions about:
- Business finances and accounting
- This application (features, navigation, how-to)

Off-topic questions (recipes, general knowledge, etc.) are politely declined. Requests for advice on tax evasion, fraud, or illegal activity are refused.

---

## Voice input

Click the microphone button to speak your question. The advisor uses your browser's built-in speech recognition (no data sent to servers) on Chrome, Edge, and Safari. Firefox and Brave use server-side transcription via OpenAI Whisper (subject to daily/monthly quotas).

---

## Session memory

Each conversation is saved as a session. The last 10 messages in a session are included in every request so the advisor can follow context ("that expense I mentioned earlier"). Sessions are listed in the left sidebar. You can start a new chat at any time.

---

## Model selection

The advisor supports both OpenAI and Anthropic models. Change the model in **Settings → AI Advisor**. The default is GPT-4o Mini (cost-efficient for most financial queries).

---

## Rate limits

- Chat messages: 30 per minute (global)
- PDF uploads: 5 per hour per account

---

## Developer notes

### Key files

| File | Role |
|---|---|
| `app/(dashboard)/advisor/page.tsx` | Chat UI, session management, file upload handler |
| `app/api/chat/route.ts` | Main chat endpoint — intent detection, context fetch, LLM call |
| `app/api/chat/confirm/route.ts` | Executes approved write actions (expense/income/invoice insert) |
| `app/api/chat/upload/route.ts` | PDF upload — text extraction, document extraction, rate limiting |
| `lib/llm/intent.ts` | Intent detection (regex-first, LLM fallback) |
| `lib/llm/documentExtractor.ts` | LLM-based financial data extraction from PDF text |
| `lib/llm/chatSchemas.ts` | Shared Zod validation schemas for write actions |
| `lib/metrics/index.ts` | All financial data query functions |
| `components/chat/ConfirmationCard.tsx` | Editable confirmation UI for write actions |

### Intent types

| Intent | Trigger |
|---|---|
| `query_runway` | "runway", "months left" |
| `query_mrr` | "MRR", "monthly recurring revenue" |
| `query_burn` | "burn rate", "monthly spending" |
| `query_expenses` | "expenses this month", "what did I spend", "top expenses" |
| `query_revenue` | "revenue", "how much did I make" |
| `query_profit` | "profit", "gross margin" |
| `query_pnl` | "P&L", "profit and loss" |
| `query_forecast` | "forecast", "projection" |
| `query_customers` | "churn", "active customers" |
| `query_project` | "project status", "billable" |
| `query_help` | "how do I", "where is", "how to use" |
| `create_expense` | "add expense", "log $X for Y" |
| `create_invoice` | "create invoice", "make invoice", "convert quotation" |
| `add_income` | "[client] paid $X", "add income" |
| `confirm_action` | "yes", "confirm", "ok" |
