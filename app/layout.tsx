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

const TAGLINE = 'Crypto giving, on proof.'
const DESCRIPTION = 'Give from any chain, or from an AI agent over x402. Every gift waits in on-chain escrow on Solana until the field team delivers it by hand, films it, and the donors vote to release it.'

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
