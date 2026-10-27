import { ok, fail, errorMessage } from '@/lib/api'
import { getTokens, CHAIN_LABELS, intentsProvider, INTEGRATOR_FEE_BPS } from '@/lib/intents/oneclick'

export const runtime = 'nodejs'

/** GET /api/intents/tokens — supported source assets grouped by chain (NEAR Intents, mainnet). */
export async function GET() {
  try {
    const tokens = await getTokens()
    const chains: Record<string, { id: string; label: string; short: string; tokens: typeof tokens }> = {}
    for (const t of tokens) {
      const id = t.blockchain
      if (!chains[id]) chains[id] = { id, label: CHAIN_LABELS[id]?.label ?? id.toUpperCase(), short: CHAIN_LABELS[id]?.short ?? id.toUpperCase(), tokens: [] }
      chains[id].tokens.push(t)
    }
    const list = Object.values(chains).sort((a, b) => (CHAIN_LABELS[a.id]?.order ?? 99) - (CHAIN_LABELS[b.id]?.order ?? 99))
    for (const c of list) c.tokens.sort((a, b) => (['USDC', 'USDT', 'ETH', 'BTC', 'SOL', 'NEAR'].indexOf(a.symbol) + 100 || 999) - (['USDC', 'USDT', 'ETH', 'BTC', 'SOL', 'NEAR'].indexOf(b.symbol) + 100 || 999))
    return ok({ chains: list, chainCount: list.length, tokenCount: tokens.length, provider: intentsProvider(), feeBps: INTEGRATOR_FEE_BPS })
  } catch (e) {
    return fail(errorMessage(e), 502)
  }
}
