import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb, newId, campaigns, milestones, proposals, votes, users, type Campaign, type Milestone, type Proposal, type MilestoneEvidence, type OracleAttestation } from '@/lib/db'
import { LAMPORTS_PER_SOL, UMANITY_ORG_WALLET } from '@/lib/solana/constants'
import { CAUSES } from '@/lib/causes'
import { findUser } from './users'
import { createPost } from './social'

export const MIN_POINTS_TO_PROPOSE = 100

// ---------- Campaigns & milestones ----------
export interface CampaignView {
  id: string
  pool_id: string
  poolName: string
  recipient: string
  target_amount: number // SOL
  total_raised: number // SOL
  deadline: string
  campaignPda: string | null
  is_active: boolean
  created_at: string
  milestones: MilestoneView[]
}

export interface MilestoneView {
  id: string
  campaign_id: string
  index: number
  description: string
  percentage: number
  status: string
  proposalId: string | null
  milestonePda: string | null
  evidence: MilestoneEvidence | null
  attestation: OracleAttestation | null
  releaseTxSignature: string | null
  amount: number // SOL this milestone would release at current raised
}

export function toMilestoneView(m: Milestone, campaignRaisedLamports: number): MilestoneView {
  return {
    id: m.id,
    campaign_id: m.campaignId,
    index: m.index,
    description: m.description,
    percentage: m.percentage,
    status: m.status,
    proposalId: m.proposalId ?? null,
    milestonePda: m.milestonePda ?? null,
    evidence: m.evidence ?? null,
    attestation: m.attestation ?? null,
    releaseTxSignature: m.releaseTxSignature ?? null,
    amount: (campaignRaisedLamports * m.percentage) / 100 / LAMPORTS_PER_SOL,
  }
}

export async function getCampaigns(): Promise<CampaignView[]> {
  const db = await getDb()
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt))
  const ms = await db.select().from(milestones).orderBy(milestones.index)
  return rows.map((c) => ({
    id: c.id,
    pool_id: c.poolId,
    poolName: CAUSES.find((x) => x.id === c.poolId)?.name ?? c.poolId,
    recipient: c.recipient,
    target_amount: c.targetLamports / LAMPORTS_PER_SOL,
    total_raised: c.totalRaisedLamports / LAMPORTS_PER_SOL,
    deadline: c.deadline.toISOString(),
    campaignPda: c.campaignPda ?? null,
    is_active: c.isActive,
    created_at: c.createdAt.toISOString(),
    milestones: ms.filter((m) => m.campaignId === c.id).map((m) => toMilestoneView(m, c.totalRaisedLamports)),
  }))
}

export async function getCampaignByPool(poolId: string): Promise<CampaignView | null> {
  const all = await getCampaigns()
  return all.find((c) => c.pool_id === poolId) ?? null
}

export async function getMilestone(id: string): Promise<(MilestoneView & { campaign: Campaign }) | null> {
  const db = await getDb()
  const rows = await db.select().from(milestones).where(eq(milestones.id, id)).limit(1)
  if (!rows[0]) return null
  const c = await db.select().from(campaigns).where(eq(campaigns.id, rows[0].campaignId)).limit(1)
  if (!c[0]) return null
  return { ...toMilestoneView(rows[0], c[0].totalRaisedLamports), campaign: c[0] }
}

