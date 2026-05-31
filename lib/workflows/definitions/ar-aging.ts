import type { WorkflowDefinition, WorkflowContext, WorkflowStepResult } from '../engine'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

interface OpenInvoice {
  id: string
  invoice_number: string
  customer_name: string | null
  amount: number
  due_date: string | null
}

function daysOverdue(dueDateStr: string | null, today: string): number {
  if (!dueDateStr) return 0
  const due = new Date(dueDateStr)
  const now = new Date(today)
  const diff = now.getTime() - due.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

async function fetchOpenReceivables(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { data: invoices, error } = await ctx.supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, amount, due_date')
    .eq('org_id', ctx.orgId)
    .in('status', ['sent', 'overdue'])
    .order('due_date', { ascending: true })

  if (error) return { status: 'failed', message: `Could not query invoices: ${error.message}` }

  const n = invoices?.length ?? 0
  if (n === 0) return { status: 'success', message: 'No open receivables — all invoices are paid or closed.' }

  const total = (invoices ?? []).reduce((sum, inv) => sum + inv.amount, 0)

  return {
    status: 'success',
    message: `${n} open invoice${n !== 1 ? 's' : ''} totalling ${fmt(total)}.`,
    data: { openCount: n, totalAR: total },
  }
}

async function ageReceivables(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { data: invoices, error } = await ctx.supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, amount, due_date')
    .eq('org_id', ctx.orgId)
    .in('status', ['sent', 'overdue'])

  if (error) return { status: 'failed', message: `Could not query invoices: ${error.message}` }
  if (!invoices?.length) return { status: 'success', message: 'No open receivables to age.' }

  // Bucket each invoice
  const buckets = {
    current:  { count: 0, total: 0, customers: new Set<string>() }, // not yet due
    b30:      { count: 0, total: 0, customers: new Set<string>() }, // 1-30 days
    b60:      { count: 0, total: 0, customers: new Set<string>() }, // 31-60 days
    b90:      { count: 0, total: 0, customers: new Set<string>() }, // 61-90 days
    over90:   { count: 0, total: 0, customers: new Set<string>() }, // 90+ days
  }

  for (const inv of invoices as OpenInvoice[]) {
    const days = daysOverdue(inv.due_date, ctx.today)
    const customer = inv.customer_name ?? 'Unknown'
    let bucket: keyof typeof buckets

    if (days === 0 && inv.due_date && new Date(inv.due_date) >= new Date(ctx.today)) {
      bucket = 'current'
    } else if (days <= 30) {
      bucket = 'b30'
    } else if (days <= 60) {
      bucket = 'b60'
    } else if (days <= 90) {
      bucket = 'b90'
    } else {
      bucket = 'over90'
    }

    buckets[bucket].count++
    buckets[bucket].total += inv.amount
    buckets[bucket].customers.add(customer)
  }

  const lines: string[] = []
  if (buckets.current.count)  lines.push(`Current: ${buckets.current.count} inv / ${fmt(buckets.current.total)}`)
  if (buckets.b30.count)      lines.push(`1-30 days: ${buckets.b30.count} inv / ${fmt(buckets.b30.total)}`)
  if (buckets.b60.count)      lines.push(`31-60 days: ${buckets.b60.count} inv / ${fmt(buckets.b60.total)}`)
  if (buckets.b90.count)      lines.push(`61-90 days: ${buckets.b90.count} inv / ${fmt(buckets.b90.total)}`)
  if (buckets.over90.count)   lines.push(`90+ days: ${buckets.over90.count} inv / ${fmt(buckets.over90.total)}`)

  return {
    status: 'success',
    message: lines.join(' | '),
    data: {
      current: { count: buckets.current.count, total: buckets.current.total },
      days30:  { count: buckets.b30.count,     total: buckets.b30.total },
      days60:  { count: buckets.b60.count,     total: buckets.b60.total },
      days90:  { count: buckets.b90.count,     total: buckets.b90.total },
      over90:  { count: buckets.over90.count,  total: buckets.over90.total },
    },
  }
}

async function flagHighRisk(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { data: invoices, error } = await ctx.supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, amount, due_date')
    .eq('org_id', ctx.orgId)
    .in('status', ['sent', 'overdue'])

  if (error) return { status: 'failed', message: `Could not query invoices: ${error.message}` }
  if (!invoices?.length) return { status: 'success', message: 'No open receivables.' }

  // High-risk = 60+ days overdue
  const highRisk = (invoices as OpenInvoice[]).filter(
    inv => daysOverdue(inv.due_date, ctx.today) > 60
  )

  if (highRisk.length === 0) {
    return { status: 'success', message: 'No high-risk receivables (nothing over 60 days).' }
  }

  // Group by customer to detect repeat offenders
  const byCustomer: Record<string, { count: number; total: number }> = {}
  for (const inv of highRisk) {
    const c = inv.customer_name ?? 'Unknown'
    if (!byCustomer[c]) byCustomer[c] = { count: 0, total: 0 }
    byCustomer[c].count++
    byCustomer[c].total += inv.amount
  }

  const warnings = Object.entries(byCustomer).map(([customer, stats]) =>
    `${customer}: ${stats.count} invoice${stats.count !== 1 ? 's' : ''} totalling ${fmt(stats.total)} — 60+ days overdue.`
  )

  const totalAtRisk = highRisk.reduce((sum, inv) => sum + inv.amount, 0)

  return {
    status: 'warning',
    message: `${highRisk.length} invoice${highRisk.length !== 1 ? 's' : ''} totalling ${fmt(totalAtRisk)} are 60+ days overdue.`,
    warnings,
    data: { highRiskCount: highRisk.length, highRiskTotal: totalAtRisk },
  }
}

async function arAgingSummary(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { data: invoices, error } = await ctx.supabase
    .from('invoices')
    .select('customer_name, amount, due_date, status')
    .eq('org_id', ctx.orgId)
    .in('status', ['sent', 'overdue'])

  if (error) return { status: 'failed', message: `Could not load AR summary: ${error.message}` }
  if (!invoices?.length) return { status: 'success', message: 'AR is clean — no open receivables.' }

  const overdueInvoices = invoices.filter(inv => daysOverdue(inv.due_date, ctx.today) > 0)
  const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const totalAR = invoices.reduce((sum, inv) => sum + inv.amount, 0)

  // Find the customer with the most overdue exposure
  const byCustomer: Record<string, number> = {}
  for (const inv of overdueInvoices) {
    const c = inv.customer_name ?? 'Unknown'
    byCustomer[c] = (byCustomer[c] ?? 0) + inv.amount
  }
  const topCustomer = Object.entries(byCustomer).sort((a, b) => b[1] - a[1])[0]

  const warnings: string[] = []
  if (overdueTotal > 0) {
    warnings.push(`${fmt(overdueTotal)} of ${fmt(totalAR)} total AR is overdue.`)
  }
  if (topCustomer && topCustomer[1] > 0) {
    warnings.push(`Largest exposure: ${topCustomer[0]} at ${fmt(topCustomer[1])}.`)
  }

  return {
    status: overdueTotal > 0 ? 'warning' : 'success',
    message: `Total AR: ${fmt(totalAR)}. Overdue: ${fmt(overdueTotal)} across ${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? 's' : ''}.`,
    warnings: warnings.length > 0 ? warnings : undefined,
    data: { totalAR, overdueTotal, overdueCount: overdueInvoices.length },
  }
}

export const arAgingWorkflow: WorkflowDefinition = {
  id: 'ar-aging',
  name: 'AR Aging Report',
  description:
    'Bucket open invoices by days overdue, flag high-risk accounts, and surface your total accounts receivable exposure.',
  category: 'reporting',
  estimatedDuration: '~10 seconds',
  steps: [
    { id: 'fetch-open-receivables', name: 'Fetch open receivables',  run: fetchOpenReceivables },
    { id: 'age-receivables',        name: 'Age receivables by bucket', run: ageReceivables },
    { id: 'flag-high-risk',         name: 'Flag high-risk accounts',  run: flagHighRisk },
    { id: 'ar-aging-summary',       name: 'AR aging summary',         run: arAgingSummary },
  ],
}
