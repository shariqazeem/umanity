import { ok } from '@/lib/api'
import { getCauseList } from '@/lib/data/causes'
import { getPools, ensurePools } from '@/lib/data/donations'
import { derivePoolAddresses } from '@/lib/solana/pda'
import { syncPoolsFromChain } from '@/lib/solana/sync'

export const runtime = 'nodejs'

/** GET /api/causes — every cause with its campaign, supporter count, latest delivery and next milestone. */
export async function GET() {
  let pools = await getPools()
  if (pools.length === 0) {
    await ensurePools(derivePoolAddresses)
    pools = await getPools()
  }
  const stale = pools.some((p) => !p.lastSyncedAt || Date.now() - new Date(p.lastSyncedAt).getTime() > 60_000)
  if (stale) await syncPoolsFromChain(4000)
  return ok({ causes: await getCauseList() })
}
