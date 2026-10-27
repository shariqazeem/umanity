'use client'

import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { SOLANA_RPC } from '@/lib/solana/constants'

import '@solana/wallet-adapter-react-ui/styles.css'

/** Wallet Standard auto-detects Phantom, Solflare, Backpack and friends; the RPC follows NEXT_PUBLIC_SOLANA_NETWORK. */
export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const wallets = useMemo(() => [], [])
  return (
    <ConnectionProvider endpoint={SOLANA_RPC} config={{ commitment: 'confirmed' }}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
