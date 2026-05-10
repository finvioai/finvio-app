'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Unplug, X, ExternalLink } from 'lucide-react'
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
  oauthRedirect?: boolean  // true = Connect button redirects browser to OAuth (no modal)
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'stripe',   name: 'Stripe',      description: 'Sync charges, invoices, subscriptions and customer data', logo: '💳', syncRoute: '/api/sync/stripe', oauthRedirect: true },
  { id: 'plaid',    name: 'Plaid (Bank)', description: 'Connect your bank account for real-time transaction sync', logo: '🏦', comingSoon: true },
  { id: 'shopify',  name: 'Shopify',      description: 'Import paid orders and revenue from your Shopify store',  logo: '🛍', syncRoute: '/api/sync/shopify' },
  { id: 'paypal',   name: 'PayPal',       description: 'Sync PayPal transactions and settlements',                logo: '💰', syncRoute: '/api/sync/paypal' },
  { id: 'quickbooks', name: 'QuickBooks', description: 'Sync expenses, paid invoices and sales receipts from QuickBooks Online', logo: '📒', syncRoute: '/api/sync/quickbooks', oauthRedirect: true },
  { id: 'gmail',    name: 'Gmail',        description: 'Import income & expenses from financial emails (receipts, invoices, payments)', logo: '📧', syncRoute: '/api/sync/gmail',   oauthRedirect: true },
  { id: 'outlook',  name: 'Outlook',      description: 'Import income & expenses from financial emails (receipts, invoices, payments)', logo: '📨', syncRoute: '/api/sync/outlook', oauthRedirect: true },
  { id: 'mercury',  name: 'Mercury',      description: 'Connect Mercury business banking',                        logo: '☿',  comingSoon: true },
  { id: 'xero',     name: 'Xero',         description: 'Import accounting data from Xero',                       logo: '📊', comingSoon: true },
  { id: 'brex',     name: 'Brex',         description: 'Sync Brex card transactions and expenses',               logo: '💼', comingSoon: true },
]

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

