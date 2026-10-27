import { ok } from '@/lib/api'
import { getPlatformStats } from '@/lib/data/donations'
import { governanceSummary } from '@/lib/data/governance'
import { getDares } from '@/lib/data/dares'
import { CAUSES } from '@/lib/causes'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'

export const runtime = 'nodejs'

/** GET /api/platform/stats — every number here is derived from chain-synced or recorded data. */
export async function GET() {
  try {
    const [stats, gov, dares] = await Promise.all([getPlatformStats(), governanceSummary(), getDares({ status: 'open', limit: 50 })])
    return ok({
      stats: {
        ...stats,
        proposals: gov.total,
        activeProposals: gov.active,
        escrowAwaitingVote: gov.escrowAwaitingVote,
        openDares: dares.length,
        darePot: dares.reduce((s, d) => s + d.pot, 0),
        network: SOLANA_CLUSTER,
      },
    })
  } catch (e) {
    console.error('stats error', e)
    return ok({
      stats: { totalDonations: 0, totalEscrowed: 0, totalDonors: 0, totalTransactions: 0, crossChainVolume: 0, crossChainCount: 0, discreetVolume: 0, x402Calls: 0, x402Revenue: '0', pools: CAUSES.length, releasedSol: 0, deliveries: 0, causes: CAUSES.length, proposals: 0, activeProposals: 0, escrowAwaitingVote: 0, openDares: 0, darePot: 0, network: SOLANA_CLUSTER },
    })
  }
}
