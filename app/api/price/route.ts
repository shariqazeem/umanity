import { ok } from '@/lib/api'

export const runtime = 'nodejs'

let cache: { usd: number; at: number } | null = null

/** GET /api/price → { usd } for SOL, cached 2 minutes server-side (CoinGecko, then Jupiter as fallback). */
export async function GET() {
  if (cache && Date.now() - cache.at < 120_000) return ok({ usd: cache.usd, cached: true })
  const sources: (() => Promise<number>)[] = [
    async () => {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
      const j = (await r.json()) as { solana?: { usd?: number } }
      if (!j.solana?.usd) throw new Error('no price')
      return j.solana.usd
    },
    async () => {
      const r = await fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
      const j = (await r.json()) as Record<string, { usdPrice?: number }>
      const p = j['So11111111111111111111111111111111111111112']?.usdPrice
      if (!p) throw new Error('no price')
      return p
    },
  ]
  for (const s of sources) {
    try {
      const usd = await s()
      cache = { usd, at: Date.now() }
      return ok({ usd, cached: false })
    } catch {
      /* next */
    }
  }
  return ok({ usd: cache?.usd ?? null, stale: true })
}
