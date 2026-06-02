import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://finvio.ai'),
  title: {
    default: 'Finvio — AI CFO for Modern Founders',
    template: '%s — Finvio',
  },
  description: 'Connect your bank, Stripe, Shopify, and QuickBooks. Get real-time MRR, burn rate, runway, and P&L — all in one AI-powered dashboard.',
  openGraph: {
    type: 'website',
    siteName: 'Finvio',
    title: 'Finvio — AI CFO for Modern Founders',
    description: 'Connect your bank, Stripe, Shopify, and QuickBooks. Get real-time MRR, burn rate, runway, and P&L — all in one AI-powered dashboard.',
    url: 'https://finvio.ai',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Finvio — AI CFO for Modern Founders',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finvio — AI CFO for Modern Founders',
    description: 'Connect your bank, Stripe, Shopify, and QuickBooks. Get real-time MRR, burn rate, runway, and P&L — all in one AI-powered dashboard.',
    images: ['/og-default.png'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
