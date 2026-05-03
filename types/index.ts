// Re-export DB row types for convenience
export type { Tables, TablesInsert, TablesUpdate } from './database'
import type { Tables } from './database'

// ============================================================
// DB Entity convenience aliases
// ============================================================
export type Organization = Tables<'organizations'>
export type OrgMember = Tables<'org_members'>
export type UserSettings = Tables<'user_settings'>
export type Connection = Tables<'connections'>
export type SyncLog = Tables<'sync_logs'>
export type Transaction = Tables<'transactions'>
export type Customer = Tables<'customers'>
export type Subscription = Tables<'subscriptions'>
export type Invoice = Tables<'invoices'>
export type ExpenseReport = Tables<'expense_reports'>
export type CategoryRule = Tables<'category_rules'>
export type CategoryOverride = Tables<'category_overrides'>
export type CsvImport = Tables<'csv_imports'>
export type MonthlySnapshot = Tables<'monthly_snapshots'>
export type ChatSession = Tables<'chat_sessions'>
export type ChatMessage = Tables<'chat_messages'>
export type AuditLog = Tables<'audit_log'>
export type DataCompleteness = Tables<'data_completeness'>
export type InvestorUpdate = Tables<'investor_updates'>
export type WebhookEvent = Tables<'webhook_events'>

// ============================================================
// Metrics Engine Types
// ============================================================

export interface MRRTrend {
  month: string     // ISO date string: "2026-04-01"
  mrr: number
  arr: number
}

export interface PnLLineItem {
  category: string
  amount: number
  transactionCount: number
}

export interface PnLReport {
  month: string
  revenue: PnLLineItem[]
  totalRevenue: number
  expenses: PnLLineItem[]
  totalExpenses: number
  netIncome: number
  dataWarnings: string[]
}

export interface ForecastMonth {
  month: string     // ISO date string
  projectedMRR: number
  projectedExpenses: number
  projectedCash: number
  projectedRunway: number | 'infinite'
}

export interface DataCompletenessResult {
  stripeConnected: boolean
  bankConnected: boolean
  shopifyConnected: boolean
  paypalConnected: boolean
  hasManualEntries: boolean
  hasCsvImports: boolean
  revenueCompleteness: 'high' | 'medium' | 'low'
  expenseCompleteness: 'high' | 'medium' | 'low'
  overallScore: number   // 0–100
  warnings: string[]
}

export interface DashboardMetrics {
  mrr: number
  arr: number
  cashBalance: number
  runway: number | 'infinite'
  activeCustomers: number
  burnRate: number
  netBurn: number
  churnRate: number
  mrrTrend: MRRTrend[]
  dataCompleteness: DataCompletenessResult
  dataWarnings: string[]
}

// ============================================================
// Chat / AI Types
// ============================================================

export type ChatIntent =
  | 'query_runway'
  | 'query_mrr'
  | 'query_burn'
  | 'query_pnl'
  | 'query_forecast'
  | 'query_customers'
  | 'create_expense'
  | 'create_invoice'
  | 'add_income'
  | 'unknown'

export interface ChatMessagePayload {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface PendingAction {
  type: 'create_expense' | 'create_invoice' | 'add_income'
  params: CreateExpenseParams | CreateInvoiceParams | AddIncomeParams
}

export interface CreateExpenseParams {
  title: string
  amount: number
  category: string
  date: string
  notes?: string
}

export interface CreateInvoiceParams {
  customerName: string
  amount: number
  dueDate: string
  notes?: string
}

export interface AddIncomeParams {
  description: string
  amount: number
  category: string
  date: string
  source?: string
}

export interface ChatResponse {
  message: string
  intent: ChatIntent
  pendingAction?: PendingAction
  dataContext?: Record<string, unknown>
  modelUsed?: string
  tokensUsed?: number
}

// ============================================================
// LLM Adapter Types
// ============================================================

export type LLMProvider = 'openai' | 'anthropic'

export interface LLMModel {
  id: string
  name: string
  provider: LLMProvider
}

export const LLM_MODELS: LLMModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
]

// ============================================================
// Invoice Types
// ============================================================

export interface InvoiceLineItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

// ============================================================
// Categorization Types
// ============================================================

export interface CategorizationResult {
  category: string
  subcategory?: string
  confidence: 'high' | 'medium' | 'low'
  method: 'rule' | 'ai' | 'user'
}

export const INCOME_CATEGORIES = [
  'Subscription Revenue',
  'One-time Revenue',
  'Consulting',
  'Refund Received',
  'Other Income',
] as const

export const EXPENSE_CATEGORIES = [
  'Infrastructure',
  'SaaS Tools',
  'Marketing',
  'Contractors',
  'Payroll',
  'Meals & Entertainment',
  'Travel',
  'Office',
  'Payment Processing',
  'Legal & Professional',
  'Refund Issued',
  'Other Expense',
] as const

export type IncomeCategory = typeof INCOME_CATEGORIES[number]
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

// ============================================================
// Connection / Integration Types
// ============================================================

export type ConnectionProvider =
  | 'stripe'
  | 'plaid'
  | 'shopify'
  | 'paypal'
  | 'mercury'
  | 'brex'
  | 'quickbooks'
  | 'xero'
  | 'freshbooks'
  | 'openai'
  | 'anthropic'

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'syncing'

// ============================================================
// CSV Import Types
// ============================================================

export type ImportType = 'bank_statement' | 'revenue_export' | 'expense_export' | 'custom'

export interface ColumnMapping {
  date: string
  amount: string
  description?: string
  category?: string
  type?: string
  debit?: string
  credit?: string
}

export interface ImportPreviewRow {
  rowIndex: number
  rawData: Record<string, string>
  parsedDate?: string
  parsedAmount?: number
  parsedType?: 'income' | 'expense'
  parsedDescription?: string
  error?: string
}

// ============================================================
// Scenario Modeling Types
// ============================================================

export interface ScenarioResult {
  currentMRR: number
  currentBurnRate: number
  currentCash: number
  currentRunway: number | 'infinite'
  projectedMRR: number
  projectedBurnRate: number
  projectedCash: number
  projectedRunway: number | 'infinite'
  riskLevel: 'safe' | 'caution' | 'risky'
}
