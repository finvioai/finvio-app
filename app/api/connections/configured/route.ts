import { NextResponse } from 'next/server'

// Returns which integrations have their server-side credentials configured.
// Stripe uses per-org keys stored in DB, so it's always "configurable" via UI.
// Plaid/Shopify/PayPal need platform-level developer credentials in env.
export async function GET() {
  return NextResponse.json({
    stripe: true, // always available — user provides their own key via UI
    plaid: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
    shopify: !!(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET),
    paypal: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
  })
}
