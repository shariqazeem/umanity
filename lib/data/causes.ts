/**
 * Cause list and cause page aggregates (lib/contracts.ts: CauseListItem, CauseDetail).
 */
import { desc, eq, sql } from 'drizzle-orm'
import { getDb, posts, dares } from '@/lib/db'
import { getPools, getPool, getGiftsForPool, getSupporters, type PoolView } from './donations'
import { getCampaigns, getProposals, type CampaignView } from './governance'
import { getFieldUpdates } from './field'
import { hydratePosts, followingWhoDonated } from './social'
import { toDareViews } from './dares'
import type { CauseDetail, CauseListItem, FieldUpdateView } from '@/lib/contracts'

function releasedSol(p: PoolView) {
  return Math.max(0, p.totalDonated - p.vaultBalance)
}

export function nextMilestoneFor(campaign: CampaignView | null): CauseListItem['nextMilestone'] {
  if (!campaign) return null
  let cumulative = 0
  for (const m of [...campaign.milestones].sort((a, b) => a.index - b.index)) {
    cumulative += m.percentage
    if (m.status !== 'released') {
      return { index: m.index, description: m.description, percentage: m.percentage, thresholdSol: (cumulative / 100) * campaign.target_amount, status: m.status }
    }
  }
  return null
}

export async function getCauseList(): Promise<CauseListItem[]> {
  const [pools, campaigns, updates] = await Promise.all([getPools(), getCampaigns(), getFieldUpdates({ limit: 60 })])
  const out: CauseListItem[] = []
  for (const p of pools) {
    const campaign = campaigns.find((c) => c.pool_id === p.id) ?? null
    const { count } = await getSupporters(p.id, 1)
    const latestUpdate: FieldUpdateView | null = updates.find((u) => u.poolId === p.id) ?? null
    out.push({ ...p, campaign, supporterCount: count, latestUpdate, nextMilestone: nextMilestoneFor(campaign), raisedSol: p.totalDonated, heldSol: p.vaultBalance, releasedSol: releasedSol(p) })
  }
  return out
}

export async function getCauseDetail(id: string, viewer?: string | null): Promise<CauseDetail | null> {
  const pool = await getPool(id)
  if (!pool) return null
  const db = await getDb()
  const [campaigns, allProposals, supporters, updates, gifts, postRows, dareRows] = await Promise.all([
    getCampaigns(),
    getProposals(),
    getSupporters(id, 50),
    getFieldUpdates({ poolId: id, limit: 30 }),
    getGiftsForPool(id, 30, viewer),
    db
      .select()
      .from(posts)
      .where(sql`${posts.properties}->>'poolId' = ${id}`)
      .orderBy(desc(posts.createdAt))
      .limit(30),
    db.select().from(dares).where(eq(dares.poolId, id)).orderBy(desc(dares.createdAt)).limit(10),
  ])
  const campaign = campaigns.find((c) => c.pool_id === id) ?? null
  const proposals = campaign ? allProposals.filter((p) => p.campaign_id === campaign.id).sort((a, b) => (a.status === 'active' ? -1 : 0) - (b.status === 'active' ? -1 : 0)) : []
  const friendsWhoGave = viewer ? await followingWhoDonated(viewer, id).catch(() => []) : []
  return {
    pool,
    campaign,
    proposals,
    supporters: supporters.supporters,
    supporterCount: supporters.count,
    updates,
    posts: await hydratePosts(postRows, viewer),
    dares: await toDareViews(dareRows),
    gifts,
    raisedSol: pool.totalDonated,
    heldSol: pool.vaultBalance,
    releasedSol: releasedSol(pool),
    vault: { address: pool.vaultPda, balanceSol: pool.vaultBalance, poolPda: pool.poolPda },
    friendsWhoGave,
  }
}
