import { CAUSE_IDS } from '@/lib/causes'
import { readPools, readCampaign } from './chain'
import { updatePoolChainState, ensurePools } from '@/lib/data/donations'
import { updateCampaignChainState } from '@/lib/data/governance'
import { derivePoolAddresses } from './pda'
import { withTimeout } from '@/lib/api'

let inflight: Promise<boolean> | null = null

/**
 * Pulls authoritative pool totals + vault balances from devnet into the DB.
 * Returns false (and leaves DB untouched) if RPC is slow or down.
 */
export async function syncPoolsFromChain(timeoutMs = 6000): Promise<boolean> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      await ensurePools(derivePoolAddresses)
      const chain = await withTimeout(readPools(CAUSE_IDS), timeoutMs, null)
      if (!chain) return false
      let any = false
      for (const id of CAUSE_IDS) {
        const p = chain[id]
        if (!p) continue
        await updatePoolChainState(id, { totalDonatedLamports: p.totalDonated, donorCount: p.donorCount, vaultBalanceLamports: p.vaultBalance })
        any = true
        if (p.hasCampaign) {
          const c = await withTimeout(readCampaign(id), timeoutMs, null)
          if (c) await updateCampaignChainState(id, { totalRaisedLamports: c.totalRaised, recipient: c.recipient, targetLamports: c.targetAmount })
        }
      }
      return any
    } catch (e) {
      console.error('pool sync failed', e)
      return false
    } finally {
      inflight = null
    }
  })()
  return inflight
}
