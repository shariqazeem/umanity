import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', 'drizzle-orm'],
  // The share cards read their fonts and the logo from disk at request time, and
  // every server function may be the first to open the database, which applies
  // the SQL in drizzle/ (read from disk, so the tracer cannot see it).
  outputFileTracingIncludes: {
    '/**': ['./drizzle/**'],
    '/**/opengraph-image*': ['./lib/og/fonts/**', './public/logo.png'],
    '/**/twitter-image*': ['./lib/og/fonts/**', './public/logo.png'],
    '/opengraph-image': ['./lib/og/fonts/**', './public/logo.png'],
    '/twitter-image': ['./lib/og/fonts/**', './public/logo.png'],
  },
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false, path: false, os: false }
    return config
  },
  // v2.1 screens (causes, votes, the SOL ledger) gave way to drops; old links land on their v3 home.
  async redirects() {
    return [
      { source: '/transparency', destination: '/money', permanent: false },
      { source: '/govern/:path*', destination: '/money', permanent: false },
      { source: '/causes/:path*', destination: '/give', permanent: false },
      { source: '/dares/:path*', destination: '/home', permanent: false },
      { source: '/explore', destination: '/home', permanent: false },
      { source: '/blinks', destination: '/agents', permanent: false },
      { source: '/how-it-works', destination: '/?stay=1', permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: '/api/actions/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, Accept-Encoding' },
          { key: 'Access-Control-Expose-Headers', value: 'X-Action-Version, X-Blockchain-Ids' },
          { key: 'X-Action-Version', value: '2.1.3' },
        ],
      },
      {
        source: '/api/x402/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, PAYMENT-SIGNATURE, X-PAYMENT, Accept' },
          { key: 'Access-Control-Expose-Headers', value: 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE' },
        ],
      },
      {
        source: '/.well-known/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        ],
      },
    ]
  },
}

export default nextConfig
