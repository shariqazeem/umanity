import type { Metadata, Viewport } from 'next'
import './globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { UmanityProvider } from '@/components/providers/UmanityProvider'
import { Toasts } from '@/components/layout/Toasts'
import { DropGiveSheet } from '@/components/drops/DropGiveSheet'
import { AuthSheet } from '@/components/auth/AuthSheet'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import { WalletSheet } from '@/components/wallet/WalletSheet'
import { UnlockSheet } from '@/components/wallet/UnlockSheet'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.xyz'

const TAGLINE = 'Crypto giving, on camera.'
const DESCRIPTION = 'Fill a drop: a real delivery with its own USDC pot on Solana. The pot pays out only after the delivery is filmed and checked, and refunds every backer if it misses its date. Trade in the app and half of every fee fills the next drop.'

export const metadata: Metadata = {
  title: { default: `Umanity — ${TAGLINE}`, template: '%s · Umanity' },
  description: DESCRIPTION,
  applicationName: 'Umanity',
  keywords: ['solana', 'charity', 'donations', 'escrow', 'near intents', 'aurora intents', 'x402', 'ai agents', 'proof of impact', 'pakistan', 'giving'],
  authors: [{ name: 'Umanity' }],
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: `Umanity — ${TAGLINE}`,
    description: DESCRIPTION,
    siteName: 'Umanity',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: `Umanity — ${TAGLINE}`, description: DESCRIPTION, creator: '@umanity_xyz', site: '@umanity_xyz' },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = { themeColor: '#f5f5f7', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-[#1d1d1f] bg-[#f5f5f7] overflow-x-hidden">
        <WalletProvider>
          <UmanityProvider>
            {children}
            <DropGiveSheet />
            <AuthSheet />
            <ProfileEditor />
            <WalletSheet />
            <UnlockSheet />
            <Toasts />
          </UmanityProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
