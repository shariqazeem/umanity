import type { Metadata, Viewport } from 'next'
import './globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { UmanityProvider } from '@/components/providers/UmanityProvider'
import { Toasts } from '@/components/layout/Toasts'

export const metadata: Metadata = {
  title: 'Umanity — Giving is the content',
  description: 'The social impact network on Solana. Donations escrowed on-chain, released by community vote, verified by an AI Impact Oracle, funded from any chain via NEAR Intents.',
  keywords: ['solana', 'charity', 'donations', 'social impact', 'escrow', 'near intents', 'aurora intents', 'x402', 'dao', 'web3'],
  authors: [{ name: 'Umanity' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://umanity-solana.vercel.app'),
  openGraph: {
    title: 'Umanity — Giving is the content',
    description: 'Escrowed on Solana, released by vote, verified by an AI oracle, funded from 31+ chains.',
    siteName: 'Umanity',
    type: 'website',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Umanity' }],
  },
  twitter: { card: 'summary', title: 'Umanity — Giving is the content', description: 'Escrowed on Solana, released by vote, verified by an AI oracle, funded from 31+ chains.', creator: '@umanity_xyz', images: ['/logo.png'] },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = { themeColor: '#F8F8F7', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-[#111113] bg-[#F8F8F7] overflow-x-hidden">
        <WalletProvider>
          <UmanityProvider>
            {children}
            <Toasts />
          </UmanityProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
