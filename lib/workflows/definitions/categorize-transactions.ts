import type { WorkflowDefinition, WorkflowContext, WorkflowStepResult } from '../engine'
import { categorizeWithAI } from '@/lib/categorization/ai-fallback'

const AI_BATCH_LIMIT = 40

function matchesRule(desc: string, matchType: string, matchValue: string): boolean {
  const val = matchValue.toLowerCase()
  switch (matchType) {
    case 'exact':   return desc === val
    case 'keyword': return desc.includes(val)
    case 'regex': {
      try { return new RegExp(matchValue, 'i').test(desc) } catch { return false }
    }
    default: return false
  }
}

async function scanUncategorized(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { count, error } = await ctx.supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_reviewed', false)
    .is('deleted_at', null)

  if (error) return { status: 'failed', message: `Could not query transactions: ${error.message}` }

  const n = count ?? 0
  if (n === 0) return { status: 'success', message: 'No uncategorized transactions — nothing to do.' }

  return {
    status: 'success',
    message: `${n} transaction${n !== 1 ? 's' : ''} need categorization.`,
    data: { uncategorizedCount: n },
  }
}

async function applyRules(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { data: transactions, error: txError } = await ctx.supabase
    .from('transactions')
    .select('id, description, vendor, type')
    .eq('org_id', ctx.orgId)
    .eq('is_reviewed', false)
    .is('deleted_at', null)
    .limit(200)

  if (txError) return { status: 'failed', message: `Could not fetch transactions: ${txError.message}` }
  if (!transactions?.length) return { status: 'success', message: 'No transactions remaining to classify.' }

  // Pre-fetch all rules and overrides in a single parallel round-trip
  const [{ data: overrides }, { data: orgRules }, { data: sysRules }] = await Promise.all([
    ctx.supabase
      .from('category_overrides')
      .select('description_pattern, category, subcategory')
      .eq('org_id', ctx.orgId),
    ctx.supabase
      .from('category_rules')
      .select('category, subcategory, match_type, match_value')
      .eq('org_id', ctx.orgId)
      .eq('is_active', true)
      .order('priority', { ascending: false }),
    ctx.supabase
      .from('category_rules')
      .select('category, subcategory, match_type, match_value')
      .is('org_id', null)
      .eq('is_active', true)
      .order('priority', { ascending: false }),
  ])

  const matched: Array<{ id: string; category: string; subcategory: string | null }> = []

  for (const tx of transactions) {
    const desc = (tx.description ?? tx.vendor ?? '').toLowerCase()
    if (!desc) continue

    let category: string | null = null
    let subcategory: string | null = null

    // Layer 1: org-specific overrides (exact substring match)
    for (const o of overrides ?? []) {
      if (desc.includes(o.description_pattern.toLowerCase())) {
        category = o.category
        subcategory = o.subcategory ?? null
        break
      }
    }

    // Layer 2a: org-specific rules
    if (!category) {
      for (const rule of orgRules ?? []) {
        if (matchesRule(desc, rule.match_type, rule.match_value)) {
          category = rule.category
          subcategory = rule.subcategory ?? null
          break
        }
      }
    }

    // Layer 2b: system-wide rules
    if (!category) {
      for (const rule of sysRules ?? []) {
        if (matchesRule(desc, rule.match_type, rule.match_value)) {
          category = rule.category
          subcategory = rule.subcategory ?? null
          break
        }
      }
    }

    if (category) matched.push({ id: tx.id, category, subcategory })
  }

  if (matched.length === 0) {
    return {
      status: 'warning',
      message: 'No transactions matched existing category rules.',
      warnings: ['No rules matched — AI will attempt to categorize remaining transactions.'],
    }
  }

  // Bulk update in parallel batches of 50
  const BATCH = 50
  for (let i = 0; i < matched.length; i += BATCH) {
    const batch = matched.slice(i, i + BATCH)
    await Promise.all(
      batch.map(m =>
        ctx.supabase
          .from('transactions')
          .update({
            category: m.category,
            subcategory: m.subcategory,
            is_reviewed: true,
            category_method: 'rule',
            updated_at: new Date().toISOString(),
          })
          .eq('id', m.id)
          .eq('org_id', ctx.orgId)
      )
    )
  }

  const remaining = transactions.length - matched.length
  return {
    status: 'success',
    message: `${matched.length} transaction${matched.length !== 1 ? 's' : ''} categorized by rules.${remaining > 0 ? ` ${remaining} remain for AI review.` : ' All transactions matched.'}`,
    data: { ruleMatched: matched.length, remaining },
  }
}

