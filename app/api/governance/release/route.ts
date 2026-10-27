import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage } from '@/lib/api'
import { releaseMilestoneOnChain } from '@/lib/solana/authority-ops'
import { verifyAdminRequest } from '@/lib/admin-auth'

export const runtime = 'nodejs'

/**
 * POST /api/governance/release { milestoneId } (field-team signature required)
 * After a fund-release vote passed, the pool authority (server signer) calls
 * approve_milestone + release_milestone_funds on-chain. Money moves from the
 * vault PDA to the campaign recipient in one explorer-verifiable transaction.
 * The program refuses to release a milestone that was not approved.
 */
export async function POST(req: NextRequest) {
  const admin = verifyAdminRequest(req)
  if (!admin.ok) return fail(admin.error || 'A field-team signature is required to trigger a release', 403)
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
