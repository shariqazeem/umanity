import type { Metadata, Viewport } from 'next'
import { Anek_Latin, Martian_Mono } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { UmanityProvider } from '@/components/providers/UmanityProvider'
import { Toasts } from '@/components/layout/Toasts'
import { DropGiveSheet } from '@/components/drops/DropGiveSheet'
import { FundGiveSheet } from '@/components/drops/FundGiveSheet'
import { AuthSheet } from '@/components/auth/AuthSheet'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import { WalletSheet } from '@/components/wallet/WalletSheet'
import { UnlockSheet } from '@/components/wallet/UnlockSheet'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.xyz'

// The Tally's type: Anek Latin for words (it also has Devanagari, Bangla, Tamil and six more scripts in
// the same design) and Martian Mono for records. Both OFL, self-hosted by next/font.
const anek = Anek_Latin({ subsets: ['latin', 'latin-ext'], weight: 'variable', variable: '--font-anek', display: 'swap' })
const martian = Martian_Mono({ subsets: ['latin', 'latin-ext'], weight: 'variable', variable: '--font-martian', display: 'swap' })

const TAGLINE = 'Nothing given in the dark.'
const DESCRIPTION = 'Giving with proof, on Solana. Every gift waits in the open until the delivery is filmed, or it goes home. The first hundred givers each hold a Circle, drawn by their own gift.'

export const metadata: Metadata = {
  title: { default: `Umanity — ${TAGLINE}`, template: '%s · Umanity' },
  description: DESCRIPTION,
  applicationName: 'Umanity',
  keywords: ['solana', 'usdc', 'giving', 'filmed delivery', 'refunds', 'x402', 'ai agents', 'aurora intents', 'near intents', 'jupiter'],
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

export const viewport: Viewport = { themeColor: '#D9E1E2', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anek.variable} ${martian.variable}`}>
      <body className="text-[#111111] bg-[#D9E1E2] overflow-x-hidden">
        <WalletProvider>
          <UmanityProvider>
            {children}
            <DropGiveSheet />
            <FundGiveSheet />
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
