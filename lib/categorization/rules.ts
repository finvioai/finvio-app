import { createClient } from '@/lib/supabase/server'
import type { CategorizationResult, IncomeCategory } from '@/types'
import { CATEGORY_TO_REVENUE_TYPE } from '@/types'
import { categorizeWithAI } from './ai-fallback'

function getRevenueType(category: string, type: 'income' | 'expense') {
  if (type !== 'income') return null
  return CATEGORY_TO_REVENUE_TYPE[category as IncomeCategory] ?? null
}

function matchesRule(desc: string, matchType: string, matchValue: string): boolean {
  const val = matchValue.toLowerCase()
  switch (matchType) {
    case 'exact': return desc === val
    case 'keyword': return desc.includes(val)
    case 'regex': {
      try { return new RegExp(matchValue, 'i').test(desc) } catch { return false }
    }
    default: return false
  }
}

// 3-layer categorization:
// 1. org-specific pattern overrides (category_overrides) — substring match
// 2. category_rules (org-specific, then system-wide, ordered by priority)
// 3. AI fallback
export async function categorize(
  description: string,
  type: 'income' | 'expense',
  orgId: string
): Promise<CategorizationResult> {
  const supabase = await createClient()
  const lowerDesc = description.toLowerCase()

  // Layer 1: org-specific overrides
  const { data: overrides } = await supabase
    .from('category_overrides')
    .select('description_pattern, category, subcategory')
    .eq('org_id', orgId)

  for (const o of overrides ?? []) {
    if (lowerDesc.includes(o.description_pattern.toLowerCase())) {
      return {
        category: o.category,
        subcategory: o.subcategory ?? undefined,
        confidence: 'high',
        method: 'rule',
        revenue_type: getRevenueType(o.category, type),
      }
    }
  }

  // Layer 2a: org-specific category rules
  const { data: orgRules } = await supabase
    .from('category_rules')
    .select('category, subcategory, match_type, match_value')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  for (const rule of orgRules ?? []) {
    if (matchesRule(lowerDesc, rule.match_type, rule.match_value)) {
      return {
        category: rule.category,
        subcategory: rule.subcategory ?? undefined,
        confidence: 'high',
        method: 'rule',
        revenue_type: getRevenueType(rule.category, type),
      }
    }
  }

  // Layer 2b: system-wide category rules
  const { data: sysRules } = await supabase
    .from('category_rules')
    .select('category, subcategory, match_type, match_value')
    .is('org_id', null)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  for (const rule of sysRules ?? []) {
    if (matchesRule(lowerDesc, rule.match_type, rule.match_value)) {
      return {
        category: rule.category,
        subcategory: rule.subcategory ?? undefined,
        confidence: 'medium',
        method: 'rule',
        revenue_type: getRevenueType(rule.category, type),
      }
    }
  }

  // Layer 3: AI fallback — revenue_type resolved from AI-assigned category
  const aiResult = await categorizeWithAI(description, type)
  return {
    ...aiResult,
    revenue_type: getRevenueType(aiResult.category, type),
  }
}

// Save a user correction as an org override for future auto-categorization.
// Called after a user manually sets a category on a transaction.
export async function saveOverride(
  orgId: string,
  descriptionPattern: string,
  category: string,
  subcategory?: string
): Promise<void> {
  const supabase = await createClient()
  // Truncate and normalize the pattern
  const pattern = descriptionPattern.toLowerCase().slice(0, 100)

  // Check if an override for this pattern already exists
  const { data: existing } = await supabase
    .from('category_overrides')
    .select('id')
    .eq('org_id', orgId)
    .eq('description_pattern', pattern)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('category_overrides')
      .update({ category, subcategory: subcategory ?? null })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('category_overrides')
      .insert({ org_id: orgId, description_pattern: pattern, category, subcategory: subcategory ?? null })
  }
}