export async function upsertCampaign(input: {
  poolId: string
  recipient?: string
  targetLamports: number
  deadline: Date
  campaignPda?: string
  createTxSignature?: string
  milestones: { description: string; percentage: number; milestonePda?: string }[]
}): Promise<CampaignView> {
  const db = await getDb()
  const existing = await db.select().from(campaigns).where(eq(campaigns.poolId, input.poolId)).limit(1)
  let campaign: Campaign
  if (existing[0]) {
    const rows = await db
      .update(campaigns)
      .set({ recipient: input.recipient ?? existing[0].recipient, targetLamports: input.targetLamports, deadline: input.deadline, campaignPda: input.campaignPda ?? existing[0].campaignPda, createTxSignature: input.createTxSignature ?? existing[0].createTxSignature })
      .where(eq(campaigns.id, existing[0].id))
      .returning()
    campaign = rows[0]
  } else {
    const rows = await db
      .insert(campaigns)
      .values({ id: newId('cmp'), poolId: input.poolId, recipient: input.recipient ?? UMANITY_ORG_WALLET, targetLamports: input.targetLamports, deadline: input.deadline, campaignPda: input.campaignPda ?? null, createTxSignature: input.createTxSignature ?? null })
      .returning()
    campaign = rows[0]
  }
  const ms = await db.select().from(milestones).where(eq(milestones.campaignId, campaign.id))
  for (let i = 0; i < input.milestones.length; i++) {
    const m = input.milestones[i]
    const found = ms.find((x) => x.index === i)
    if (found) {
      await db.update(milestones).set({ description: m.description, percentage: m.percentage, milestonePda: m.milestonePda ?? found.milestonePda }).where(eq(milestones.id, found.id))
    } else {
      await db.insert(milestones).values({ id: newId('ms'), campaignId: campaign.id, index: i, description: m.description, percentage: m.percentage, milestonePda: m.milestonePda ?? null })
    }
  }
  return (await getCampaignByPool(input.poolId))!
}

/** Authoritative numbers from the on-chain Campaign account. */
export async function updateCampaignChainState(poolId: string, state: { totalRaisedLamports: number; recipient?: string; targetLamports?: number }) {
  const db = await getDb()
  const patch: Partial<typeof campaigns.$inferInsert> = { totalRaisedLamports: state.totalRaisedLamports }
  if (state.recipient) patch.recipient = state.recipient
  if (state.targetLamports) patch.targetLamports = state.targetLamports
  await db.update(campaigns).set(patch).where(eq(campaigns.poolId, poolId))
}

export async function addCampaignRaised(poolId: string, lamports: number): Promise<{ campaign: Campaign; crossed: Milestone[] } | null> {
  const db = await getDb()
  const existing = await db.select().from(campaigns).where(eq(campaigns.poolId, poolId)).limit(1)
  if (!existing[0]) return null
  const prev = existing[0].totalRaisedLamports
  const next = prev + lamports
  const rows = await db.update(campaigns).set({ totalRaisedLamports: next }).where(eq(campaigns.id, existing[0].id)).returning()
  const ms = await db.select().from(milestones).where(eq(milestones.campaignId, existing[0].id)).orderBy(milestones.index)
  let cumulative = 0
  const crossed: Milestone[] = []
  for (const m of ms) {
    cumulative += m.percentage
    const threshold = (cumulative / 100) * existing[0].targetLamports
    if (prev < threshold && next >= threshold && m.status === 'pending') crossed.push(m)
  }
  return { campaign: rows[0], crossed }
}

export async function setMilestoneStatus(id: string, status: string, patch: Partial<{ proposalId: string; releaseTxSignature: string; milestonePda: string }> = {}) {
  const db = await getDb()
  await db.update(milestones).set({ status, ...patch }).where(eq(milestones.id, id))
}

export async function setMilestoneEvidence(id: string, evidence: MilestoneEvidence) {
  const db = await getDb()
  await db.update(milestones).set({ evidence }).where(eq(milestones.id, id))
}

export async function setMilestoneAttestation(id: string, attestation: OracleAttestation) {
  const db = await getDb()
  await db.update(milestones).set({ attestation }).where(eq(milestones.id, id))
}

// ---------- Proposals ----------
export interface ProposalResult {
  option: string
  index: number
  voteCount: number
  totalWeight: number
  percentage: number
}

export interface ProposalView {
  id: string
  creator_address: string
  title: string
  description: string
  options: string[]
  status: string
  proposal_type: string
  campaign_id: string | null
  milestone_index: number | null
  created_at: string
  closes_at: string
  total_votes: number
  results: ProposalResult[]
  totalVoters: number
  totalWeight: number
  recipient: { pool_id: string; address: string } | null
  milestone: MilestoneView | null
  poolName: string | null
  escrowAmount: number // SOL that this vote would release
  result: Proposal['result']
}

