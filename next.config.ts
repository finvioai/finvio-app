import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these packages — they must be loaded as native
  // Node.js modules at runtime so their worker file paths resolve correctly.
  serverExternalPackages: ['pdfjs-dist', 'pdf-parse'],
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;
