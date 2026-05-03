'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Connection } from '@/types'
import { cn } from '@/lib/utils'

// ─── Provider config ──────────────────────────────────────────────────────────

interface ProviderConfig {
  id: string
  name: string
  description: string
  logo: string         // emoji placeholder
  comingSoon?: boolean
  syncRoute?: string
  connectRoute?: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Sync charges, invoices, subscriptions and customer data',
    logo: '💳',
    syncRoute: '/api/sync/stripe',
  },
  {
    id: 'plaid',
    name: 'Plaid (Bank)',
    description: 'Connect your bank account for real-time transaction sync',
    logo: '🏦',
    syncRoute: '/api/sync/plaid',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Import paid orders and revenue from your Shopify store',
    logo: '🛍',
    syncRoute: '/api/sync/shopify',
    connectRoute: '/api/connections/shopify',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Sync PayPal transactions and settlements',
    logo: '💰',
    syncRoute: '/api/sync/paypal',
    connectRoute: '/api/connections/paypal',
  },
  {
    id: 'mercury',
    name: 'Mercury',
    description: 'Connect Mercury business banking',
    logo: '☿',
    comingSoon: true,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync transactions from QuickBooks Online',
    logo: '📒',
    comingSoon: true,
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Import accounting data from Xero',
    logo: '📊',
    comingSoon: true,
  },
  {
    id: 'brex',
    name: 'Brex',
    description: 'Sync Brex card transactions and expenses',
    logo: '💼',
    comingSoon: true,
  },
]

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Provider Card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  connection,
  onSync,
  onDisconnect,
  onConnectPlaid,
}: {
  provider: ProviderConfig
  connection?: Connection
  onSync: (providerId: string) => void
  onDisconnect: (providerId: string) => void
  onConnectPlaid: () => void
}) {
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number } | null>(null)
  const [syncError, setSyncError] = useState('')

  const isConnected = connection?.status === 'active'

  async function handleSync() {
    if (!provider.syncRoute) return
    setSyncing(true)
    setSyncError('')
    setSyncResult(null)
    try {
      const res = await fetch(provider.syncRoute, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setSyncError(json.error ?? 'Sync failed'); return }
      setSyncResult({ synced: json.synced, skipped: json.skipped })
      onSync(provider.id)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      let deleteUrl = ''
      if (provider.id === 'plaid') deleteUrl = '/api/connections/plaid'
      else if (provider.id === 'shopify') deleteUrl = '/api/connections/shopify'
      else if (provider.id === 'paypal') deleteUrl = '/api/connections/paypal'
      else return // Stripe has no disconnect UI (managed via dashboard)

      await fetch(deleteUrl, { method: 'DELETE' })
      onDisconnect(provider.id)
    } finally {
      setDisconnecting(false)
    }
  }

  function handleConnect() {
    if (provider.id === 'plaid') {
      onConnectPlaid()
      return
    }
    if (provider.connectRoute) {
      window.location.href = provider.connectRoute
    }
  }

  return (
    <div className={cn(
      'rounded-xl border bg-white p-5 space-y-4 transition-opacity',
      provider.comingSoon && 'opacity-60'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl">
            {provider.logo}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{provider.name}</h3>
              {provider.comingSoon && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  Coming Soon
                </span>
              )}
              {isConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{provider.description}</p>
          </div>
        </div>
      </div>

      {isConnected && connection && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 space-y-0.5">
          {connection.account_name && (
            <p className="text-xs text-gray-600 font-medium">{connection.account_name}</p>
          )}
          <p className="text-xs text-gray-400">
            Last synced: {connection.last_synced_at ? fmtDate(connection.last_synced_at) : 'Never'}
          </p>
        </div>
      )}

      {syncResult && (
        <p className="text-xs text-green-700 bg-green-50 rounded px-3 py-1.5">
          Synced {syncResult.synced} transactions ({syncResult.skipped} duplicates skipped)
        </p>
      )}
      {syncError && (
        <p className="text-xs text-red-700 bg-red-50 rounded px-3 py-1.5 flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3 shrink-0" /> {syncError}
        </p>
      )}

      {!provider.comingSoon && (
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1.5">{syncing ? 'Syncing…' : 'Sync Now'}</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting}
                className="border-red-200 text-red-600 hover:bg-red-50">
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Disconnect</span>
              </Button>
            </>
          ) : provider.id === 'stripe' ? (
            <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
              Configure <code className="font-mono">STRIPE_SECRET_KEY</code> + <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> in your environment to activate Stripe sync.
            </div>
          ) : (
            <Button size="sm" onClick={handleConnect}>
              Connect {provider.name}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Plaid Link Modal ─────────────────────────────────────────────────────────

function PlaidConnectSection({ onConnected }: { onConnected: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/connections/plaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link-token' }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to create link token'); return }

      // Plaid Link SDK is loaded dynamically
      const { open } = await loadPlaidLink(json.link_token, async (publicToken: string) => {
        const exchangeRes = await fetch('/api/connections/plaid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'exchange', public_token: publicToken }),
        })
        if (exchangeRes.ok) {
          onConnected()
        } else {
          const err = await exchangeRes.json()
          setError(err.error ?? 'Token exchange failed')
        }
      })
      open()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect bank')
    } finally {
      setLoading(false)
    }
  }

  return { handleConnect, loading, error }
}

