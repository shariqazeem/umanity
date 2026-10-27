import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson, errorMessage } from '@/lib/api'
import { castVote } from '@/lib/data/governance'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await readJson<{ proposalId?: string; voterAddress?: string; voteOption?: number }>(req)
  if (!body.proposalId || !isPubkey(body.voterAddress) || typeof body.voteOption !== 'number') return fail('proposalId, voterAddress and voteOption required')
  try {
    const r = await castVote(body.proposalId, body.voterAddress, body.voteOption)
    return ok({ voteWeight: r.weight })
  } catch (e) {
    return fail(errorMessage(e))
  }
}
