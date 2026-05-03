import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuditParams {
  supabase: SupabaseClient
  orgId: string
  userId?: string | null
  entityType: string
  entityId?: string | null
  action: string
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  request?: Request
}

export async function writeAuditLog({
  supabase,
  orgId,
  userId,
  entityType,
  entityId,
  action,
  beforeState,
  afterState,
  request,
}: AuditParams): Promise<void> {
  const ipAddress = request
    ? (request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null)
    : null
  const userAgent = request ? (request.headers.get('user-agent') ?? null) : null

  await supabase.from('audit_log').insert({
    org_id: orgId,
    user_id: userId ?? null,
    entity_type: entityType,
    entity_id: entityId ?? null,
    action,
    before_state: (beforeState as Record<string, unknown>) ?? null,
    after_state: (afterState as Record<string, unknown>) ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
  })
}
