import { NextResponse } from 'next/server'

// All integrations now use per-user credentials entered via UI.
// Plaid still needs platform credentials for link token creation if no per-org
// credentials are stored, but if org credentials exist they take priority.
export async function GET() {
  return NextResponse.json({
    stripe: true,
    plaid: true,
    shopify: true,
    paypal: true,
    quickbooks: true,
  })
}
