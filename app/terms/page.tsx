import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Finvio',
  description: 'Terms and conditions for using the Finvio platform.',
  openGraph: {
    title: 'Terms of Service — Finvio',
    url: 'https://finvio.ai/terms',
  },
}

export default function TermsPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-24">
        <div className="mb-12">
          <p className="font-mono-eyebrow text-brand">Legal</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy">Terms of Service</h1>
          <p className="mt-4 text-sm text-muted-ink">Last updated: June 1, 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-10 text-muted-ink">

          <section>
            <h2 className="text-xl font-bold text-navy">1. Acceptance of Terms</h2>
            <p className="mt-3 leading-relaxed">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Finvio platform, including the website at finvio.ai and all related services (collectively, the &quot;Service&quot;), provided by Finvio LLC (&quot;Finvio&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;).
            </p>
            <p className="mt-3 leading-relaxed">
              By creating an account or using the Service, you agree to be bound by these Terms. If you are using the Service on behalf of a company or organization, you represent that you have authority to bind that entity to these Terms.
            </p>
            <p className="mt-3 leading-relaxed">
              If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">2. Description of Service</h2>
            <p className="mt-3 leading-relaxed">
              Finvio is an AI-powered financial operations platform designed for startups, US LLCs, and growing businesses. The Service includes:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Automated syncing of financial data from connected third-party accounts</li>
              <li>AI-assisted transaction categorization and reconciliation</li>
              <li>Financial reporting, dashboards, and metric calculations (MRR, ARR, burn rate, P&L)</li>
              <li>Invoice creation, management, and delivery</li>
              <li>AI-powered financial advisor (chat interface)</li>
              <li>Workflow automations for accounting operations</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              Finvio is a financial management and reporting tool. It is not a bank, broker-dealer, investment advisor, accounting firm, or tax preparation service. Information provided by the Service, including AI-generated insights, does not constitute financial, legal, accounting, or tax advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">3. Account Registration</h2>
            <p className="mt-3 leading-relaxed">
              To use the Service you must create an account with accurate and complete information. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. You must notify us immediately at <a href="mailto:hello@finvio.ai" className="text-brand hover:underline">hello@finvio.ai</a> if you suspect unauthorized access to your account.
            </p>
            <p className="mt-3 leading-relaxed">
              You must be at least 18 years old to use the Service. Accounts are for business use; personal consumer finance use is outside the intended scope of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">4. Third-Party Integrations and Data Access</h2>
            <p className="mt-3 leading-relaxed">
              Finvio connects to third-party financial platforms (including but not limited to Mercury, Brex, Stripe, Shopify, PayPal, QuickBooks, Plaid, and Lemon Squeezy) via OAuth or API credentials that you provide. By connecting an integration:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>You authorize Finvio to access and store data from that platform on your behalf</li>
              <li>You confirm you have the right to grant such access</li>
              <li>You understand that Finvio is not responsible for the availability, accuracy, or security practices of those third-party platforms</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              You can revoke any integration at any time from Settings → Connections. Revoking access will stop future syncs but will not automatically delete previously synced data from Finvio.
            </p>
            <p className="mt-3 leading-relaxed">
              Each third-party platform is subject to its own terms of service and privacy policy. Your use of those integrations is governed by those platforms&apos; terms in addition to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">5. Acceptable Use</h2>
            <p className="mt-3 leading-relaxed">You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Use the Service for any unlawful purpose or in violation of applicable regulations</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
              <li>Reverse engineer, decompile, or extract the source code of the Service</li>
              <li>Use the Service to transmit malicious code, spam, or fraudulent data</li>
              <li>Resell or provide the Service to third parties without written authorization from Finvio</li>
              <li>Use automated means to scrape or extract data from the Service at scale</li>
              <li>Misrepresent your identity or affiliation when using the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">6. AI Features and Financial Accuracy</h2>
            <p className="mt-3 leading-relaxed">
              Finvio uses AI models to assist with transaction categorization, financial summaries, and advisory responses. You acknowledge that:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>AI-generated outputs may contain errors and should be reviewed before relying on them for material decisions</li>
              <li>Financial metrics computed by Finvio (MRR, ARR, burn rate, etc.) are estimates based on the data synced to the platform and may differ from your audited financials</li>
              <li>The AI advisor does not constitute professional financial, accounting, tax, or legal advice</li>
              <li>You are solely responsible for verifying the accuracy of categorizations, reports, and AI-generated content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">7. Subscription and Payment</h2>
            <p className="mt-3 leading-relaxed">
              During the early access period, Finvio may be provided free of charge. When paid plans are introduced, the following will apply:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Subscription fees are billed in advance on a monthly or annual basis</li>
              <li>All fees are non-refundable except as required by applicable law or as explicitly stated in a separate agreement</li>
              <li>We reserve the right to change pricing with 30 days&apos; notice</li>
              <li>Failure to pay may result in suspension or termination of your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">8. Intellectual Property</h2>
            <p className="mt-3 leading-relaxed">
              The Service and all related technology, software, designs, and content are owned by Finvio LLC and protected by applicable intellectual property laws. These Terms do not grant you any rights to Finvio&apos;s intellectual property.
            </p>
            <p className="mt-3 leading-relaxed">
              You retain ownership of all data you bring into Finvio. By using the Service, you grant Finvio a limited, non-exclusive license to store, process, and display your data solely for the purpose of providing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">9. Confidentiality</h2>
            <p className="mt-3 leading-relaxed">
              We treat your financial data as confidential. Our employees and contractors who access user data do so only to provide and improve the Service, and are bound by confidentiality obligations. We will not disclose your financial data to third parties except as described in our Privacy Policy or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">10. Termination</h2>
            <p className="mt-3 leading-relaxed">
              You may cancel your account at any time by contacting us at <a href="mailto:hello@finvio.ai" className="text-brand hover:underline">hello@finvio.ai</a> or through the account settings. Upon cancellation, your access to the Service will end at the close of the current billing period.
            </p>
            <p className="mt-3 leading-relaxed">
              We may suspend or terminate your account immediately if you violate these Terms, engage in fraudulent activity, or create legal risk for Finvio. We will make reasonable efforts to notify you before termination except where immediate action is necessary.
            </p>
            <p className="mt-3 leading-relaxed">
              Upon termination, you may request an export of your data within 30 days. After 90 days post-termination, your data may be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">11. Disclaimer of Warranties</h2>
            <p className="mt-3 leading-relaxed">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="mt-3 leading-relaxed">
              We do not warrant that the Service will be uninterrupted, error-free, or that financial data synced from third-party platforms will be complete or accurate. Third-party APIs may change, go offline, or return incomplete data without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">12. Limitation of Liability</h2>
            <p className="mt-3 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FINVIO LLC AND ITS OFFICERS, EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS — ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
            </p>
            <p className="mt-3 leading-relaxed">
              IN NO EVENT SHALL FINVIO&apos;S TOTAL LIABILITY TO YOU EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO FINVIO IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100 USD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">13. Indemnification</h2>
            <p className="mt-3 leading-relaxed">
              You agree to indemnify and hold harmless Finvio LLC and its officers, employees, and affiliates from and against any claims, losses, damages, and expenses (including legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any applicable law or third-party right.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">14. Governing Law and Disputes</h2>
            <p className="mt-3 leading-relaxed">
              These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict-of-law principles. Any dispute arising from these Terms or your use of the Service shall be resolved by binding arbitration in accordance with the rules of the American Arbitration Association, except that either party may seek injunctive relief in a court of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">15. Changes to Terms</h2>
            <p className="mt-3 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will provide at least 14 days&apos; notice of material changes via email or in-app notification. Continued use of the Service after the effective date of the updated Terms constitutes your acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">16. Contact</h2>
            <p className="mt-3 leading-relaxed">
              For questions about these Terms, please contact us:
            </p>
            <div className="mt-4 rounded-lg border border-hairline bg-off-white p-5 text-sm">
              <p className="font-semibold text-navy">Finvio LLC</p>
              <p className="mt-1 text-muted-ink">Email: <a href="mailto:hello@finvio.ai" className="text-brand hover:underline">hello@finvio.ai</a></p>
              <p className="mt-1 text-muted-ink">Website: <a href="https://finvio.ai" className="text-brand hover:underline">finvio.ai</a></p>
            </div>
          </section>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
