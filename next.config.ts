import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', 'drizzle-orm'],
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false, path: false, os: false }
    return config
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
