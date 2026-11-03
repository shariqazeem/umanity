/**
 * "Follow your gift": everything that happened to one donation, from the wallet
 * to the hand-over. Every step carries the record that proves it (a Solana
 * transaction, a vault address, a delivery with its photos, the oracle's
 * verdict, the vote, the release transaction).
 */
import { eq, or } from 'drizzle-orm'
import { getDb, donations, intents } from '@/lib/db'
import { getCause, milestoneWhat } from '@/lib/causes'
import { findUser } from './users'
import { getCampaignByPool } from './governance'
import { getFieldUpdates } from './field'
import { derivePoolAddresses } from '@/lib/solana/pda'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'
import type { FieldUpdateView } from '@/lib/contracts'

export type StepState = 'done' | 'active' | 'waiting'

export interface JourneyStep {
  key: 'given' | 'escrowed' | 'delivery' | 'verified' | 'voted' | 'released'
  state: StepState
  title: string
  detail: string
  at?: string | null
  tx?: string | null
  /** Transaction on another chain or explorer (cross-chain gifts). */
  link?: { label: string; href: string } | null
}

export interface GiftJourney {
  id: string
  signature: string
  settlementSignature: string | null
  createdAt: string
  amountSol: number
  route: string
  sourceChain: string | null
  sourceAsset: string | null
  sourceAmount: string | null
  donor: { username: string | null; address: string | null; anonymous: boolean }
  cause: { id: string; name: string; emoji: string; location: string }
  vault: string
  /** The milestone this gift is funding (the first one not released when it arrived, or now). */
  milestone: { index: number; description: string; percentage: number; thresholdSol: number; raisedSol: number; status: string } | null
  delivery: FieldUpdateView | null
  steps: JourneyStep[]
  /** 0..5, how many steps are done. */
  progress: number
}

