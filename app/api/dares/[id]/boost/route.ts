import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson, errorMessage } from '@/lib/api'
import { boostDare, getDare } from '@/lib/data/dares'
import { ensureUser } from '@/lib/data/users'
import { verifyTransfer } from '@/lib/solana/chain'
import { findDareVaultPDA } from '@/lib/solana/pda'
import { PublicKey } from '@solana/web3.js'
import { createPost } from '@/lib/data/social'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'

export const runtime = 'nodejs'

/** POST /api/dares/[id]/boost { backer, signature } — amount is read from the vault's balance delta. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJson<{ backer?: string; signature?: string }>(req)
  if (!isPubkey(body.backer) || !body.signature) return fail('backer and signature required')
  const dare = await getDare(id)
  if (!dare || !dare.darePda) return fail('Dare not found', 404)
  try {
    const [vault] = findDareVaultPDA(new PublicKey(dare.darePda))
    let v = null
    for (let i = 0; i < 6 && !v; i++) {
      v = await verifyTransfer(body.signature, vault.toBase58(), 1)
      if (!v) await new Promise((r) => setTimeout(r, 1500))
    }
    if (!v) return fail('Could not verify the boost on-chain yet', 409)
    await ensureUser(body.backer)
    const updated = await boostDare(id, body.backer, v.lamports, body.signature)
    await createPost(body.backer, `Boosted the pot on a dare for @${dare.targetHandle} with ${(v.lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL → ${dare.poolEmoji} ${dare.poolName}.`, 'dare_accepted', { dareId: id, amount: String(v.lamports / LAMPORTS_PER_SOL) }, body.signature).catch(() => {})
    return ok({ dare: updated, amount: v.lamports / LAMPORTS_PER_SOL })
  } catch (e) {
    return fail(errorMessage(e), 500)
  }
}
