import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb, newId, pools, donations, users, impactCertificates, tips, intents, x402Receipts, routedTransfers, type Pool, type Donation } from '@/lib/db'
import { CAUSES, type CauseMeta } from '@/lib/causes'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'
import { findUser, findUsersByAddresses, bumpStreak } from './users'
import { createPost, notifyMany, getFollowers } from './social'

export const POINTS_PER_SOL = 1000
export function pointsForLamports(lamports: number) {
  return Math.floor((lamports / LAMPORTS_PER_SOL) * POINTS_PER_SOL)
}

export type CertTier = 'bronze' | 'silver' | 'gold' | 'diamond'
export function certTierFor(lamports: number): CertTier {
  const sol = lamports / LAMPORTS_PER_SOL
  if (sol >= 1) return 'diamond'
  if (sol >= 0.5) return 'gold'
  if (sol >= 0.1) return 'silver'
  return 'bronze'
}

export interface PoolView extends CauseMeta {
  poolPda: string
  vaultPda: string
  totalDonated: number // SOL (on-chain total_donated)
  vaultBalance: number // SOL currently escrowed
  donorCount: number
  lastSyncedAt: string | null
}

export function toPoolView(p: Pool): PoolView {
  const meta = CAUSES.find((c) => c.id === p.id)
  return {
    id: p.id,
    name: p.name,
    shortName: meta?.shortName ?? p.name,
    description: p.description,
    category: p.category,
    emoji: p.emoji,
    deliveryMode: (p.deliveryMode as CauseMeta['deliveryMode']) || 'trust',
    color: meta?.color ?? 'bg-gray-50 text-gray-600',
    impact: meta?.impact ?? '',
    website: meta?.website,
    poolPda: p.poolPda,
    vaultPda: p.vaultPda,
    totalDonated: p.totalDonatedLamports / LAMPORTS_PER_SOL,
    vaultBalance: p.vaultBalanceLamports / LAMPORTS_PER_SOL,
    donorCount: p.donorCount,
    lastSyncedAt: p.lastSyncedAt ? p.lastSyncedAt.toISOString() : null,
  }
}

/** Ensures the 6 cause rows exist (idempotent). PDAs are derived client-side-free via lib/solana/pda. */
export async function ensurePools(derive: (id: string) => { poolPda: string; vaultPda: string }) {
  const db = await getDb()
  for (const c of CAUSES) {
    const { poolPda, vaultPda } = derive(c.id)
    await db
      .insert(pools)
      .values({ id: c.id, name: c.name, description: c.description, category: c.category, emoji: c.emoji, deliveryMode: c.deliveryMode, poolPda, vaultPda })
      .onConflictDoUpdate({ target: pools.id, set: { name: c.name, description: c.description, category: c.category, emoji: c.emoji, deliveryMode: c.deliveryMode, poolPda, vaultPda } })
  }
}

export async function getPools(): Promise<PoolView[]> {
  const db = await getDb()
  const rows = await db.select().from(pools).where(eq(pools.isActive, true))
  const order = new Map(CAUSES.map((c, i) => [c.id, i]))
  return rows.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)).map(toPoolView)
}

export async function getPool(id: string): Promise<PoolView | null> {
  const db = await getDb()
  const rows = await db.select().from(pools).where(eq(pools.id, id)).limit(1)
  return rows[0] ? toPoolView(rows[0]) : null
}

export async function updatePoolChainState(id: string, state: { totalDonatedLamports: number; donorCount: number; vaultBalanceLamports: number }) {
  const db = await getDb()
  await db.update(pools).set({ ...state, lastSyncedAt: new Date() }).where(eq(pools.id, id))
}

export interface RecordDonationInput {
  donorAddress: string
  poolId: string
  amountLamports: number
  signature: string
  route?: 'solana' | 'intents' | 'multihopper' | 'blink' | 'demo'
  sourceChain?: string
  sourceAsset?: string
  sourceAmount?: string
  intentId?: string
  /** Skip the social post (e.g. anonymous/discreet routes). */
  silent?: boolean
}

/**
 * Idempotent on signature. Records the donation, credits points, bumps
 * streak, issues the impact certificate, posts to the feed and notifies followers.
 */
