# Integration Production Approvals

Tracks the production approval status for every integration in Finvio.
Update the **Status** column as each one progresses.

**URLs to have ready for every submission:**
- Privacy Policy: `https://finvio.ai/privacy`
- Terms of Service: `https://finvio.ai/terms`
- App homepage: `https://finvio.ai`
- Support email: `hello@finvio.ai`
- OAuth callback base: `https://finvio.ai/api/connections/<provider>/callback`

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ Not started |
| 🔵 In progress / submitted |
| ✅ Approved / live |
| ❌ Rejected / blocked |

---

## Integrations

### 1. Stripe Connect
| Field | Detail |
|-------|--------|
| **Status** | ⬜ Not started |
| **Connection method** | OAuth (Stripe Connect — Standard accounts) |
| **Scopes used** | `read_write` (on connected accounts) |
| **Approval portal** | https://dashboard.stripe.com/settings/connect |
| **Callback URL** | `https://finvio.ai/api/connections/stripe/callback` |
| **Env vars needed** | `STRIPE_CLIENT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_REDIRECT_URI` |

**What Stripe requires:**
- [ ] Business name, website, and description of how you use Connect
- [ ] Privacy Policy URL
- [ ] Terms of Service URL
- [ ] Description of what data you access and why (`read_write` — used for charges, payouts, customer sync)
- [ ] Activate the Connect platform (Settings → Connect → Get started)
- [ ] Set redirect URI in the Connect settings to the callback URL above

**Notes:** Stripe's Connect review is relatively fast (usually auto-approved for read-only patterns). `read_write` scope may require manual review — justify it as needed for transaction sync and MRR/ARR calculation. No video or demo required.

---

### 2. Brex
| Field | Detail |
|-------|--------|
| **Status** | ⬜ Not started |
| **Connection method** | OAuth with PKCE |
| **Scopes used** | `openid offline_access transactions.readonly accounts.readonly` |
| **Approval portal** | https://developer.brex.com — Developer Portal → App → Submit for production |
| **Callback URL** | `https://finvio.ai/api/connections/brex/callback` |
| **Env vars needed** | `BREX_CLIENT_ID`, `BREX_CLIENT_SECRET`, `BREX_REDIRECT_URI` |

**What Brex requires:**
- [ ] Apply for Brex developer API access (may require business verification)
- [ ] Register app in Brex Developer Portal with callback URL
- [ ] Privacy Policy URL
- [ ] Terms of Service URL
- [ ] Description of use case (bookkeeping / financial data sync)
- [ ] Scopes justification: `transactions.readonly` and `accounts.readonly` for expense tracking and reconciliation
- [ ] Submit app for production review

**Notes:** Brex's API is currently invite-only / limited. You may need to email developer-relations@brex.com or go through a partnership process. Scopes are read-only which helps.

---

