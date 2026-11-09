/**
 * Community drop proposals, signed by the runner's wallet (lib/admin-auth verifyWalletRequest).
 *   GET  → the signer's proposals and their status
 *   POST { meta, goalUsd, capUsd, deadline, contact } → a proposal for the team to review
 */
import { NextResponse, type NextRequest } from 'next/server'
import { clientIp, rateLimit } from '@/lib/api'
import { verifyWalletRequest } from '@/lib/admin-auth'
import { getConnection } from '@/lib/solana/chain'
import { createProposal, myProposals, type ProposalInput } from '@/lib/umanity/community'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = verifyWalletRequest(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  return NextResponse.json({ proposals: await myProposals(auth.address!) })
}

export async function POST(req: NextRequest) {
  const auth = verifyWalletRequest(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!rateLimit(`propose:${clientIp(req)}`, 6, 3600_000)) return NextResponse.json({ error: 'Too many proposals from here; try again later' }, { status: 429 })
  try {
    const body = (await req.json()) as ProposalInput
    return NextResponse.json(await createProposal(getConnection(), auth.address!, body))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
