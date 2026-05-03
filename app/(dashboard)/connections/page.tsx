'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Unplug, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Connection } from '@/types'
import { cn } from '@/lib/utils'

// ─── Provider config ──────────────────────────────────────────────────────────

interface ProviderConfig {
  id: string
  name: string
  description: string
  logo: string
  comingSoon?: boolean
  syncRoute?: string
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
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Sync PayPal transactions and settlements',
    logo: '💰',
    syncRoute: '/api/sync/paypal',
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

function providerEnvLabel(id: string): string {
  const labels: Record<string, string> = {
    plaid: 'PLAID_CLIENT_ID + PLAID_SECRET',
    shopify: 'SHOPIFY_API_KEY + SHOPIFY_API_SECRET',
    paypal: 'PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET',
  }
  return labels[id] ?? 'required env vars'
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Provider Card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  connection,
  configured,
  onSync,
  onDisconnect,
  onConnect,
}: {
  provider: ProviderConfig
  connection?: Connection
  configured: boolean
  onSync: (providerId: string) => void
  onDisconnect: (providerId: string) => void
  onConnect: (providerId: string) => void
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
      setSyncResult({ synced: json.synced ?? 0, skipped: json.skipped ?? 0 })
      onSync(provider.id)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const routeMap: Record<string, string> = {
        stripe: '/api/connections/stripe',
        plaid: '/api/connections/plaid',
        shopify: '/api/connections/shopify',
        paypal: '/api/connections/paypal',
      }
      const url = routeMap[provider.id]
      if (!url) return
      await fetch(url, { method: 'DELETE' })
      onDisconnect(provider.id)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className={cn('rounded-xl border bg-white p-5 space-y-4 transition-opacity', provider.comingSoon && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl shrink-0">
          {provider.logo}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">{provider.name}</h3>
            {provider.comingSoon && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Coming Soon</span>
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
        <div className="flex gap-2 flex-wrap">
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
          ) : configured ? (
            <Button size="sm" onClick={() => onConnect(provider.id)}>
              Connect {provider.name}
            </Button>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Add <code className="font-mono font-semibold">{providerEnvLabel(provider.id)}</code> to your <code className="font-mono">.env.local</code> to enable this integration.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Plaid helper ─────────────────────────────────────────────────────────────

async function loadPlaidLink(
  token: string,
  onSuccess: (publicToken: string) => void
): Promise<{ open: () => void }> {
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

type ModalType = 'stripe' | 'shopify' | 'paypal' | null

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modal, setModal] = useState<ModalType>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  // Per-modal inputs
  const [stripeKey, setStripeKey] = useState('')
  const [shopDomain, setShopDomain] = useState('')

  // Page-level errors (e.g. Plaid)
  const [pageError, setPageError] = useState('')

  async function fetchConnections() {
    const [connRes, cfgRes] = await Promise.all([
      fetch('/api/connections'),
      fetch('/api/connections/configured'),
    ])
    if (connRes.ok) {
      const json = await connRes.json()
      setConnections(json.connections ?? [])
    }
    if (cfgRes.ok) {
      setConfigured(await cfgRes.json())
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

  function closeModal() {
    setModal(null)
    setModalError('')
    setStripeKey('')
    setShopDomain('')
  }

  async function handleConnect(providerId: string) {
    setPageError('')
    if (providerId === 'stripe') {
      setModal('stripe')
    } else if (providerId === 'plaid') {
      await handleConnectPlaid()
    } else if (providerId === 'shopify') {
      setModal('shopify')
    } else if (providerId === 'paypal') {
      window.location.href = '/api/connections/paypal'
    }
  }

  async function handleConnectPlaid() {
    setPageError('')
    try {
      const res = await fetch('/api/connections/plaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link-token' }),
      })
      const json = await res.json()
      if (!res.ok) { setPageError(json.error ?? 'Failed to create link token'); return }

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
          setPageError(err.error ?? 'Token exchange failed')
        }
      })
      link.open()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to connect bank')
    }
  }

  async function submitStripeConnect() {
    setModalLoading(true)
    setModalError('')
    try {
      const res = await fetch('/api/connections/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret_key: stripeKey.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setModalError(json.error ?? 'Failed to connect Stripe'); return }
      closeModal()
      await fetchConnections()
    } finally {
      setModalLoading(false)
    }
  }

  function submitShopifyConnect() {
    const domain = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!domain) { setModalError('Enter your Shopify store domain'); return }
    window.location.href = `/api/connections/shopify?shop=${encodeURIComponent(domain)}`
  }

  const configuredProviders = PROVIDERS.filter((p) => !p.comingSoon)
  const comingSoon = PROVIDERS.filter((p) => p.comingSoon)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <p className="text-sm text-gray-500 mt-0.5">Connect your financial data sources to sync transactions automatically</p>
      </div>

      {pageError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{pageError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {configuredProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                connection={getConnection(provider.id)}
                configured={configured[provider.id] !== false}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                onConnect={handleConnect}
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
                configured={false}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                onConnect={handleConnect}
              />
            ))}
          </div>
        </>
      )}

      {/* Stripe Connect Modal */}
      {modal === 'stripe' && (
        <Modal title="Connect Stripe" onClose={closeModal}>
          <p className="text-sm text-gray-500">
            Enter your Stripe secret key from your{' '}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Stripe Dashboard → API Keys
            </a>
            . Use a restricted key with read access for better security.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Secret Key</label>
            <input
              type="password"
              value={stripeKey}
              onChange={(e) => setStripeKey(e.target.value)}
              placeholder="sk_live_… or sk_test_…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>
          {modalError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" /> {modalError}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <Button onClick={submitStripeConnect} disabled={modalLoading || !stripeKey.trim()} className="flex-1">
              {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect Stripe'}
            </Button>
            <Button variant="outline" onClick={closeModal} disabled={modalLoading}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* Shopify Connect Modal */}
      {modal === 'shopify' && (
        <Modal title="Connect Shopify" onClose={closeModal}>
          <p className="text-sm text-gray-500">
            Enter your Shopify store domain to begin the authorization flow.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Store Domain</label>
            <input
              type="text"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="your-store.myshopify.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>
          {modalError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" /> {modalError}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <Button onClick={submitShopifyConnect} disabled={!shopDomain.trim()} className="flex-1">
              Connect Shopify
            </Button>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
