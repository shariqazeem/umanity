import { desc, eq, sql, inArray } from 'drizzle-orm'
import { getDb, newId, dares, dareStakes, users, type Dare } from '@/lib/db'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'
import { CAUSES } from '@/lib/causes'
import { findUsersByAddresses, findUserByUsername } from './users'
import { createPost, notify } from './social'

export interface DareView {
  id: string
  creator: { address: string; username: string; displayName: string }
  targetHandle: string
  poolId: string
  poolName: string
  poolEmoji: string
  text: string
  stake: number // SOL
  pot: number // SOL
  backerCount: number
  deadline: string
  secondsLeft: number
  status: string
  darePda: string | null
  createTxSignature: string | null
  resolveTxSignature: string | null
  proofPostId: string | null
  createdAt: string
}

export async function toDareViews(rows: Dare[]): Promise<DareView[]> {
  const creators = await findUsersByAddresses(Array.from(new Set(rows.map((r) => r.creatorAddress))))
  const now = Date.now()
  return rows.map((d) => {
    const c = creators.get(d.creatorAddress)
    const cause = CAUSES.find((x) => x.id === d.poolId)
    return {
      id: d.id,
      creator: { address: d.creatorAddress, username: c?.username ?? '', displayName: c?.displayName ?? '' },
      targetHandle: d.targetHandle,
      poolId: d.poolId,
      poolName: cause?.name ?? d.poolId,
      poolEmoji: cause?.emoji ?? '',
      text: d.text,
      stake: d.stakeLamports / LAMPORTS_PER_SOL,
      pot: d.potLamports / LAMPORTS_PER_SOL,
      backerCount: d.backerCount,
      deadline: d.deadline.toISOString(),
      secondsLeft: Math.max(0, Math.floor((d.deadline.getTime() - now) / 1000)),
      status: d.status,
      darePda: d.darePda ?? null,
      createTxSignature: d.createTxSignature ?? null,
      resolveTxSignature: d.resolveTxSignature ?? null,
      proofPostId: d.proofPostId ?? null,
      createdAt: d.createdAt.toISOString(),
    }
  })
}

export async function createDare(input: { creatorAddress: string; targetHandle: string; poolId: string; text: string; stakeLamports: number; hours: number; darePda?: string; createTxSignature?: string }): Promise<DareView> {
  const db = await getDb()
  const target = input.targetHandle.replace(/^@/, '').toLowerCase()
  const rows = await db
    .insert(dares)
    .values({
      id: newId('dare'),
      creatorAddress: input.creatorAddress,
      targetHandle: target,
      poolId: input.poolId,
      text: input.text,
      stakeLamports: input.stakeLamports,
      potLamports: input.stakeLamports,
      backerCount: input.stakeLamports > 0 ? 1 : 0,
      deadline: new Date(Date.now() + input.hours * 3_600_000),
      darePda: input.darePda ?? null,
      createTxSignature: input.createTxSignature ?? null,
    })
    .returning()
  const d = rows[0]
  if (input.stakeLamports > 0) {
    await db.insert(dareStakes).values({ id: newId('stk'), dareId: d.id, stakerAddress: input.creatorAddress, amountLamports: input.stakeLamports, signature: input.createTxSignature ?? `offchain_${d.id}` })
  }
  const cause = CAUSES.find((x) => x.id === input.poolId)
  const stakeSol = input.stakeLamports / LAMPORTS_PER_SOL
  await createPost(
    input.creatorAddress,
    `⚡ Dare for @${target}: ${input.text} — ${stakeSol} SOL staked for ${cause?.emoji ?? ''} ${cause?.name ?? input.poolId}. ${input.hours}h on the clock.`,
    'impact_dare',
    { dareId: d.id, dareTarget: target, dareAmount: String(stakeSol), darePool: input.poolId, darePoolName: cause?.name ?? '', darePoolEmoji: cause?.emoji ?? '' },
    input.createTxSignature
  )
  const targetUser = await findUserByUsername(target)
  if (targetUser) {
    const creator = (await findUsersByAddresses([input.creatorAddress])).get(input.creatorAddress)
    await notify(targetUser.address, 'dare', `@${creator?.username ?? 'someone'} dared you: ${input.text} (${stakeSol} SOL staked for ${cause?.name ?? input.poolId})`, creator?.username)
  }
  return (await toDareViews([d]))[0]
}

