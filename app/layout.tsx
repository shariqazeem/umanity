import type { Metadata, Viewport } from 'next'
import './globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { UmanityProvider } from '@/components/providers/UmanityProvider'
import { Toasts } from '@/components/layout/Toasts'
import { GiveSheet } from '@/components/give/GiveSheet'
import { AuthSheet } from '@/components/auth/AuthSheet'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import { WalletSheet } from '@/components/wallet/WalletSheet'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.xyz'

export const metadata: Metadata = {
  title: { default: 'Umanity', template: '%s · Umanity' },
  description: 'Give to real people, from any chain. Held in escrow on Solana, delivered in person, proven with receipts, released by the donors.',
  keywords: ['solana', 'charity', 'donations', 'escrow', 'near intents', 'x402', 'pakistan', 'giving'],
  authors: [{ name: 'Umanity' }],
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: 'Umanity',
    description: 'Give to real people. Watch it reach them.',
    siteName: 'Umanity',
    type: 'website',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Umanity' }],
  },
  twitter: { card: 'summary', title: 'Umanity', description: 'Give to real people. Watch it reach them.', creator: '@umanity_xyz', images: ['/logo.png'] },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-[#1d1d1f] bg-[#f5f5f7] overflow-x-hidden">
        <WalletProvider>
          <UmanityProvider>
            {children}
            <GiveSheet />
            <AuthSheet />
            <ProfileEditor />
            <WalletSheet />
            <Toasts />
          </UmanityProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
