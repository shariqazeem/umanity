import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage } from '@/lib/api'
import { settleDareOnChain } from '@/lib/solana/authority-ops'

export const runtime = 'nodejs'

/**
 * POST /api/dares/[id]/settle { completed: boolean, proofPostId? }
 * completed=true: the oracle/authority confirms the target acted (server checks a
 * matching donation from the target when they have a wallet on file).
 * completed=false: anyone after the deadline. Pot → cause vault, 1.5% → treasury.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJson<{ completed?: boolean; proofPostId?: string }>(req)
  try {
    const r = await settleDareOnChain(id, !!body.completed, body.proofPostId)
    return ok(r)
  } catch (e) {
    return fail(errorMessage(e), 400)
  }
}