export async function getProposalResults(proposalId: string, p?: Proposal): Promise<{ results: ProposalResult[]; totalVoters: number; totalWeight: number }> {
  const db = await getDb()
  const prop = p ?? (await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1))[0]
  if (!prop) throw new Error('Proposal not found')
  const vs = await db.select().from(votes).where(eq(votes.proposalId, proposalId))
  const opts = prop.options
  const results = opts.map((option, index) => {
    const ov = vs.filter((v) => v.option === index)
    return { option, index, voteCount: ov.length, totalWeight: ov.reduce((s, v) => s + v.weight, 0), percentage: 0 }
  })
  const totalWeight = results.reduce((s, r) => s + r.totalWeight, 0)
  return { results: results.map((r) => ({ ...r, percentage: totalWeight > 0 ? (r.totalWeight / totalWeight) * 100 : 0 })), totalVoters: vs.length, totalWeight }
}

export async function getProposals(filter?: { status?: string }): Promise<ProposalView[]> {
  const db = await getDb()
  const rows = await db.select().from(proposals).where(filter?.status ? eq(proposals.status, filter.status) : undefined).orderBy(desc(proposals.createdAt))
  const cs = await db.select().from(campaigns)
  const ms = await db.select().from(milestones)
  const out: ProposalView[] = []
  for (const p of rows) {
    const r = await getProposalResults(p.id, p)
    const c = p.campaignId ? cs.find((x) => x.id === p.campaignId) : undefined
    const m = c && p.milestoneIndex != null ? ms.find((x) => x.campaignId === c.id && x.index === p.milestoneIndex) : undefined
    out.push({
      id: p.id,
      creator_address: p.creatorAddress,
      title: p.title,
      description: p.description,
      options: p.options,
      status: p.status,
      proposal_type: p.type,
      campaign_id: p.campaignId ?? null,
      milestone_index: p.milestoneIndex ?? null,
      created_at: p.createdAt.toISOString(),
      closes_at: p.closesAt.toISOString(),
      total_votes: r.totalVoters,
      results: r.results,
      totalVoters: r.totalVoters,
      totalWeight: r.totalWeight,
      recipient: c ? { pool_id: c.poolId, address: c.recipient } : null,
      milestone: m && c ? toMilestoneView(m, c.totalRaisedLamports) : null,
      poolName: c ? CAUSES.find((x) => x.id === c.poolId)?.name ?? c.poolId : null,
      escrowAmount: m && c ? (c.totalRaisedLamports * m.percentage) / 100 / LAMPORTS_PER_SOL : 0,
      result: p.result ?? null,
    })
  }
  return out
}

export async function createProposal(input: { creatorAddress: string; title: string; description: string; options: string[]; durationHours?: number; type?: string; campaignId?: string; milestoneIndex?: number; requirePoints?: boolean }): Promise<Proposal> {
  const db = await getDb()
  if (input.requirePoints !== false) {
    const u = await findUser(input.creatorAddress)
    if (!u || u.rewardPoints < MIN_POINTS_TO_PROPOSE) throw new Error(`You need at least ${MIN_POINTS_TO_PROPOSE} impact points to create a proposal`)
  }
  const rows = await db
    .insert(proposals)
    .values({
      id: newId('prop'),
      type: input.type ?? 'general',
      title: input.title,
      description: input.description,
      options: input.options,
      campaignId: input.campaignId ?? null,
      milestoneIndex: input.milestoneIndex ?? null,
      creatorAddress: input.creatorAddress,
      closesAt: new Date(Date.now() + (input.durationHours ?? 72) * 3_600_000),
    })
    .returning()
  return rows[0]
}

/** Auto-created when a milestone threshold is crossed (or by the seed script). */
export async function createMilestoneProposal(campaign: Campaign, milestone: Milestone, authority: string, durationHours = 72): Promise<Proposal> {
  const db = await getDb()
  const poolName = CAUSES.find((c) => c.id === campaign.poolId)?.name ?? campaign.poolId
  const p = await createProposal({
    creatorAddress: authority,
    title: `Release milestone ${milestone.index + 1}: ${poolName}`,
    description: `Release ${milestone.percentage}% of the funds raised from the ${poolName} escrow vault for: "${milestone.description}". Funds go to the campaign recipient for delivery; proof is audited by the AI Impact Oracle and posted publicly.`,
    options: ['Approve & release escrow', 'Reject & keep locked'],
    durationHours,
    type: 'fund_release',
    campaignId: campaign.id,
    milestoneIndex: milestone.index,
    requirePoints: false,
  })
  await db.update(milestones).set({ status: 'voting', proposalId: p.id }).where(eq(milestones.id, milestone.id))
  return p
}

