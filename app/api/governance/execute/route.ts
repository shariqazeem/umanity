import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage } from '@/lib/api'
import { executeProposal } from '@/lib/data/governance'
import { verifyAdminRequest } from '@/lib/admin-auth'

export const runtime = 'nodejs'

/**
 * POST /api/governance/execute { proposalId, force? }
 * Tallies a vote after its window closes. `force: true` closes an open vote
 * early and is honoured only with a valid field-team signature (admin headers).
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ proposalId?: string; force?: boolean }>(req)
  if (!body.proposalId) return fail('proposalId required')
  let force = false
  if (body.force) {
    const admin = verifyAdminRequest(req)
    if (!admin.ok) return fail(admin.error || 'Closing a vote early needs a field-team signature', 403)
    force = true
  }
  try {
    return ok(await executeProposal(body.proposalId, { force }))
  } catch (e) {
    return fail(errorMessage(e))
  }
}