export async function recordDonation(input: RecordDonationInput): Promise<{ donation: Donation; points: number; created: boolean; tier: CertTier }> {
  const db = await getDb()
  const points = pointsForLamports(input.amountLamports)
  const tier = certTierFor(input.amountLamports)

  const inserted = await db
    .insert(donations)
    .values({
      id: newId('don'),
      donorAddress: input.donorAddress,
      poolId: input.poolId,
      amountLamports: input.amountLamports,
      signature: input.signature,
      route: input.route ?? 'solana',
      sourceChain: input.sourceChain ?? null,
      sourceAsset: input.sourceAsset ?? null,
      sourceAmount: input.sourceAmount ?? null,
      intentId: input.intentId ?? null,
      rewardPoints: points,
    })
    .onConflictDoNothing({ target: donations.signature })
    .returning()

  if (!inserted[0]) {
    const existing = await db.select().from(donations).where(eq(donations.signature, input.signature)).limit(1)
    return { donation: existing[0], points: existing[0]?.rewardPoints ?? 0, created: false, tier }
  }
  const donation = inserted[0]

  // Credit donor
  await db
    .update(users)
    .set({
      rewardPoints: sql`${users.rewardPoints} + ${points}`,
      totalDonatedLamports: sql`${users.totalDonatedLamports} + ${input.amountLamports}`,
      donationCount: sql`${users.donationCount} + 1`,
    })
    .where(eq(users.address, input.donorAddress))
  await bumpStreak(input.donorAddress)

  // Pool counters (chain sync will overwrite with authoritative numbers)
  await db
    .update(pools)
    .set({ totalDonatedLamports: sql`${pools.totalDonatedLamports} + ${input.amountLamports}`, donorCount: sql`${pools.donorCount} + 1`, vaultBalanceLamports: sql`${pools.vaultBalanceLamports} + ${input.amountLamports}` })
    .where(eq(pools.id, input.poolId))

  const cause = CAUSES.find((c) => c.id === input.poolId)
  const causeName = cause?.name ?? input.poolId

  // Certificate
  await db.insert(impactCertificates).values({ id: newId('cert'), ownerAddress: input.donorAddress, donationId: donation.id, causeName, amountLamports: input.amountLamports, tier, mintSignature: input.signature })

  // Feed + notifications
  if (!input.silent) {
    const sol = (input.amountLamports / LAMPORTS_PER_SOL).toFixed(input.amountLamports % 10_000_000 === 0 ? 2 : 3)
    const viaChain = input.route === 'intents' && input.sourceChain ? ` from ${input.sourceChain}${input.sourceAsset ? ` (${input.sourceAmount ?? ''} ${input.sourceAsset})`.replace('( ', '(') : ''} via NEAR Intents` : ''
    const content = `Donated ${sol} SOL${viaChain} to ${cause?.emoji ?? ''} ${causeName}. Locked in on-chain escrow until the community releases it.`
    await createPost(input.donorAddress, content, 'donation', { amount: sol, cause: causeName, poolId: input.poolId, route: input.route ?? 'solana', ...(input.sourceChain ? { sourceChain: input.sourceChain } : {}) }, input.signature)

    const donor = await findUser(input.donorAddress)
    if (donor) {
      const followers = await getFollowers(input.donorAddress)
      await notifyMany(followers.map((f) => ({ recipientAddress: f.address, type: 'donation', message: `@${donor.username} donated ${sol} SOL to ${causeName}`, fromUsername: donor.username })))
    }
  }

  return { donation, points, created: true, tier }
}

export async function getDonationsByDonor(address: string, limit = 50): Promise<Donation[]> {
  const db = await getDb()
  return db.select().from(donations).where(eq(donations.donorAddress, address)).orderBy(desc(donations.createdAt)).limit(limit)
}

export async function getRecentDonations(limit = 20): Promise<(Donation & { username: string; poolName: string })[]> {
  const db = await getDb()
  const rows = await db.select().from(donations).orderBy(desc(donations.createdAt)).limit(limit)
  const authors = await findUsersByAddresses(Array.from(new Set(rows.map((r) => r.donorAddress))))
  return rows.map((d) => ({
    ...d,
    username: authors.get(d.donorAddress)?.username ?? `${d.donorAddress.slice(0, 4)}…${d.donorAddress.slice(-4)}`,
    poolName: CAUSES.find((c) => c.id === d.poolId)?.name ?? d.poolId,
  }))
}

export async function getCertificates(address: string) {
  const db = await getDb()
  const rows = await db.select().from(impactCertificates).where(eq(impactCertificates.ownerAddress, address)).orderBy(desc(impactCertificates.createdAt))
  return rows.map((c) => ({ id: c.id, tier: c.tier, cause_name: c.causeName, amount: c.amountLamports / LAMPORTS_PER_SOL, owner_address: c.ownerAddress, mint_signature: c.mintSignature, created_at: c.createdAt.toISOString() }))
}

export async function recordTip(senderAddress: string, recipientAddress: string, amountLamports: number, message: string, signature: string) {
  const db = await getDb()
  await db.insert(tips).values({ id: newId('tip'), senderAddress, recipientAddress, amountLamports, message, signature })
  await db.update(users).set({ tipCountSent: sql`${users.tipCountSent} + 1`, rewardPoints: sql`${users.rewardPoints} + ${pointsForLamports(amountLamports)}` }).where(eq(users.address, senderAddress))
  await db.update(users).set({ tipCountReceived: sql`${users.tipCountReceived} + 1` }).where(eq(users.address, recipientAddress))
}

