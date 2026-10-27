import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb, newId, pools, donations, users, impactCertificates, tips, intents, x402Receipts, routedTransfers, fieldDeliveries, type Pool, type Donation, type User } from '@/lib/db'
import { CAUSES, CAUSE_IDS, type CauseMeta } from '@/lib/causes'
import type { GiftView, Supporter } from '@/lib/contracts'
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
  // Copy lives in lib/causes.ts so wording changes never need a migration;
  // the database row only carries the on-chain addresses and counters.
  const meta = CAUSES.find((c) => c.id === p.id)
  const base: CauseMeta = meta ?? {
    id: p.id,
    name: p.name,
    shortName: p.name,
    tagline: p.description,
    story: p.description,
    description: p.description,
    category: p.category,
    emoji: p.emoji,
    image: '',
    imageAlt: p.name,
    units: [],
    impact: '',
    deliveryMode: (p.deliveryMode as CauseMeta['deliveryMode']) || 'field',
    location: '',
    color: 'bg-gray-50 text-gray-600',
    plan: { targetSol: 0, days: 0, milestones: [] },
  }
  return {
    ...base,
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
  // Only causes that exist in lib/causes.ts; rows for retired ids stay in the table but are never shown.
  const rows = await db.select().from(pools).where(and(eq(pools.isActive, true), inArray(pools.id, CAUSE_IDS)))
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
  /** Skip the social post (e.g. discreet routes). */
  silent?: boolean
  /** Donor chose to hide their name: stored on the row, no post, unnamed in lists. */
  anonymous?: boolean
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
      anonymous: !!input.anonymous,
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

  // Feed + notifications (never for anonymous gifts)
  if (!input.silent && !input.anonymous) {
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
  const rows = await db.select().from(donations).where(inArray(donations.poolId, CAUSE_IDS)).orderBy(desc(donations.createdAt)).limit(limit)
  const authors = await findUsersByAddresses(Array.from(new Set(rows.map((r) => r.donorAddress))))
  return rows.map((d) => ({
    ...d,
    username: d.anonymous ? 'anonymous' : authors.get(d.donorAddress)?.username ?? `${d.donorAddress.slice(0, 4)}…${d.donorAddress.slice(-4)}`,
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
  /** SOL that has left the vaults after approved releases (on-chain: donated minus still held). */
  releasedSol: number
  /** Field deliveries posted by the team. */
  deliveries: number
  causes: number
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
    .where(inArray(donations.poolId, CAUSE_IDS))
  const poolRows = await db
    .select({ vault: sql<number>`coalesce(sum(${pools.vaultBalanceLamports}), 0)::bigint`, donated: sql<number>`coalesce(sum(${pools.totalDonatedLamports}), 0)::bigint`, n: sql<number>`count(*)::int` })
    .from(pools)
    .where(inArray(pools.id, CAUSE_IDS))
  const [deliveries] = await db.select({ n: sql<number>`count(*)::int` }).from(fieldDeliveries)
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
    releasedSol: Math.max(0, Number(poolRows[0]?.donated ?? 0) - Number(poolRows[0]?.vault ?? 0)) / LAMPORTS_PER_SOL,
    deliveries: deliveries?.n ?? 0,
    causes: CAUSES.length,
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
      username: d.route === 'multihopper' || d.anonymous ? 'anonymous' : d.username,
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

// ---- Gifts (donations as the screens show them) ----
function shortAddr(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`
}

/** A donation row as a GiftView. Anonymous gifts are unnamed unless the viewer is the donor. */
export function toGiftView(d: Donation, user: User | undefined, viewer?: string | null): GiftView {
  const hide = d.anonymous && viewer !== d.donorAddress
  const cause = CAUSES.find((c) => c.id === d.poolId)
  return {
    id: d.id,
    poolId: d.poolId,
    poolName: cause?.name ?? d.poolId,
    username: hide ? 'anonymous' : user?.username ?? shortAddr(d.donorAddress),
    displayName: hide ? 'Anonymous' : user?.displayName ?? '',
    address: hide ? '' : d.donorAddress,
    avatarUrl: hide ? null : user?.avatarUrl ?? null,
    amount: d.amountLamports / LAMPORTS_PER_SOL,
    route: d.route,
    sourceChain: d.sourceChain ?? null,
    signature: d.signature,
    createdAt: d.createdAt.toISOString(),
    anonymous: d.anonymous,
  }
}

export async function toGiftViews(rows: Donation[], viewer?: string | null): Promise<GiftView[]> {
  const authors = await findUsersByAddresses(Array.from(new Set(rows.map((r) => r.donorAddress))))
  return rows.map((d) => toGiftView(d, authors.get(d.donorAddress), viewer))
}

export async function getGiftsForPool(poolId: string, limit = 30, viewer?: string | null): Promise<GiftView[]> {
  const db = await getDb()
  const rows = await db.select().from(donations).where(eq(donations.poolId, poolId)).orderBy(desc(donations.createdAt)).limit(limit)
  return toGiftViews(rows, viewer)
}

export async function getGiftsForDonor(address: string, limit = 50, viewer?: string | null): Promise<GiftView[]> {
  const db = await getDb()
  const rows = await db.select().from(donations).where(and(eq(donations.donorAddress, address), inArray(donations.poolId, CAUSE_IDS))).orderBy(desc(donations.createdAt)).limit(limit)
  return toGiftViews(rows, viewer)
}

/** Donors of a cause, aggregated. Anonymous gifts are counted but collapsed into one unnamed row. */
export async function getSupporters(poolId: string, limit = 50): Promise<{ supporters: Supporter[]; count: number }> {
  const db = await getDb()
  const rows = await db
    .select({
      address: donations.donorAddress,
      anonymous: donations.anonymous,
      total: sql<number>`sum(${donations.amountLamports})::bigint`,
      n: sql<number>`count(*)::int`,
      last: sql<string>`max(${donations.createdAt})::text`,
    })
    .from(donations)
    .where(eq(donations.poolId, poolId))
    .groupBy(donations.donorAddress, donations.anonymous)
    .orderBy(desc(sql`sum(${donations.amountLamports})`))
  const named = rows.filter((r) => !r.anonymous)
  const anon = rows.filter((r) => r.anonymous)
  const us = await findUsersByAddresses(named.map((r) => r.address))
  const supporters: Supporter[] = named.slice(0, limit).map((r) => {
    const u = us.get(r.address)
    return { address: r.address, username: u?.username ?? shortAddr(r.address), displayName: u?.displayName ?? '', avatarUrl: u?.avatarUrl ?? null, amount: Number(r.total) / LAMPORTS_PER_SOL, count: r.n, lastAt: new Date(r.last).toISOString(), anonymous: false }
  })
  if (anon.length) {
    supporters.push({
      address: '',
      username: 'anonymous',
      displayName: anon.length === 1 ? 'Anonymous' : `${anon.length} anonymous givers`,
      avatarUrl: null,
      amount: anon.reduce((s, r) => s + Number(r.total), 0) / LAMPORTS_PER_SOL,
      count: anon.reduce((s, r) => s + r.n, 0),
      lastAt: new Date(anon.map((r) => r.last).sort().reverse()[0]).toISOString(),
      anonymous: true,
    })
  }
  const distinct = new Set(rows.map((r) => r.address)).size
  return { supporters, count: distinct }
}

/** Pool ids this wallet has given to. */
export async function donorPoolsGiven(address: string): Promise<Set<string>> {
  const db = await getDb()
  const rows = await db.selectDistinct({ poolId: donations.poolId }).from(donations).where(eq(donations.donorAddress, address))
  return new Set(rows.map((r) => r.poolId))
}

/** Distinct donor wallets of a cause (for delivery notifications). */
export async function getDonorAddressesForPool(poolId: string): Promise<string[]> {
  const db = await getDb()
  const rows = await db.selectDistinct({ address: donations.donorAddress }).from(donations).where(eq(donations.poolId, poolId))
  return rows.map((r) => r.address)
}

/** 1-based rank of this wallet's first gift among all donors (founding order); null when it has not given. */
export async function firstGiftRank(address: string): Promise<number | null> {
  const db = await getDb()
  const rows = await db
    .select({ address: donations.donorAddress, first: sql<string>`min(${donations.createdAt})::text` })
    .from(donations)
    .where(inArray(donations.poolId, CAUSE_IDS))
    .groupBy(donations.donorAddress)
    .orderBy(sql`min(${donations.createdAt})`)
  const idx = rows.findIndex((r) => r.address === address)
  return idx < 0 ? null : idx + 1
}

/** Per-cause totals for one donor. */
export async function donorCauseTotals(address: string): Promise<{ poolId: string; amount: number; count: number }[]> {
  const db = await getDb()
  const rows = await db
    .select({ poolId: donations.poolId, total: sql<number>`sum(${donations.amountLamports})::bigint`, n: sql<number>`count(*)::int` })
    .from(donations)
    .where(and(eq(donations.donorAddress, address), inArray(donations.poolId, CAUSE_IDS)))
    .groupBy(donations.poolId)
    .orderBy(desc(sql`sum(${donations.amountLamports})`))
  return rows.map((r) => ({ poolId: r.poolId, amount: Number(r.total) / LAMPORTS_PER_SOL, count: r.n }))
}