async function loadPlaidLink(
  token: string,
  onSuccess: (publicToken: string) => void
): Promise<{ open: () => void }> {
  // Dynamically load Plaid Link SDK
  await new Promise<void>((resolve, reject) => {
    if (document.getElementById('plaid-link-script')) { resolve(); return }
    const script = document.createElement('script')
    script.id = 'plaid-link-script'
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })

  // @ts-expect-error — Plaid Link is loaded dynamically
  return window.Plaid.create({
    token,
    onSuccess: (public_token: string) => onSuccess(public_token),
    onExit: () => {},
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [plaidConnecting, setPlaidConnecting] = useState(false)
  const [plaidError, setPlaidError] = useState('')

  async function fetchConnections() {
    const res = await fetch('/api/connections')
    if (res.ok) {
      const json = await res.json()
      setConnections(json.connections ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchConnections() }, [])

  function getConnection(providerId: string) {
    return connections.find((c) => c.provider === providerId)
  }

  function handleSync(providerId: string) {
    fetchConnections()
  }

  function handleDisconnect(providerId: string) {
    setConnections((prev) => prev.map((c) =>
      c.provider === providerId ? { ...c, status: 'disconnected' } : c
    ))
  }

  async function handleConnectPlaid() {
    setPlaidConnecting(true)
    setPlaidError('')
    try {
      const res = await fetch('/api/connections/plaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link-token' }),
      })
      const json = await res.json()
      if (!res.ok) { setPlaidError(json.error ?? 'Failed to create link token'); return }

      const link = await loadPlaidLink(json.link_token, async (publicToken: string) => {
        const exchangeRes = await fetch('/api/connections/plaid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'exchange', public_token: publicToken }),
        })
        if (exchangeRes.ok) {
          await fetchConnections()
        } else {
          const err = await exchangeRes.json()
          setPlaidError(err.error ?? 'Token exchange failed')
        }
      })
      link.open()
    } catch (err) {
      setPlaidError(err instanceof Error ? err.message : 'Failed to connect bank')
    } finally {
      setPlaidConnecting(false)
    }
  }

  const configured = PROVIDERS.filter((p) => !p.comingSoon)
  const comingSoon = PROVIDERS.filter((p) => p.comingSoon)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <p className="text-sm text-gray-500 mt-0.5">Connect your financial data sources to sync transactions automatically</p>
      </div>

      {plaidError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-700">{plaidError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {configured.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                connection={getConnection(provider.id)}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                onConnectPlaid={handleConnectPlaid}
              />
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Coming Soon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {comingSoon.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                connection={getConnection(provider.id)}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                onConnectPlaid={handleConnectPlaid}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