### 3. Shopify
| Field | Detail |
|-------|--------|
| **Status** | ⬜ Not started |
| **Connection method** | OAuth (Shopify Partner App) |
| **Scopes used** | `read_customers`, `read_orders`, `read_products` |
| **Approval portal** | https://partners.shopify.com → Apps → Your app → Submit for review |
| **Callback URL** | `https://finvio.ai/api/connections/shopify/callback` |
| **Env vars needed** | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` |

**What Shopify requires:**
- [ ] Create app in Shopify Partner Dashboard
- [ ] App must have a working install flow (the OAuth connect button)
- [ ] Privacy Policy URL (required field in Partner Dashboard)
- [ ] App listing: name, description, icon (512×512 px), screenshots
- [ ] Functional testing — reviewer will install and test the app
- [ ] Data usage declaration: confirm you only read and do not write order/customer data
- [ ] Submit for Shopify App Review (public apps require review; custom/unlisted apps do not)

**Notes:** For early access, consider using a **Custom App** (unlisted, per-merchant install link) which bypasses the full public review. Upgrade to a listed Public App when you need wider distribution. Read-only scopes (`read_*`) are typically approved without issues.

---

### 4. QuickBooks (Intuit)
| Field | Detail |
|-------|--------|
| **Status** | ⬜ Not started |
| **Connection method** | OAuth 2.0 (Intuit Developer Platform) |
| **Scopes used** | `com.intuit.quickbooks.accounting` |
| **Approval portal** | https://developer.intuit.com → App → Production → Go Live |
| **Callback URL** | `https://finvio.ai/api/connections/quickbooks/callback` |
| **Env vars needed** | `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `QB_REDIRECT_URI` |

**What Intuit requires:**
- [ ] App registered in Intuit Developer portal
- [ ] Switch app environment to Production (sandbox → production keys)
- [ ] Complete Intuit's "Go Live" checklist:
  - [ ] App name and description
  - [ ] App icon (100×100 px)
  - [ ] Privacy Policy URL
  - [ ] Terms of Service URL
  - [ ] Support contact (hello@finvio.ai)
  - [ ] Security questionnaire (data storage, encryption, access control)
  - [ ] Screenshot or screen recording of the integration in use
- [ ] Intuit compliance review (typically 5–10 business days)

**Notes:** Intuit's review is the most thorough of all integrations. The security questionnaire asks about how you store OAuth tokens (encrypted at rest — you can confirm AES-256). The `accounting` scope is broad but standard for bookkeeping apps.

---

### 5. PayPal
| Field | Detail |
|-------|--------|
| **Status** | ✅ No platform review needed |
| **Connection method** | User provides their own PayPal REST API credentials (client ID + secret) |
| **Scopes used** | N/A — client credentials flow using user's own app |
| **Approval portal** | N/A for Finvio; users manage their own PayPal developer account |
| **Env vars needed** | None — credentials stored per-org in `connections` table |

**Notes:** Because users paste their own PayPal client credentials, Finvio does not have a platform-level PayPal app to approve. However, users must upgrade their own PayPal developer app from sandbox to live at https://developer.paypal.com. Document this in the in-app connection flow UI.

**User-facing note to add to UI:** "Switch your PayPal app to Live mode in the [PayPal Developer Dashboard](https://developer.paypal.com) before connecting."

---

### 6. Mercury
| Field | Detail |
|-------|--------|
| **Status** | ⬜ Not started (limited partner access) |
| **Connection method** | User provides their own Mercury API token |
| **Scopes used** | N/A — read token issued by user in Mercury settings |
| **Approval portal** | https://mercury.com/settings/api (user-side) |
| **Env vars needed** | None — token stored per-org in `connections` table |

**What Mercury requires:**
- [ ] Mercury's API is currently in limited/beta access — apply via https://mercury.com/api-access or contact Mercury partnerships
- [ ] Submit: company name, use case description, website (finvio.ai), Privacy Policy
- [ ] Mercury may require a formal partner agreement for third-party apps integrating at scale

**Notes:** Individual users can already use their own API tokens. The issue is whether Mercury will allow Finvio to direct users to connect — this may require a partnership email to Mercury (partnerships@mercury.com). Until then, users with API access can connect manually.

---

### 7. Lemon Squeezy
| Field | Detail |
|-------|--------|
| **Status** | ✅ No platform review needed |
| **Connection method** | User provides their own Lemon Squeezy API key |
| **Scopes used** | N/A — standard API key with full account access |
| **Approval portal** | N/A — all LS users can generate API keys at https://app.lemonsqueezy.com/settings/api |
| **Env vars needed** | None — key stored per-org in `connections` table |

**Notes:** No approval process. Users generate an API key in their Lemon Squeezy dashboard and paste it into Finvio. Works in production immediately.

---

### 8. Plaid
| Field | Detail |
|-------|--------|
| **Status** | ⬜ Not started |
| **Connection method** | User provides their own Plaid credentials (`client_id` + `secret`) |
| **Scopes used** | `transactions`, `auth`, `identity` (via Plaid Link) |
| **Approval portal** | https://dashboard.plaid.com/team/api — upgrade to Production |
| **Env vars needed** | None — credentials stored per-org in `connections` table |

**What Plaid requires (for users' own accounts):**
- This is a user-side approval, not a Finvio platform approval
- Users must apply for Plaid Production access at https://dashboard.plaid.com/team/api
- Plaid requires: company name, website, use case description, Privacy Policy, expected user volume
- [ ] Document the user upgrade path in the in-app connection UI

**Notes:** Plaid's `sandbox` → `development` (100 real users, free) → `production` (paid, requires Plaid approval). Since users provide their own Plaid credentials, Finvio does not need a separate approval. However, guide users through upgrading their Plaid environment in the connections UI.

---

### 9. Gmail (Google)
| Field | Detail |
|-------|--------|
| **Status** | ⬜ Not started |
| **Connection method** | OAuth 2.0 (Google Cloud Console) |
| **Scopes used** | `gmail.readonly`, `userinfo.email` |
| **Approval portal** | https://console.cloud.google.com → APIs & Services → OAuth consent screen → Publish → Verify |
| **Callback URL** | `https://finvio.ai/api/connections/gmail/callback` |
| **Env vars needed** | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` |

**What Google requires:**
- [ ] Google Cloud project with Gmail API enabled
- [ ] OAuth consent screen configured (External user type)
- [ ] App name, support email (hello@finvio.ai), developer contact
- [ ] Privacy Policy URL (must be publicly accessible — ✅ finvio.ai/privacy)
- [ ] Authorized domain: `finvio.ai`
- [ ] Scopes declaration with justification:
  - `gmail.readonly` — parse expense receipts from email
  - `userinfo.email` — identify the connected account
- [ ] **`gmail.readonly` is a Restricted scope** → requires Google's OAuth app verification
  - Submit for verification via the Cloud Console
  - Google reviews the justification for accessing email content
  - Typical turnaround: 3–7 business days (can be longer if they request a video demo)
- [ ] If user count exceeds 100 during review: stay in testing mode with explicit test users

**Notes:** This is the most sensitive approval. `gmail.readonly` allows reading all email — Google scrutinizes this carefully. Be precise in the justification: "We read email subjects and bodies only to extract expense receipt data. We do not store full email content." Consider demoing the receipt parsing feature in a Loom.

---

### 10. Outlook (Microsoft)
| Field | Detail |
|-------|--------|
| **Status** | ⬜ Not started |
| **Connection method** | OAuth 2.0 (Microsoft Azure / Entra ID) |
| **Scopes used** | `Mail.Read`, `offline_access`, `User.Read` |
| **Approval portal** | https://portal.azure.com → Microsoft Entra ID → App registrations |
| **Callback URL** | `https://finvio.ai/api/connections/outlook/callback` |
| **Env vars needed** | `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_REDIRECT_URI` |

