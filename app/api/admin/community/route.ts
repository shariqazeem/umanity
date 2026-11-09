/**
 * The team's review queue for community drops (admin signature required).
 *   GET  → proposals and runners' proof submissions
 *   POST { type: 'proposal' | 'submission', id, action: 'approve' | 'reject', reason? }
 *     approving a proposal opens the drop on Solana with the runner as payee;
 *     approving a submission posts the proof on-chain.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { getConnection } from '@/lib/solana/chain'
import { approveProposal, postSubmission, rejectProposal, rejectSubmission, reviewQueue } from '@/lib/umanity/community'
import { syncChain } from '@/lib/umanity/indexer'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  return NextResponse.json(await reviewQueue())
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const b = (await req.json().catch(() => ({}))) as { type?: string; id?: string; action?: string; reason?: string }
  if (!b.id) return NextResponse.json({ error: 'Which one?' }, { status: 400 })
  const conn = getConnection()
  try {
    let out: unknown = { ok: true }
    if (b.type === 'proposal' && b.action === 'approve') out = await approveProposal(conn, b.id)
    else if (b.type === 'proposal' && b.action === 'reject') await rejectProposal(b.id, String(b.reason ?? ''))
    else if (b.type === 'submission' && b.action === 'approve') out = await postSubmission(conn, b.id, auth.address!)
    else if (b.type === 'submission' && b.action === 'reject') await rejectSubmission(b.id, String(b.reason ?? ''))
    else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    await syncChain(conn).catch(() => null)
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