function FieldInput({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ─── Provider Card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  connection,
  onSync,
  onDisconnect,
  onConnect,
}: {
  provider: ProviderConfig
  connection?: Connection
  onSync: (providerId: string) => void
  onDisconnect: (providerId: string) => void
  onConnect: (providerId: string) => void
}) {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number } | null>(null)
  const [syncError, setSyncError] = useState('')

  // 'active' = fully connected, 'setup' = credentials saved but bank not linked yet (Plaid)
  const isActive = connection?.status === 'active'
  const isSetup = connection?.status === 'setup'

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

  return (
    <div className={cn('rounded-xl border bg-white p-5 space-y-4 transition-opacity', provider.comingSoon && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl shrink-0">{provider.logo}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">{provider.name}</h3>
            {provider.comingSoon && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Coming Soon</span>}
            {isActive && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"><CheckCircle2 className="h-3 w-3" /> Connected</span>}
            {isSetup && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Credentials saved</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{provider.description}</p>
        </div>
      </div>

      {isActive && connection && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 space-y-0.5">
          {connection.account_name && <p className="text-xs text-gray-600 font-medium">{connection.account_name}</p>}
          <p className="text-xs text-gray-400">Last synced: {connection.last_synced_at ? fmtDate(connection.last_synced_at) : 'Never'}</p>
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
          {isActive ? (
            <>
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1.5">{syncing ? 'Syncing…' : 'Sync Now'}</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDisconnect(provider.id)} className="border-red-200 text-red-600 hover:bg-red-50">
                <Unplug className="h-3.5 w-3.5" />
                <span className="ml-1.5">Disconnect</span>
              </Button>
            </>
          ) : isSetup ? (
            // Plaid: credentials saved, still need bank link
            <>
              <Button size="sm" onClick={() => onConnect(provider.id)}>Connect Bank Account</Button>
              <Button size="sm" variant="outline" onClick={() => onDisconnect(provider.id)} className="border-red-200 text-red-600 hover:bg-red-50">
                <span>Remove</span>
              </Button>
            </>
          ) : provider.oauthRedirect ? (
            <Button size="sm" onClick={() => onConnect(provider.id)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Authorize with {provider.name}
            </Button>
          ) : (
            <Button size="sm" onClick={() => onConnect(provider.id)}>
              Connect {provider.name}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Plaid Link helper ────────────────────────────────────────────────────────

async function loadPlaidLink(token: string, onSuccess: (publicToken: string) => void): Promise<{ open: () => void }> {
  await new Promise<void>((resolve, reject) => {
    if (document.getElementById('plaid-link-script')) { resolve(); return }
    const script = document.createElement('script')
    script.id = 'plaid-link-script'
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
  // @ts-expect-error — Plaid Link loaded dynamically
  return window.Plaid.create({ token, onSuccess: (pt: string) => onSuccess(pt), onExit: () => {} })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalType = 'shopify' | 'paypal' | 'plaid' | null

const OAUTH_ERRORS: Record<string, string> = {
  stripe_not_configured: 'Stripe Connect is not configured. Add STRIPE_CLIENT_ID to your environment.',
  stripe_denied: 'Stripe authorization was cancelled.',
  stripe_invalid_callback: 'Invalid Stripe callback. Please try again.',
  stripe_state_mismatch: 'Authorization request expired. Please try again.',
  stripe_no_org: 'Organization not found. Please try again.',
  stripe_token_exchange: 'Failed to exchange Stripe authorization code. Please try again.',
  stripe_save_failed: 'Failed to save Stripe connection. Please try again.',
  shopify_not_configured: 'Shopify is not configured on this platform. Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET to your environment.',
  shopify_denied: 'Shopify authorization was cancelled.',
  shopify_no_shop: 'No store domain provided. Please enter your store domain and try again.',
  shopify_invalid: 'Invalid Shopify callback. Please try again.',
  shopify_csrf: 'Authorization request expired. Please try again.',
  shopify_no_org: 'Organization not found. Please try again.',
  shopify_failed: 'Failed to save Shopify connection. Please try again.',
  qb_not_configured: 'QuickBooks is not configured on this platform. Add QB_CLIENT_ID and QB_CLIENT_SECRET to your environment.',
  qb_denied: 'QuickBooks authorization was cancelled.',
  qb_invalid_callback: 'Invalid QuickBooks callback. Please try again.',
  qb_state_mismatch: 'Authorization request expired. Please try again.',
  qb_no_org: 'Organization not found. Please try again.',
  qb_token_exchange: 'Failed to exchange QuickBooks authorization code. Please try again.',
  qb_save_failed: 'Failed to save QuickBooks connection. Please try again.',
  gmail_not_configured: 'Gmail is not configured on this platform. Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to your environment.',
  gmail_denied: 'Gmail authorization was cancelled.',
  gmail_invalid_callback: 'Invalid Gmail callback. Please try again.',
  gmail_state_mismatch: 'Authorization request expired. Please try again.',
  gmail_no_org: 'Organization not found. Please try again.',
  gmail_token_exchange: 'Failed to exchange Gmail authorization code. Please try again.',
  gmail_save_failed: 'Failed to save Gmail connection. Please try again.',
  outlook_not_configured: 'Outlook is not configured on this platform. Add OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET to your environment.',
  outlook_denied: 'Outlook authorization was cancelled.',
  outlook_invalid_callback: 'Invalid Outlook callback. Please try again.',
  outlook_state_mismatch: 'Authorization request expired. Please try again.',
  outlook_no_org: 'Organization not found. Please try again.',
  outlook_token_exchange: 'Failed to exchange Outlook authorization code. Please try again.',
  outlook_save_failed: 'Failed to save Outlook connection. Please try again.',
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [pageError, setPageError] = useState('')
  const [pageSuccess, setPageSuccess] = useState('')
  const [disconnectTarget, setDisconnectTarget] = useState<{ provider: string; label: string } | null>(null)
  const [removeData, setRemoveData] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Shopify
  const [shopDomain, setShopDomain] = useState('')
  // PayPal
  const [paypalClientId, setPaypalClientId] = useState('')
  const [paypalSecret, setPaypalSecret] = useState('')
  const [paypalSandbox, setPaypalSandbox] = useState(true)
  // Plaid
  const [plaidClientId, setPlaidClientId] = useState('')
  const [plaidSecret, setPlaidSecret] = useState('')
  const [plaidEnv, setPlaidEnv] = useState<'sandbox' | 'development' | 'production'>('sandbox')

  async function fetchConnections() {
    const res = await fetch('/api/connections')
    if (res.ok) {
      const json = await res.json()
      setConnections(json.connections ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchConnections()
    // Handle return from QuickBooks OAuth
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')
    const CONNECTED_LABELS: Record<string, string> = {
      stripe: 'Stripe',
      quickbooks: 'QuickBooks',
      gmail: 'Gmail',
      outlook: 'Outlook',
      shopify: 'Shopify',
    }
    if (connected && CONNECTED_LABELS[connected]) {
      setPageSuccess(`${CONNECTED_LABELS[connected]} connected successfully and initial sync is complete.`)
      window.history.replaceState({}, '', '/connections')
    } else if (error && OAUTH_ERRORS[error]) {
      setPageError(OAUTH_ERRORS[error])
      window.history.replaceState({}, '', '/connections')
    }
  }, [])

  function getConnection(providerId: string) {
    return connections.find((c) => c.provider === providerId)
  }

  function closeModal() {
    setModal(null)
    setModalError('')
    setShopDomain('')
    setPaypalClientId('')
    setPaypalSecret('')
    setPlaidClientId('')
    setPlaidSecret('')
  }

  async function handleConnect(providerId: string) {
    setPageError('')
    setPageSuccess('')
    if (providerId === 'shopify') {
      setModal('shopify')
    } else if (providerId === 'paypal') {
      setModal('paypal')
    } else if (providerId === 'plaid') {
      // If credentials are already saved, go straight to Link
      const existing = getConnection('plaid')
      if (existing?.status === 'setup' || existing?.status === 'active') {
        await openPlaidLink()
      } else {
        setModal('plaid')
      }
    } else {
      // Generic OAuth redirect: quickbooks, gmail, outlook, and any future oauthRedirect provider
      const provider = PROVIDERS.find((p) => p.id === providerId)
      if (provider?.oauthRedirect) {
        window.location.href = `/api/connections/${providerId}`
      }
    }
  }

  async function openPlaidLink() {
    setModalLoading(true)
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
    } finally {
      setModalLoading(false)
    }
  }

  function handleSync(providerId: string) { fetchConnections() }
  function handleDisconnect(providerId: string) {
    const providerConfig = PROVIDERS.find((p) => p.id === providerId)
    setRemoveData(false)
    setDisconnectTarget({ provider: providerId, label: providerConfig?.name ?? providerId })
  }

  async function performDisconnect() {
    if (!disconnectTarget) return
    setDisconnecting(true)
    const routeMap: Record<string, string> = {
      stripe: '/api/connections/stripe',
      plaid: '/api/connections/plaid',
      shopify: '/api/connections/shopify',
      paypal: '/api/connections/paypal',
      quickbooks: '/api/connections/quickbooks',
      gmail: '/api/connections/gmail',
      outlook: '/api/connections/outlook',
    }
    try {
      const url = routeMap[disconnectTarget.provider]
      if (url) await fetch(`${url}?removeData=${removeData}`, { method: 'DELETE' })
      setConnections((prev) => prev.map((c) => c.provider === disconnectTarget.provider ? { ...c, status: 'disconnected' } : c))
      setDisconnectTarget(null)
    } finally {
      setDisconnecting(false)
    }
  }

  // ─── Submit handlers ────────────────────────────────────────────────────────

  async function submitGeneric(url: string, body: object, onSuccess: () => void) {
    setModalLoading(true)
    setModalError('')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { setModalError(json.error ?? 'Connection failed'); return }
      closeModal()
      await fetchConnections()
      onSuccess()
    } finally {
      setModalLoading(false)
    }
  }

  function submitShopify() {
    const shop = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!shop) { setModalError('Enter your store domain'); return }
    window.location.href = `/api/connections/shopify?shop=${encodeURIComponent(shop)}`
  }

  async function submitPayPal() {
    if (!paypalClientId.trim() || !paypalSecret.trim()) { setModalError('Both fields are required'); return }
    await submitGeneric('/api/connections/paypal', { client_id: paypalClientId.trim(), client_secret: paypalSecret.trim(), sandbox: paypalSandbox }, () => {})
  }

  async function submitPlaidSetup() {
    if (!plaidClientId.trim() || !plaidSecret.trim()) { setModalError('Both fields are required'); return }
    setModalLoading(true)
    setModalError('')
    try {
      const res = await fetch('/api/connections/plaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', client_id: plaidClientId.trim(), secret: plaidSecret.trim(), plaid_env: plaidEnv }),
      })
      const json = await res.json()
      if (!res.ok) { setModalError(json.error ?? 'Setup failed'); return }
      closeModal()
      await fetchConnections()
      // Auto-open Plaid Link after saving credentials
      await openPlaidLink()
    } finally {
      setModalLoading(false)
    }
  }

  const activeProviders = PROVIDERS.filter((p) => !p.comingSoon)
  const comingSoon = PROVIDERS.filter((p) => p.comingSoon)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <p className="text-sm text-gray-500 mt-0.5">Connect your financial data sources to sync transactions automatically</p>
      </div>

      {pageSuccess && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-700">{pageSuccess}</p>
        </div>
      )}
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
            {activeProviders.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} connection={getConnection(provider.id)}
                onSync={handleSync} onDisconnect={handleDisconnect} onConnect={handleConnect} />
            ))}
          </div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Coming Soon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {comingSoon.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} connection={getConnection(provider.id)}
                onSync={handleSync} onDisconnect={handleDisconnect} onConnect={handleConnect} />
            ))}
          </div>
        </>
      )}

      {/* Shopify Modal */}
      {modal === 'shopify' && (
        <Modal title="Connect Shopify" onClose={closeModal}>
          <p className="text-sm text-gray-500">
            Enter your store name and you&apos;ll be taken to Shopify to authorize access. No API tokens required.
          </p>
          <FieldInput label="Store domain" hint="Just the store name — we'll add .myshopify.com">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitShopify()}
                placeholder="my-store"
                className="flex-1 px-3 py-2 text-sm outline-none"
                autoComplete="off"
                autoFocus
              />
              <span className="flex items-center px-3 bg-gray-50 text-xs text-gray-400 border-l border-gray-300 whitespace-nowrap">
                .myshopify.com
              </span>
            </div>
          </FieldInput>
          {modalError && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4 shrink-0" />{modalError}</p>}
          <div className="flex gap-3 pt-1">
            <Button onClick={submitShopify} disabled={!shopDomain.trim()} className="flex-1">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Authorize with Shopify
            </Button>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* PayPal Modal */}
      {modal === 'paypal' && (
        <Modal title="Connect PayPal" onClose={closeModal}>
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800 space-y-1">
            <p className="font-medium">How to get your credentials:</p>
            <p>1. Go to developer.paypal.com → My Apps & Credentials</p>
            <p>2. Create a REST API app (or use the default one)</p>
            <p>3. Copy Client ID and Secret</p>
          </div>
          <FieldInput label="Client ID">
            <input type="text" value={paypalClientId} onChange={(e) => setPaypalClientId(e.target.value)}
              placeholder="AaBbCc…" className={cn(inputCls, 'font-mono')} autoComplete="off" />
          </FieldInput>
          <FieldInput label="Client Secret">
            <input type="password" value={paypalSecret} onChange={(e) => setPaypalSecret(e.target.value)}
              placeholder="Secret…" className={cn(inputCls, 'font-mono')} autoComplete="off" />
          </FieldInput>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Environment</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              <button onClick={() => setPaypalSandbox(true)}
                className={cn('px-3 py-1.5', paypalSandbox ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                Sandbox
              </button>
              <button onClick={() => setPaypalSandbox(false)}
                className={cn('px-3 py-1.5 border-l border-gray-300', !paypalSandbox ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                Live
              </button>
            </div>
          </div>
          {modalError && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4 shrink-0" />{modalError}</p>}
          <div className="flex gap-3 pt-1">
            <Button onClick={submitPayPal} disabled={modalLoading || !paypalClientId.trim() || !paypalSecret.trim()} className="flex-1">
              {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect PayPal'}
            </Button>
            <Button variant="outline" onClick={closeModal} disabled={modalLoading}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectTarget && (
        <Modal title={`Disconnect ${disconnectTarget.label}?`} onClose={() => !disconnecting && setDisconnectTarget(null)}>
          <p className="text-sm text-gray-600">
            What should happen to the transactions imported from <strong>{disconnectTarget.label}</strong>?
          </p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name="removeData" checked={!removeData} onChange={() => setRemoveData(false)}
                className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <span className="text-sm font-medium text-gray-900">Keep imported data</span>
                <p className="text-xs text-gray-500 mt-0.5">Preserves your financial history — recommended for reporting continuity</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name="removeData" checked={removeData} onChange={() => setRemoveData(true)}
                className="mt-0.5 h-4 w-4 text-red-600" />
              <div>
                <span className="text-sm font-medium text-gray-900">Remove imported data</span>
                <p className="text-xs text-gray-500 mt-0.5">Deletes all transactions synced from {disconnectTarget.label} — cannot be undone</p>
              </div>
            </label>
          </div>
          <div className="flex gap-3 pt-1">
            <Button onClick={performDisconnect} disabled={disconnecting}
              className={removeData ? 'flex-1 bg-red-600 hover:bg-red-700' : 'flex-1'}>
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
            </Button>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)} disabled={disconnecting}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* Plaid Modal */}
      {modal === 'plaid' && (
        <Modal title="Connect Plaid (Bank)" onClose={closeModal}>
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800 space-y-1">
            <p className="font-medium">How to get your credentials:</p>
            <p>1. Sign up free at dashboard.plaid.com</p>
            <p>2. Go to Team Settings → Keys</p>
            <p>3. Copy Client ID and the Secret for your environment</p>
          </div>
          <FieldInput label="Client ID">
            <input type="text" value={plaidClientId} onChange={(e) => setPlaidClientId(e.target.value)}
              placeholder="Plaid client ID" className={cn(inputCls, 'font-mono')} autoComplete="off" />
          </FieldInput>
          <FieldInput label="Secret">
            <input type="password" value={plaidSecret} onChange={(e) => setPlaidSecret(e.target.value)}
              placeholder="Plaid secret" className={cn(inputCls, 'font-mono')} autoComplete="off" />
          </FieldInput>
          <FieldInput label="Environment">
            <select value={plaidEnv} onChange={(e) => setPlaidEnv(e.target.value as typeof plaidEnv)} className={inputCls}>
              <option value="sandbox">Sandbox (testing)</option>
              <option value="development">Development (real banks, limited)</option>
              <option value="production">Production</option>
            </select>
          </FieldInput>
          {modalError && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4 shrink-0" />{modalError}</p>}
          <div className="flex gap-3 pt-1">
            <Button onClick={submitPlaidSetup} disabled={modalLoading || !plaidClientId.trim() || !plaidSecret.trim()} className="flex-1">
              {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Connect Bank'}
            </Button>
            <Button variant="outline" onClick={closeModal} disabled={modalLoading}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