**What Microsoft requires:**
- [ ] Register app in Azure Portal (App registrations → New registration)
- [ ] Set redirect URI to the callback URL above
- [ ] Add API permissions: `Mail.Read`, `offline_access`, `User.Read` (all Delegated)
- [ ] Branding: app name, logo, Privacy Statement URL (finvio.ai/privacy), Terms of Service URL (finvio.ai/terms)
- [ ] For multi-tenant apps (any Microsoft account): no formal review required, but app is subject to Microsoft's publisher verification
- [ ] **Publisher verification** (recommended): verify your domain at https://partner.microsoft.com to show a "verified" badge on the consent screen — improves user trust
- [ ] `Mail.Read` does not require additional Microsoft review for business apps

**Notes:** Microsoft's process is mostly self-serve. The main task is registering the Azure app and configuring the correct redirect URI and permissions. Publisher verification is optional but recommended to avoid the "unverified publisher" warning on the consent screen.

---

## Priority Order

| Priority | Integration | Reason |
|----------|-------------|--------|
| 1 | **Stripe** | Core revenue feature; most customers have Stripe |
| 2 | **QuickBooks** | Intuit review takes longest (5–10 days) — start first |
| 3 | **Shopify** | High-value for e-commerce customers |
| 4 | **Brex** | Required for expense tracking; limited partner access |
| 5 | **Gmail** | Google review can take 3–7+ days |
| 6 | **Outlook** | Self-serve Azure registration |
| 7 | **Mercury** | API is in limited access; need partner contact |
| 8 | **Plaid** | User-side approval; just improve in-app guidance |
| — | **PayPal** | No Finvio approval needed |
| — | **Lemon Squeezy** | No Finvio approval needed |

---

## Shared Requirements Checklist

Before submitting any integration for review, confirm:

- [x] Privacy Policy live at `https://finvio.ai/privacy`
- [x] Terms of Service live at `https://finvio.ai/terms`
- [x] Support email `hello@finvio.ai` is monitored
- [ ] App is deployed to `https://finvio.ai` (not localhost)
- [ ] All callback URIs use `https://` (production, not sandbox)
- [ ] OAuth tokens stored encrypted (AES-256) — ✅ already implemented
- [ ] Users can disconnect integrations at any time — ✅ Settings → Connections
- [ ] Data deletion on disconnect is supported — ✅ removeData flag implemented

---

*Last updated: 2026-06-01*