export async function boostDare(dareId: string, stakerAddress: string, amountLamports: number, signature: string, route = 'solana'): Promise<DareView | null> {
  const db = await getDb()
  await db.insert(dareStakes).values({ id: newId('stk'), dareId, stakerAddress, amountLamports, signature, route })
  const rows = await db
    .update(dares)
    .set({ potLamports: sql`${dares.potLamports} + ${amountLamports}`, backerCount: sql`${dares.backerCount} + 1` })
    .where(eq(dares.id, dareId))
    .returning()
  await db.update(users).set({ rewardPoints: sql`${users.rewardPoints} + ${Math.floor((amountLamports / LAMPORTS_PER_SOL) * 1000)}` }).where(eq(users.address, stakerAddress))
  return rows[0] ? (await toDareViews(rows))[0] : null
}

export async function resolveDare(dareId: string, status: 'completed' | 'expired' | 'cancelled', patch: { resolveTxSignature?: string; proofPostId?: string } = {}) {
  const db = await getDb()
  const rows = await db.update(dares).set({ status, ...patch }).where(eq(dares.id, dareId)).returning()
  return rows[0] ? (await toDareViews(rows))[0] : null
}

export async function getDares(filter: { status?: string; limit?: number } = {}): Promise<DareView[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(dares)
    .where(filter.status ? eq(dares.status, filter.status) : undefined)
    .orderBy(desc(dares.potLamports), desc(dares.createdAt))
    .limit(filter.limit ?? 20)
  return toDareViews(rows)
}

export async function getDare(id: string): Promise<DareView | null> {
  const db = await getDb()
  const rows = await db.select().from(dares).where(eq(dares.id, id)).limit(1)
  return rows[0] ? (await toDareViews(rows))[0] : null
}

export async function getDareStakes(dareId: string) {
  const db = await getDb()
  const rows = await db.select().from(dareStakes).where(eq(dareStakes.dareId, dareId)).orderBy(desc(dareStakes.createdAt))
  const stakers = await findUsersByAddresses(Array.from(new Set(rows.map((r) => r.stakerAddress))))
  return rows.map((s) => ({ id: s.id, address: s.stakerAddress, username: stakers.get(s.stakerAddress)?.username ?? '', amount: s.amountLamports / LAMPORTS_PER_SOL, signature: s.signature, route: s.route, createdAt: s.createdAt.toISOString() }))
}

export async function dareChampions(limit = 10) {
  const db = await getDb()
  const rows = await db
    .select({ address: dareStakes.stakerAddress, total: sql<number>`sum(${dareStakes.amountLamports})::bigint`, n: sql<number>`count(*)::int` })
    .from(dareStakes)
    .groupBy(dareStakes.stakerAddress)
    .orderBy(desc(sql`sum(${dareStakes.amountLamports})`))
    .limit(limit)
  const us = await findUsersByAddresses(rows.map((r) => r.address))
  return rows.map((r) => ({ address: r.address, username: us.get(r.address)?.username ?? '', displayName: us.get(r.address)?.displayName ?? '', totalStaked: Number(r.total) / LAMPORTS_PER_SOL, dares: r.n }))
}

export async function expireDueDares(): Promise<number> {
  const db = await getDb()
  const due = await db.select({ id: dares.id }).from(dares).where(sql`${dares.status} = 'open' and ${dares.deadline} < now()`)
  if (!due.length) return 0
  await db.update(dares).set({ status: 'expired' }).where(inArray(dares.id, due.map((d) => d.id)))
  return due.length
}
