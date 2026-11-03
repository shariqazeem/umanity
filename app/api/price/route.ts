import { ok } from '@/lib/api'
import { getSolUsd } from '@/lib/server/price'

export const runtime = 'nodejs'

/** GET /api/price → { usd } for SOL, cached 2 minutes server-side (CoinGecko, then Jupiter as fallback). */
export async function GET() {
  return ok(await getSolUsd())
}
