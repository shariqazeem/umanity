'use client'

import { useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiSend } from '@/lib/client/api'
import { donateSol } from '@/lib/client/solana'
import { addPendingGift } from '@/lib/client/pending-sync'
import type { PublicUser } from '@/lib/data/users'

export interface DonateResult {
  signature: string
  amount: number // SOL actually recorded
  points: number
  tier: string
  milestoneProposals: string[]
}

/**
 * Sign → confirm → verify on the server (vault balance delta) → points, feed,
 * certificate. The server never trusts the amount sent by the browser.
 */
export function useDonate() {
  const { signer, toast, refreshUser, refreshBalance, isMainnet } = useUmanity()
  const { connection } = useConnection()
  const [busy, setBusy] = useState(false)

  const donate = async (poolId: string, sol: number, opts: { anonymous?: boolean; dareId?: string } = {}): Promise<DonateResult | null> => {
    if (!signer) {
      toast('Sign in first', 'info')
      return null
    }
    setBusy(true)
    let signature: string | null = null
    try {
      signature = await donateSol(connection, signer, poolId, sol)
      const body = { donor: signer.publicKey.toBase58(), pool: poolId, signature, anonymous: !!opts.anonymous, dareId: opts.dareId }
      let r: { success: boolean; error?: string; rewardPoints?: number; tier?: string; donation?: { amount: number }; milestoneProposals?: string[]; user?: PublicUser }
      try {
        r = await apiSend<typeof r>('/api/donate/sync', body)
      } catch {
        r = { success: false, error: 'network' }
      }
      refreshBalance()
      refreshUser()
      if (!r.success) {
        // The gift is final on-chain; keep the record request and replay it later.
        addPendingGift(body)
        toast('Your gift is confirmed on-chain. We will finish recording it in a moment.', 'info')
        return { signature, amount: sol, points: Math.floor(sol * 1000), tier: 'bronze', milestoneProposals: [] }
      }
      return { signature, amount: r.donation?.amount ?? sol, points: r.rewardPoints ?? 0, tier: r.tier ?? 'bronze', milestoneProposals: r.milestoneProposals ?? [] }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      const low = /insufficient|0x1\b|debit an account/i.test(msg)
      toast(low ? `Not enough SOL in this wallet${isMainnet ? '' : ' (get devnet SOL from your wallet menu)'}.` : msg.includes('User rejected') ? 'Cancelled in your wallet.' : msg, 'err')
      return null
    } finally {
      setBusy(false)
    }
  }
  return { donate, busy }
}