// ---- Platform-wide stats ----
export interface PlatformStats {
  totalDonations: number // SOL, lifetime through the app
  totalEscrowed: number // SOL currently in vaults (chain-synced)
  totalDonors: number
  totalTransactions: number
  crossChainVolume: number // SOL-equivalent via intents
  crossChainCount: number
  discreetVolume: number // SOL via MultiHopper
  x402Calls: number
  x402Revenue: string // USDC
  pools: number
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const db = await getDb()
  const [agg] = await db
    .select({
      total: sql<number>`coalesce(sum(${donations.amountLamports}), 0)::bigint`,
      donors: sql<number>`count(distinct ${donations.donorAddress})::int`,
      txs: sql<number>`count(*)::int`,
      cross: sql<number>`coalesce(sum(case when ${donations.route} = 'intents' then ${donations.amountLamports} else 0 end), 0)::bigint`,
      crossCount: sql<number>`sum(case when ${donations.route} = 'intents' then 1 else 0 end)::int`,
      discreet: sql<number>`coalesce(sum(case when ${donations.route} = 'multihopper' then ${donations.amountLamports} else 0 end), 0)::bigint`,
    })
    .from(donations)
  const poolRows = await db.select({ vault: sql<number>`coalesce(sum(${pools.vaultBalanceLamports}), 0)::bigint`, n: sql<number>`count(*)::int` }).from(pools)
  const [x] = await db.select({ n: sql<number>`count(*)::int`, usd: sql<string>`coalesce(sum((${x402Receipts.amount})::numeric), 0)::text` }).from(x402Receipts).where(eq(x402Receipts.status, 'settled'))
  return {
    totalDonations: Number(agg?.total ?? 0) / LAMPORTS_PER_SOL,
    totalEscrowed: Number(poolRows[0]?.vault ?? 0) / LAMPORTS_PER_SOL,
    totalDonors: agg?.donors ?? 0,
    totalTransactions: agg?.txs ?? 0,
    crossChainVolume: Number(agg?.cross ?? 0) / LAMPORTS_PER_SOL,
    crossChainCount: agg?.crossCount ?? 0,
    discreetVolume: Number(agg?.discreet ?? 0) / LAMPORTS_PER_SOL,
    x402Calls: x?.n ?? 0,
    x402Revenue: x?.usd ?? '0',
    pools: poolRows[0]?.n ?? 0,
  }
}

export async function getLeaderboard(limit = 10) {
  const db = await getDb()
  const rows = await db.select().from(users).where(and(eq(users.isActive, true), sql`${users.totalDonatedLamports} > 0`)).orderBy(desc(users.totalDonatedLamports)).limit(limit)
  const byPoints = await db.select().from(users).where(eq(users.isActive, true)).orderBy(desc(users.rewardPoints)).limit(limit)
  const byStreak = await db.select().from(users).where(and(eq(users.isActive, true), sql`${users.streakCurrent} > 0`)).orderBy(desc(users.streakCurrent), desc(users.rewardPoints)).limit(limit)
  const map = (u: typeof rows[number]) => ({
    address: u.address,
    username: u.username,
    displayName: u.displayName,
    totalDonated: u.totalDonatedLamports / LAMPORTS_PER_SOL,
    totalContributed: u.totalDonatedLamports / LAMPORTS_PER_SOL,
    rewardPoints: u.rewardPoints,
    donationCount: u.donationCount,
    streak: u.streakCurrent,
  })
  return { topDonors: rows.map(map), topEarners: byPoints.map(map), streakLeaders: byStreak.map(map) }
}

/** Unified recent activity for tickers/right rail. */
export async function getActivity(limit = 20) {
  const db = await getDb()
  const recent = await getRecentDonations(limit)
  const recentIntents = await db.select().from(intents).where(eq(intents.status, 'success')).orderBy(desc(intents.updatedAt)).limit(5)
  const routed = await db.select().from(routedTransfers).where(eq(routedTransfers.status, 'completed')).orderBy(desc(routedTransfers.createdAt)).limit(5)
  const items = [
    ...recent.map((d) => ({
      id: d.id,
      type: d.route === 'intents' ? 'intent' : d.route === 'multihopper' ? 'discreet' : 'donation',
      username: d.route === 'multihopper' ? 'anonymous' : d.username,
      amount: d.amountLamports / LAMPORTS_PER_SOL,
      poolId: d.poolId,
      poolName: d.poolName,
      sourceChain: d.sourceChain,
      signature: d.signature,
      timestamp: d.createdAt.toISOString(),
    })),
    ...recentIntents.map((i) => ({ id: i.id, type: 'intent_settled', username: '', amount: (i.amountOutLamports ?? 0) / LAMPORTS_PER_SOL, poolId: i.poolId ?? '', poolName: CAUSES.find((c) => c.id === i.poolId)?.name ?? '', sourceChain: i.sourceChain, signature: i.settlementSignature ?? '', timestamp: i.updatedAt.toISOString() })),
    ...routed.map((r) => ({ id: r.id, type: 'payout', username: '', amount: r.amountLamports / LAMPORTS_PER_SOL, poolId: r.poolId ?? '', poolName: CAUSES.find((c) => c.id === r.poolId)?.name ?? '', sourceChain: null, signature: r.providerRef ?? '', timestamp: r.createdAt.toISOString() })),
  ]
  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit)
}
