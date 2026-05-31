import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Finvio',
  description: 'How Finvio collects, uses, and protects your financial data.',
  openGraph: {
    title: 'Privacy Policy — Finvio',
    url: 'https://finvio.ai/privacy',
  },
}

export default function PrivacyPage() {
  return (
    <div data-landing>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-24">
        <div className="mb-12">
          <p className="font-mono-eyebrow text-brand">Legal</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy">Privacy Policy</h1>
          <p className="mt-4 text-sm text-muted-ink">Last updated: June 1, 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-10 text-muted-ink">

          <section>
            <h2 className="text-xl font-bold text-navy">1. Introduction</h2>
            <p className="mt-3 leading-relaxed">
              Finvio LLC (&quot;Finvio&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the Finvio platform — an AI-powered financial operations service available at finvio.ai. This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices you have regarding your data.
            </p>
            <p className="mt-3 leading-relaxed">
              By using Finvio, you agree to the collection and use of information in accordance with this policy. If you do not agree, please discontinue use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">2. Information We Collect</h2>

            <h3 className="mt-5 text-base font-semibold text-navy">2.1 Account Information</h3>
            <p className="mt-2 leading-relaxed">
              When you create an account we collect your name, email address, company name, and authentication credentials. This information is necessary to provide the Service and communicate with you.
            </p>

            <h3 className="mt-5 text-base font-semibold text-navy">2.2 Financial Data</h3>
            <p className="mt-2 leading-relaxed">
              Finvio connects to third-party financial platforms to provide its services. With your explicit authorization, we access and store:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Bank account transactions and balances (via Mercury, Brex, Plaid, and other connected providers)</li>
              <li>Payment and payout data (via Stripe, PayPal, Lemon Squeezy)</li>
              <li>Invoice and receivables data (from your Finvio-generated invoices)</li>
              <li>E-commerce order and revenue data (via Shopify)</li>
              <li>Accounting and bookkeeping records (via QuickBooks and other integrations)</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We access only the data necessary to provide the features you use. We do not initiate payments, transfers, or other financial transactions on your behalf without your explicit instruction.
            </p>

            <h3 className="mt-5 text-base font-semibold text-navy">2.3 Usage Data</h3>
            <p className="mt-2 leading-relaxed">
              We collect information about how you interact with the Service, including pages visited, features used, workflow runs, and AI advisor queries. This data is used to improve the product and is not sold to third parties.
            </p>

            <h3 className="mt-5 text-base font-semibold text-navy">2.4 Communications</h3>
            <p className="mt-2 leading-relaxed">
              If you contact us via email or through in-app support, we retain the content of your messages and your contact information to respond to you and improve our support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">3. How We Use Your Information</h2>
            <p className="mt-3 leading-relaxed">We use the information we collect to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Provide, operate, and improve the Finvio Service</li>
              <li>Sync, categorize, and reconcile your financial transactions</li>
              <li>Generate financial reports, metrics, and AI-powered insights</li>
              <li>Send transactional emails (invoice delivery, sync notifications, account alerts)</li>
              <li>Respond to support requests and communicate about your account</li>
              <li>Detect fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We do not use your financial data to train general AI models or share it with third parties for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">4. Third-Party Integrations</h2>
            <p className="mt-3 leading-relaxed">
              Finvio integrates with the following third-party services to deliver its core functionality. Each integration requires your explicit OAuth authorization and can be revoked at any time from your Settings page.
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-hairline">
              <table className="w-full text-sm">
                <thead className="bg-off-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-navy">Provider</th>
                    <th className="px-4 py-3 text-left font-semibold text-navy">Data Accessed</th>
                    <th className="px-4 py-3 text-left font-semibold text-navy">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {[
                    ['Mercury', 'Bank transactions, balances', 'Cash flow and reconciliation'],
                    ['Brex', 'Card transactions, statements', 'Expense tracking and reconciliation'],
                    ['Stripe', 'Charges, payouts, customers', 'Revenue sync and MRR calculation'],
                    ['Shopify', 'Orders, revenue, refunds', 'E-commerce revenue tracking'],
                    ['PayPal', 'Transactions, invoices', 'Payment reconciliation'],
                    ['QuickBooks', 'Chart of accounts, transactions', 'Accounting sync'],
                    ['Lemon Squeezy', 'Subscriptions, orders', 'SaaS revenue tracking'],
                    ['Plaid', 'Bank account transactions', 'Multi-bank data aggregation'],
                    ['OpenAI / Anthropic', 'Transaction descriptions (anonymized)', 'AI categorization and advisor'],
                  ].map(([provider, data, purpose]) => (
                    <tr key={provider}>
                      <td className="px-4 py-3 font-medium text-navy">{provider}</td>
                      <td className="px-4 py-3 text-muted-ink">{data}</td>
                      <td className="px-4 py-3 text-muted-ink">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 leading-relaxed">
              When we send data to AI providers for categorization or advisory features, we transmit only the minimum necessary information (transaction descriptions and amounts). We do not transmit account numbers, full names, or other personally identifiable financial details to AI providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">5. Data Sharing and Disclosure</h2>
            <p className="mt-3 leading-relaxed">
              We do not sell your personal or financial data. We may share data in the following limited circumstances:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong className="text-navy">Service providers:</strong> Infrastructure partners (Supabase for database hosting, Vercel for application hosting) who process data on our behalf under data processing agreements.</li>
              <li><strong className="text-navy">Legal requirements:</strong> When required by applicable law, court order, or governmental authority.</li>
              <li><strong className="text-navy">Business transfers:</strong> In connection with a merger, acquisition, or sale of assets, with appropriate confidentiality obligations.</li>
              <li><strong className="text-navy">Your direction:</strong> When you explicitly authorize us to share data with a third party.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">6. Data Security</h2>
            <p className="mt-3 leading-relaxed">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>All data is encrypted in transit using TLS 1.2 or higher</li>
              <li>Data at rest is encrypted using AES-256</li>
              <li>OAuth tokens and API credentials are stored encrypted and never exposed in plaintext</li>
              <li>Access to production data is restricted to authorized personnel on a need-to-know basis</li>
              <li>Regular security reviews and dependency audits</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              No method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security. If you discover a security vulnerability, please contact us at <a href="mailto:hello@finvio.ai" className="text-brand hover:underline">hello@finvio.ai</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">7. Data Retention</h2>
            <p className="mt-3 leading-relaxed">
              We retain your account data and financial records for as long as your account is active or as needed to provide the Service. If you close your account, we will delete or anonymize your personal data within 90 days, except where we are required to retain it for legal or regulatory compliance purposes.
            </p>
            <p className="mt-3 leading-relaxed">
              You may request deletion of your account and associated data at any time by emailing <a href="mailto:hello@finvio.ai" className="text-brand hover:underline">hello@finvio.ai</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">8. Your Rights</h2>
            <p className="mt-3 leading-relaxed">Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong className="text-navy">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-navy">Correction:</strong> Request correction of inaccurate data.</li>
              <li><strong className="text-navy">Deletion:</strong> Request deletion of your data (subject to legal retention requirements).</li>
              <li><strong className="text-navy">Portability:</strong> Request your data in a machine-readable format.</li>
              <li><strong className="text-navy">Objection:</strong> Object to certain processing of your data.</li>
              <li><strong className="text-navy">Revoke integrations:</strong> Disconnect any third-party integration at any time from Settings → Connections.</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              To exercise any of these rights, email <a href="mailto:hello@finvio.ai" className="text-brand hover:underline">hello@finvio.ai</a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">9. Cookies and Tracking</h2>
            <p className="mt-3 leading-relaxed">
              Finvio uses only essential cookies required for authentication and session management. We do not use advertising cookies or third-party tracking pixels. Analytics, if used, are privacy-preserving and do not identify individual users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">10. Children&apos;s Privacy</h2>
            <p className="mt-3 leading-relaxed">
              Finvio is not intended for individuals under 18 years of age. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected such information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">11. Changes to This Policy</h2>
            <p className="mt-3 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or via an in-app notice at least 14 days before the changes take effect. Continued use of the Service after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-navy">12. Contact Us</h2>
            <p className="mt-3 leading-relaxed">
              If you have questions about this Privacy Policy or your data, please contact us:
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