export async function castVote(proposalId: string, voterAddress: string, option: number): Promise<{ weight: number }> {
  const db = await getDb()
  const u = await findUser(voterAddress)
  if (!u) throw new Error('Connect a wallet and donate to earn voting power')
  const weight = Math.max(1, u.rewardPoints)
  const p = (await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1))[0]
  if (!p) throw new Error('Proposal not found')
  if (p.status !== 'active') throw new Error('This proposal is no longer active')
  if (p.closesAt < new Date()) throw new Error('Voting has ended')
  const inserted = await db.insert(votes).values({ proposalId, voterAddress, option, weight }).onConflictDoNothing().returning()
  if (!inserted.length) throw new Error('You already voted on this proposal')
  await db.update(users).set({ rewardPoints: sql`${users.rewardPoints} + 5` }).where(eq(users.address, voterAddress))
  try {
    await createPost(voterAddress, `Voted "${p.options[option]}" on: ${p.title}`, 'vote', { proposalId })
  } catch {
    /* non-blocking */
  }
  return { weight }
}

export async function hasVoted(proposalId: string, voterAddress: string): Promise<number | null> {
  const db = await getDb()
  const rows = await db.select().from(votes).where(and(eq(votes.proposalId, proposalId), eq(votes.voterAddress, voterAddress))).limit(1)
  return rows[0] ? rows[0].option : null
}

/** Tally after close. For fund_release proposals, marks the milestone approved (ready for on-chain release). */
export async function executeProposal(proposalId: string, opts: { force?: boolean } = {}): Promise<{ approved: boolean; yesWeight: number; noWeight: number; totalVoters: number; milestoneAction: 'approved' | 'rejected' | null; message: string }> {
  const db = await getDb()
  const p = (await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1))[0]
  if (!p) throw new Error('Proposal not found')
  if (p.status === 'executed') throw new Error('Proposal already executed')
  if (p.closesAt > new Date() && !opts.force) throw new Error('Voting period has not ended yet')
  const r = await getProposalResults(proposalId, p)
  const yes = r.results[0]?.totalWeight ?? 0
  const no = r.results[1]?.totalWeight ?? 0
  const approved = yes > no
  await db.update(proposals).set({ status: 'executed', executedAt: new Date(), result: { approved, yesWeight: yes, noWeight: no } }).where(eq(proposals.id, proposalId))
  let milestoneAction: 'approved' | 'rejected' | null = null
  if (p.type === 'fund_release' && p.campaignId && p.milestoneIndex != null) {
    const m = (await db.select().from(milestones).where(and(eq(milestones.campaignId, p.campaignId), eq(milestones.index, p.milestoneIndex))).limit(1))[0]
    if (m) {
      await db.update(milestones).set({ status: approved ? 'approved' : 'pending', proposalId: approved ? proposalId : null }).where(eq(milestones.id, m.id))
      milestoneAction = approved ? 'approved' : 'rejected'
    }
  }
  return {
    approved,
    yesWeight: yes,
    noWeight: no,
    totalVoters: r.totalVoters,
    milestoneAction,
    message: approved ? (p.type === 'fund_release' ? 'Approved. The milestone is cleared for on-chain release from escrow.' : 'Proposal passed.') : 'Rejected. Funds stay locked in escrow.',
  }
}

export async function votingPower(address: string): Promise<number> {
  const u = await findUser(address)
  return u ? Math.max(0, u.rewardPoints) : 0
}

export async function governanceSummary() {
  const db = await getDb()
  const [active] = await db.select({ n: sql<number>`count(*)::int` }).from(proposals).where(eq(proposals.status, 'active'))
  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(proposals)
  const [executed] = await db.select({ n: sql<number>`count(*)::int` }).from(proposals).where(eq(proposals.status, 'executed'))
  const ps = await getProposals({ status: 'active' })
  const awaiting = ps.reduce((s, p) => s + p.escrowAmount, 0)
  return { active: active?.n ?? 0, total: total?.n ?? 0, executed: executed?.n ?? 0, escrowAwaitingVote: awaiting }
}
