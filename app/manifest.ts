import type { MetadataRoute } from 'next'

/** Installable on phones: opens straight into the feed, in the app's own colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Umanity — Crypto giving, on proof',
    short_name: 'Umanity',
    description: 'Give from any chain. Escrowed on Solana until the delivery is filmed, verified and approved.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#f5f5f7',
    theme_color: '#f5f5f7',
    icons: [
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
