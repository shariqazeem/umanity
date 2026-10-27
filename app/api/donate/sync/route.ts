import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson, errorMessage } from '@/lib/api'
import { ensureUser, toPublicUser, findUser } from '@/lib/data/users'
import { recordDonation } from '@/lib/data/donations'
import { addCampaignRaised, createMilestoneProposal } from '@/lib/data/governance'
import { getDare } from '@/lib/data/dares'
import { verifyDonationTx } from '@/lib/solana/chain'
import { getCause } from '@/lib/causes'
import { syncPoolsFromChain } from '@/lib/solana/sync'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'

export const runtime = 'nodejs'

/**
 * POST /api/donate/sync { donor, pool, signature, anonymous?, dareId? }
 * The amount is NOT trusted from the client: the transaction is read back from
 * RPC and the vault's balance delta is what gets recorded. When `dareId` names
 * a dare whose target is this donor, the dare is settled on-chain as completed.
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ donor?: string; pool?: string; signature?: string; amount?: number | string; anonymous?: boolean; dareId?: string }>(req)
  if (!isPubkey(body.donor)) return fail('Valid donor address required')
  if (!body.pool || !getCause(body.pool)) return fail('Unknown pool')
  if (!body.signature || body.signature.length < 60) return fail('Transaction signature required')

  try {
    // Confirmations can lag a second or two behind the wallet's return.
    let verified = null
    for (let i = 0; i < 6 && !verified; i++) {
      verified = await verifyDonationTx(body.signature, { donor: body.donor, poolId: body.pool })
      if (!verified) await new Promise((r) => setTimeout(r, 1500))
    }
    if (!verified) return fail('Could not verify this transaction on-chain yet. Try again in a few seconds.', 409)

    await ensureUser(body.donor)
    const result = await recordDonation({ donorAddress: body.donor, poolId: body.pool, amountLamports: verified.amountLamports, signature: body.signature, route: 'solana', anonymous: !!body.anonymous })

    const milestoneProposals: string[] = []
    if (result.created) {
      const camp = await addCampaignRaised(body.pool, verified.amountLamports)
      if (camp) {
        for (const m of camp.crossed) {
          const p = await createMilestoneProposal(camp.campaign, m, body.donor)
          milestoneProposals.push(p.id)
        }
      }
      syncPoolsFromChain(5000).catch(() => {})
    }
    const user = await findUser(body.donor)

    // Accepting a dare: the target's matching gift settles the dare (pot → cause vault, 1.5% → treasury).
    let dare: { id: string; settled: boolean; signature?: string; reason?: string } | null = null
    if (body.dareId) {
      const d = await getDare(body.dareId)
      if (!d) dare = { id: body.dareId, settled: false, reason: 'Dare not found' }
      else if (d.status !== 'open') dare = { id: d.id, settled: false, reason: `Dare is ${d.status}` }
      else if (d.poolId !== body.pool) dare = { id: d.id, settled: false, reason: 'Gift went to a different cause than the dare' }
      else if (!user || user.username !== d.targetHandle) dare = { id: d.id, settled: false, reason: 'Only the dared account can complete this dare' }
      else {
        try {
          const { settleDareOnChain } = await import('@/lib/solana/authority-ops')
          const s = await settleDareOnChain(d.id, true)
          dare = { id: d.id, settled: true, signature: s.signature }
        } catch (e) {
          dare = { id: d.id, settled: false, reason: errorMessage(e) }
        }
      }
    }

    return ok({
      donation: { id: result.donation.id, amount: verified.amountLamports / LAMPORTS_PER_SOL, signature: body.signature, poolId: body.pool, anonymous: !!body.anonymous },
      rewardPoints: result.points,
      tier: result.tier,
      alreadyRecorded: !result.created,
      milestoneProposals,
      dare,
      user: user ? toPublicUser(user) : null,
    })
  } catch (e) {
    console.error('donate sync error', e)
    return fail(errorMessage(e), 500)
  }
}
