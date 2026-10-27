import { ok } from '@/lib/api'
import { getPools, ensurePools } from '@/lib/data/donations'
import { derivePoolAddresses } from '@/lib/solana/pda'
import { syncPoolsFromChain } from '@/lib/solana/sync'

export const runtime = 'nodejs'

/** GET /api/pools — the six causes with chain-synced escrow numbers. */
export async function GET() {
  let pools = await getPools()
  if (pools.length === 0) {
    await ensurePools(derivePoolAddresses)
    pools = await getPools()
  }
  // Refresh from chain at most every 60s (non-blocking for the response).
  const stale = pools.some((p) => !p.lastSyncedAt || Date.now() - new Date(p.lastSyncedAt).getTime() > 60_000)
  if (stale) {
    const synced = await syncPoolsFromChain(4000)
    if (synced) pools = await getPools()
  }
  return ok({
    pools,
    totalDonations: pools.reduce((s, p) => s + p.totalDonated, 0),
    totalEscrowed: pools.reduce((s, p) => s + p.vaultBalance, 0),
    totalDonors: pools.reduce((s, p) => s + p.donorCount, 0),
  })
}
