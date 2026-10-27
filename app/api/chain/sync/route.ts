import { ok } from '@/lib/api'
import { syncPoolsFromChain } from '@/lib/solana/sync'
import { getPools } from '@/lib/data/donations'
import { expireDueDares } from '@/lib/data/dares'

export const runtime = 'nodejs'

/** GET /api/chain/sync — force a chain → DB sync (pools) and expire due dares. */
export async function GET() {
  const synced = await syncPoolsFromChain(8000)
  const expired = await expireDueDares().catch(() => 0)
  return ok({ synced, expiredDares: expired, pools: await getPools() })
}
