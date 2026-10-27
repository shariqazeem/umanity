import { ok, fail, errorMessage } from '@/lib/api'
import { getTransparencyReport } from '@/lib/data/transparency'
import { getPools } from '@/lib/data/donations'
import { syncPoolsFromChain } from '@/lib/solana/sync'

export const runtime = 'nodejs'

/** GET /api/transparency → TransparencyReport (lib/contracts.ts). */
export async function GET() {
  try {
    const pools = await getPools()
    if (pools.some((p) => !p.lastSyncedAt || Date.now() - new Date(p.lastSyncedAt).getTime() > 60_000)) await syncPoolsFromChain(4000)
    return ok({ report: await getTransparencyReport() })
  } catch (e) {
    return fail(errorMessage(e), 500)
  }
}