async function aiCategorize(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { data: remaining, error } = await ctx.supabase
    .from('transactions')
    .select('id, description, vendor, type')
    .eq('org_id', ctx.orgId)
    .eq('is_reviewed', false)
    .is('deleted_at', null)
    .limit(AI_BATCH_LIMIT)

  if (error) return { status: 'failed', message: `Could not fetch remaining transactions: ${error.message}` }
  if (!remaining?.length) return { status: 'success', message: 'All transactions were categorized by rules — no AI needed.' }

  const results = await Promise.all(
    remaining.map(async tx => {
      const desc = tx.description ?? tx.vendor ?? ''
      if (!desc.trim()) return null
      const txType: 'income' | 'expense' = tx.type === 'income' || tx.type === 'revenue' ? 'income' : 'expense'
      const result = await categorizeWithAI(desc, txType)
      return { id: tx.id, category: result.category }
    })
  )

  const toUpdate = results.filter(Boolean) as Array<{ id: string; category: string }>

  if (toUpdate.length === 0) {
    return {
      status: 'warning',
      message: 'No transactions had a description for AI to use.',
      warnings: ['Transactions without descriptions must be categorized manually.'],
    }
  }

  await Promise.all(
    toUpdate.map(m =>
      ctx.supabase
        .from('transactions')
        .update({ category: m.category, is_reviewed: true, category_method: 'ai', updated_at: new Date().toISOString() })
        .eq('id', m.id)
        .eq('org_id', ctx.orgId)
    )
  )

  const warnings: string[] = []
  const noDesc = remaining.length - toUpdate.length
  if (noDesc > 0) {
    warnings.push(`${noDesc} transaction${noDesc !== 1 ? 's' : ''} had no description — categorize them manually.`)
  }
  if (remaining.length >= AI_BATCH_LIMIT) {
    warnings.push(`Only the first ${AI_BATCH_LIMIT} uncategorized transactions were processed. Run again to continue.`)
  }

  return {
    status: warnings.length > 0 ? 'warning' : 'success',
    message: `AI categorized ${toUpdate.length} transaction${toUpdate.length !== 1 ? 's' : ''}.`,
    warnings: warnings.length > 0 ? warnings : undefined,
    data: { aiCategorized: toUpdate.length },
  }
}

async function categorizationSummary(ctx: WorkflowContext): Promise<WorkflowStepResult> {
  const { count, error } = await ctx.supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_reviewed', false)
    .is('deleted_at', null)

  if (error) return { status: 'failed', message: `Could not verify final state: ${error.message}` }

  const remaining = count ?? 0
  if (remaining === 0) {
    return { status: 'success', message: 'All transactions are now categorized and reviewed.' }
  }

  return {
    status: 'warning',
    message: `${remaining} transaction${remaining !== 1 ? 's' : ''} still need manual categorization.`,
    warnings: [`${remaining} transaction${remaining !== 1 ? 's' : ''} could not be auto-categorized — visit Transactions to review them.`],
    data: { stillUncategorized: remaining },
  }
}

export const categorizeTransactionsWorkflow: WorkflowDefinition = {
  id: 'categorize-transactions',
  name: 'Categorize Transactions',
  description:
    'Apply category rules and AI-assisted categorization to all unreviewed transactions, then mark them as reviewed.',
  category: 'accounting',
  estimatedDuration: '~20 seconds',
  steps: [
    { id: 'scan-uncategorized',      name: 'Scan uncategorized transactions', run: scanUncategorized },
    { id: 'apply-rules',             name: 'Apply category rules',            run: applyRules },
    { id: 'ai-categorize',           name: 'AI-assisted categorization',      run: aiCategorize },
    { id: 'categorization-summary',  name: 'Categorization summary',          run: categorizationSummary },
  ],
}
