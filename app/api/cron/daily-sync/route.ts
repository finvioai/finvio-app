import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runStripePullSync } from '@/lib/sync/stripe'
import { syncPlaidTransactions } from '@/lib/sync/plaid'
import { reconcileOrgTransactions } from '@/lib/sync/reconciliation'
import { syncGmailTransactions } from '@/lib/sync/gmail'
import { syncOutlookTransactions } from '@/lib/sync/outlook'

// Vercel Cron — runs daily at 02:00 UTC
// Vercel injects Authorization: Bearer <CRON_SECRET>

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all active connections grouped by org
  const { data: connections, error } = await supabase
    .from('connections')
    .select('id, org_id, provider')
    .in('provider', ['stripe', 'plaid', 'gmail', 'outlook'])
    .eq('status', 'active')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Record<string, unknown>[] = []

  for (const conn of connections ?? []) {
    try {
      if (conn.provider === 'stripe') {
        const result = await runStripePullSync(conn.org_id, conn.id, supabase)
        results.push({ org_id: conn.org_id, provider: 'stripe', ...result })

        // Run reconciliation after each Stripe sync if Plaid is also connected
        const { data: plaidConn } = await supabase
          .from('connections')
          .select('id')
          .eq('org_id', conn.org_id)
          .eq('provider', 'plaid')
          .eq('status', 'active')
          .maybeSingle()

        if (plaidConn) {
          const reconResult = await reconcileOrgTransactions(conn.org_id, supabase)
          results.push({ org_id: conn.org_id, provider: 'reconciliation', ...reconResult })
        }
      } else if (conn.provider === 'plaid') {
        const result = await syncPlaidTransactions(conn.org_id, conn.id, supabase)
        results.push({ org_id: conn.org_id, provider: 'plaid', ...result })
      } else if (conn.provider === 'gmail') {
        const result = await syncGmailTransactions(conn.org_id, conn.id, supabase)
        results.push({ org_id: conn.org_id, provider: 'gmail', ...result })
      } else if (conn.provider === 'outlook') {
        const result = await syncOutlookTransactions(conn.org_id, conn.id, supabase)
        results.push({ org_id: conn.org_id, provider: 'outlook', ...result })
      }
    } catch (err) {
      results.push({
        org_id: conn.org_id,
        provider: conn.provider,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
