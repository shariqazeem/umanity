import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson, errorMessage } from '@/lib/api'
import { createDare, getDares } from '@/lib/data/dares'
import { ensureUser } from '@/lib/data/users'
import { getCause } from '@/lib/causes'
import { verifyDareCreateTx } from '@/lib/solana/dare-chain'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const dares = await getDares({ status: q.get('status') || undefined, limit: Number(q.get('limit') || 20) })
  return ok({ dares })
}

/**
 * POST /api/dares { creator, targetHandle, poolId, text, hours, signature, darePda, nonce }
 * The stake is read from the on-chain dare account (not trusted from the client).
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ creator?: string; targetHandle?: string; poolId?: string; text?: string; hours?: number; signature?: string; darePda?: string; nonce?: string | number }>(req)
  if (!isPubkey(body.creator)) return fail('creator required')
  if (!body.targetHandle || !body.poolId || !getCause(body.poolId) || !body.text) return fail('targetHandle, poolId and text required')
  if (!body.signature || !body.darePda) return fail('On-chain signature and darePda required')
  try {
    const onchain = await verifyDareCreateTx(body.signature, body.darePda, body.creator)
    if (!onchain) return fail('Could not verify the dare on-chain yet', 409)
    await ensureUser(body.creator)
    const hours = Math.max(1, Math.round((onchain.deadline * 1000 - Date.now()) / 3_600_000))
    const dare = await createDare({ creatorAddress: body.creator, targetHandle: body.targetHandle, poolId: body.poolId, text: body.text.slice(0, 200), stakeLamports: onchain.stake, hours, darePda: body.darePda, createTxSignature: body.signature })
    return ok({ dare, stake: onchain.stake / LAMPORTS_PER_SOL })
  } catch (e) {
    console.error('create dare', e)
    return fail(errorMessage(e), 500)
  }
}
