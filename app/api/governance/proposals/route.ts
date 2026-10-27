import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson, errorMessage } from '@/lib/api'
import { createProposal, getProposals, hasVoted, votingPower, governanceSummary } from '@/lib/data/governance'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const voter = q.get('voter')
  try {
    const proposals = await getProposals(q.get('status') ? { status: q.get('status')! } : undefined)
    let myVotes: Record<string, number | null> = {}
    if (voter && isPubkey(voter)) {
      const entries = await Promise.all(proposals.map(async (p) => [p.id, await hasVoted(p.id, voter)] as const))
      myVotes = Object.fromEntries(entries)
    }
    const summary = await governanceSummary()
    const power = voter && isPubkey(voter) ? await votingPower(voter) : 0
    return ok({ proposals, myVotes, summary, votingPower: power })
  } catch (e) {
    console.error('proposals', e)
    return ok({ proposals: [], myVotes: {}, summary: { active: 0, total: 0, executed: 0, escrowAwaitingVote: 0 }, votingPower: 0 })
  }
}

export async function POST(req: NextRequest) {
  const body = await readJson<{ creatorAddress?: string; title?: string; description?: string; options?: string[]; durationHours?: number }>(req)
  if (!isPubkey(body.creatorAddress) || !body.title || !body.description || !Array.isArray(body.options) || body.options.length < 2) {
    return fail('creatorAddress, title, description and at least 2 options required')
  }
  try {
    const p = await createProposal({ creatorAddress: body.creatorAddress, title: body.title.slice(0, 120), description: body.description.slice(0, 2000), options: body.options.slice(0, 4).map((o) => String(o).slice(0, 80)), durationHours: body.durationHours })
    return ok({ proposal: p })
  } catch (e) {
    return fail(errorMessage(e))
  }
}
