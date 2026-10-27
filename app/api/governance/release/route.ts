import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage } from '@/lib/api'
import { releaseMilestoneOnChain } from '@/lib/solana/authority-ops'

export const runtime = 'nodejs'

/**
 * POST /api/governance/release { milestoneId }
 * After a fund-release proposal passed, the pool authority (server signer)
 * calls approve_milestone + release_milestone_funds on-chain. Money moves from
 * the vault PDA to the campaign recipient in one Solscan-verifiable tx.
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ milestoneId?: string }>(req)
  if (!body.milestoneId) return fail('milestoneId required')
  try {
    const r = await releaseMilestoneOnChain(body.milestoneId)
    return ok(r)
  } catch (e) {
    console.error('release error', e)
    return fail(errorMessage(e), 500)
  }
}