export async function getGiftJourney(ref: string, viewer?: string | null): Promise<GiftJourney | null> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(donations)
    .where(or(eq(donations.id, ref), eq(donations.signature, ref), eq(donations.settlementSignature, ref)))
    .limit(1)
  const d = rows[0]
  if (!d) return null
  const cause = getCause(d.poolId)
  if (!cause) return null

  const hide = d.anonymous && viewer !== d.donorAddress
  const donor = hide ? null : await findUser(d.donorAddress)
  const intent = d.intentId ? (await db.select().from(intents).where(eq(intents.id, d.intentId)).limit(1))[0] : undefined
  const campaign = await getCampaignByPool(d.poolId)
  const { vaultPda } = derivePoolAddresses(d.poolId)

  // The milestone this gift funds: the first one in the plan that has not been released yet.
  let milestone: GiftJourney['milestone'] = null
  if (campaign) {
    let cumulative = 0
    for (const m of [...campaign.milestones].sort((a, b) => a.index - b.index)) {
      cumulative += m.percentage
      if (m.status !== 'released') {
        milestone = { index: m.index, description: m.description, percentage: m.percentage, thresholdSol: (campaign.target_amount * cumulative) / 100, raisedSol: campaign.total_raised, status: m.status }
        break
      }
    }
  }

  // The first delivery posted for this cause after the gift arrived is the one it helped pay for.
  const updates = await getFieldUpdates({ poolId: d.poolId, limit: 50 })
  const after = updates.filter((u) => new Date(u.createdAt) >= d.createdAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const delivery = after[0] ?? null
  const att = delivery?.attestation ?? null
  const proposal = delivery?.proposal ?? null
  const released = delivery?.releaseTxSignature ?? delivery?.milestone?.releaseTxSignature ?? null
  const voteOpen = !!proposal && proposal.status === 'active' && new Date(proposal.closes_at) > new Date()

  const amountSol = d.amountLamports / LAMPORTS_PER_SOL
  const viaLabel =
    d.route === 'intents'
      ? `${d.sourceAmount ?? ''} ${d.sourceAsset ?? ''} from ${d.sourceChain ?? 'another chain'}, swapped by NEAR Intents solvers`
      : d.route === 'x402'
        ? `$${d.sourceAmount ?? ''} USDC paid by an agent over x402`
        : d.route === 'blink'
          ? 'From a Solana Blink'
          : 'From a Solana wallet'

  const steps: JourneyStep[] = [
    {
      key: 'given',
      state: 'done',
      title: 'Given',
      detail: viaLabel.trim(),
      at: d.createdAt.toISOString(),
      tx: d.route === 'solana' || d.route === 'blink' ? d.signature : d.settlementSignature,
      link: intent?.depositAddress ? { label: 'NEAR Intents explorer', href: `https://explorer.near-intents.org/transactions/${intent.depositAddress}` } : null,
    },
    {
      key: 'escrowed',
      state: 'done',
      title: 'Locked in escrow',
      detail: `${amountSol.toFixed(amountSol < 0.1 ? 4 : 3)} SOL sits in the ${cause.name.toLowerCase()} vault. The program only lets it out as an approved milestone release or a refund.`,
      at: d.createdAt.toISOString(),
      tx: d.signature.startsWith('x402_') || d.signature.startsWith('intent_') ? null : d.signature,
    },
    {
      key: 'delivery',
      state: delivery ? 'done' : 'active',
      title: delivery ? 'Delivered by hand' : 'Funding the next delivery',
      detail: delivery
        ? `${delivery.title}${delivery.location ? ` · ${delivery.location}` : ''}`
        : milestone
          ? `Delivery #${milestone.index + 1}: ${milestoneWhat(milestone.description)}. ${milestone.raisedSol.toFixed(2)} of ${milestone.thresholdSol.toFixed(2)} SOL raised.`
          : 'The field team buys, delivers and films it, then posts the receipts.',
      at: delivery?.deliveredAt ?? delivery?.createdAt ?? null,
    },
    {
      key: 'verified',
      state: att ? 'done' : delivery ? 'active' : 'waiting',
      title: att ? `Audited · ${att.verdict} ${att.confidence}/100` : 'AI audit',
      detail: att ? att.summary : 'The Impact Oracle checks the photos and receipts; its verdict hash is written on-chain.',
      at: att?.issuedAt ?? null,
    },
    {
      key: 'voted',
      state: proposal && proposal.status !== 'active' ? 'done' : voteOpen ? 'active' : 'waiting',
      title: proposal ? (proposal.status === 'active' ? 'Donors are voting' : proposal.result?.approved ? 'Donors approved' : 'Vote closed') : 'Donor vote',
      detail: proposal ? `${proposal.totalVoters} ${proposal.totalVoters === 1 ? 'donor' : 'donors'} voted on releasing this milestone. You can vote too.` : "Only this cause's donors decide whether the proof is good enough.",
      at: proposal?.created_at ?? null,
    },
    {
      key: 'released',
      state: released ? 'done' : 'waiting',
      title: released ? 'Released on-chain' : 'Release',
      detail: released ? 'release_milestone_funds moved this milestone out of escrow to the field team.' : 'Only after a yes does the program let this money move.',
      tx: released,
    },
  ]

  return {
    id: d.id,
    signature: d.signature,
    settlementSignature: d.settlementSignature ?? null,
    createdAt: d.createdAt.toISOString(),
    amountSol,
    route: d.route,
    sourceChain: d.sourceChain,
    sourceAsset: d.sourceAsset,
    sourceAmount: d.sourceAmount,
    donor: { username: donor?.username ?? null, address: hide ? null : d.donorAddress, anonymous: d.anonymous },
    cause: { id: cause.id, name: cause.name, emoji: cause.emoji, location: cause.location },
    vault: vaultPda,
    milestone,
    delivery,
    steps,
    progress: steps.filter((s) => s.state === 'done').length,
  }
}
