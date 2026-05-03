import { NextResponse } from 'next/server'

// PayPal OAuth callback is no longer used.
// PayPal now connects via per-user client credentials entered through the UI modal.
export async function GET() {
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/connections`
  )
}
