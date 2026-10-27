import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage } from '@/lib/api'
import { executeProposal } from '@/lib/data/governance'

export const runtime = 'nodejs'

/** POST /api/governance/execute { proposalId } — tally after the voting window. */
export async function POST(req: NextRequest) {
  const body = await readJson<{ proposalId?: string }>(req)
  if (!body.proposalId) return fail('proposalId required')
  try {
    return ok(await executeProposal(body.proposalId))
  } catch (e) {
    return fail(errorMessage(e))
  }
}
