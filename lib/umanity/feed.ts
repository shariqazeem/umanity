/**
 * Home: one stream of what happened to drops (gifts, filmed deliveries,
 * unlocks, missed dates, fee splits) plus people's own posts. Every money row
 * comes from the chain mirror; nothing here is composed for show.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { dropGifts, drops, dropUpdates, getDb, moneyEvents, posts, users } from '@/lib/db'
import type { MediaItem } from '@/lib/db/schema'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { hydratePosts, type FeedPost } from '@/lib/data/social'
import { freshen } from './data'
import { refundsOpen } from './program'
import type { DropMeta } from './drops'

export type FeedDrop = { id: number; title: string; emoji: string; place: string; unitName: string; unitUsd: number; people: number }
export type FeedWho = { username: string; displayName: string | null; avatarUrl: string | null } | { address: string } | null

export type HomeItem =
  | { type: 'gift'; id: string; at: string; drop: FeedDrop; amountUsd: number; channel: string; sourceChain: string | null; signature: string | null; who: FeedWho; message: string | null }
  | { type: 'update'; id: string; at: string; drop: FeedDrop; kind: string; title: string; body: string; media: MediaItem[]; proofTx: string | null; xPostUrl: string | null }
  | { type: 'unlocked'; id: string; at: string; drop: FeedDrop; amountUsd: number; signature: string }
  | { type: 'missed'; id: string; at: string; drop: FeedDrop; potUsd: number; cancelled: boolean }
  | { type: 'fees'; id: string; at: string; totalUsd: number; toDropsUsd: number; toOpsUsd: number; signature: string }
  | { type: 'funded'; id: string; at: string; drop: FeedDrop; amountUsd: number; signature: string }
  | { type: 'post'; id: string; at: string; post: FeedPost }

export async function homeFeed(opts: { viewer?: string | null; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 80)
  await freshen()
  const db = await getDb()
  const dropRows = await db.select().from(drops).where(eq(drops.cluster, SOLANA_CLUSTER))
  const dropById = new Map(
    dropRows.map((d) => {
      const meta = JSON.parse(d.meta) as DropMeta
      return [d.id, { id: d.id, title: d.title, emoji: d.emoji, place: d.place, unitName: meta.unit.name, unitUsd: meta.unit.usd, people: meta.unit.people } satisfies FeedDrop]
    })
  )

  const [gifts, updates, events, postRows] = await Promise.all([
    db
      .select({
        ref: dropGifts.ref,
        dropId: dropGifts.dropId,
        backer: dropGifts.backer,
        amountMicro: dropGifts.amountMicro,
        channel: dropGifts.channel,
        anonymous: dropGifts.anonymous,
        message: dropGifts.message,
        signature: dropGifts.signature,
        sourceChain: dropGifts.sourceChain,
        createdAt: dropGifts.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(dropGifts)
      .leftJoin(users, eq(users.address, sql`coalesce(${dropGifts.userId}, ${dropGifts.backer})`))
      .where(and(eq(dropGifts.cluster, SOLANA_CLUSTER), eq(dropGifts.status, 'confirmed')))
      .orderBy(desc(dropGifts.createdAt))
      .limit(limit),
    db.select().from(dropUpdates).where(eq(dropUpdates.cluster, SOLANA_CLUSTER)).orderBy(desc(dropUpdates.createdAt)).limit(20),
    db
      .select()
      .from(moneyEvents)
      .where(and(eq(moneyEvents.cluster, SOLANA_CLUSTER), inArray(moneyEvents.kind, ['unlocked', 'feesSplit', 'fundedDrop', 'dropCancelled'])))
      .orderBy(desc(moneyEvents.slot))
      .limit(20),
    db.select().from(posts).where(eq(posts.type, 'manual')).orderBy(desc(posts.createdAt)).limit(20),
  ])

  const items: HomeItem[] = []
  const cancelledAt = new Map(events.filter((e) => e.kind === 'dropCancelled' && e.dropId != null).map((e) => [e.dropId!, e.blockTime]))
  for (const g of gifts) {
    const drop = dropById.get(g.dropId)
    if (!drop) continue
    items.push({
      type: 'gift',
      id: `gift_${g.ref}`,
      at: g.createdAt.toISOString(),
      drop,
      amountUsd: g.amountMicro / 1e6,
      channel: g.channel,
      sourceChain: g.sourceChain,
      signature: g.signature,
      message: g.anonymous ? null : g.message,
      who: g.anonymous ? null : g.username ? { username: g.username, displayName: g.displayName, avatarUrl: g.avatarUrl } : { address: g.backer },
    })
  }
  for (const u of updates) {
    const drop = dropById.get(u.dropId)
    if (!drop) continue
    items.push({ type: 'update', id: `update_${u.id}`, at: u.createdAt.toISOString(), drop, kind: u.kind, title: u.title, body: u.body, media: u.media, proofTx: u.proofTx, xPostUrl: u.xPostUrl })
  }
  for (const e of events) {
    const at = (e.blockTime ?? new Date()).toISOString()
    if (e.kind === 'unlocked' && e.dropId != null) {
      const drop = dropById.get(e.dropId)
      if (drop) items.push({ type: 'unlocked', id: `ev_${e.id}`, at, drop, amountUsd: (e.amountMicro ?? 0) / 1e6, signature: e.signature })
    } else if (e.kind === 'fundedDrop' && e.dropId != null) {
      const drop = dropById.get(e.dropId)
      if (drop) items.push({ type: 'funded', id: `ev_${e.id}`, at, drop, amountUsd: (e.amountMicro ?? 0) / 1e6, signature: e.signature })
    } else if (e.kind === 'feesSplit') {
      const d = e.data as { total?: string; toDrops?: string; toOps?: string }
      items.push({ type: 'fees', id: `ev_${e.id}`, at, totalUsd: Number(d.total ?? 0) / 1e6, toDropsUsd: Number(d.toDrops ?? 0) / 1e6, toOpsUsd: Number(d.toOps ?? 0) / 1e6, signature: e.signature })
    }
  }
  // A drop that missed its date (or was called off) is news too: its backers can take their money back.
  for (const d of dropRows) {
    const deadline = Math.floor(d.deadline.getTime() / 1000)
    if (!refundsOpen({ state: d.state as 'open', deadline })) continue
    const drop = dropById.get(d.id)!
    const cancelled = d.state === 'cancelled'
    const at = (cancelled && cancelledAt.get(d.id)) || d.deadline
    items.push({ type: 'missed', id: `missed_${d.id}`, at: at.toISOString(), drop, potUsd: d.potMicro / 1e6, cancelled })
  }
  for (const p of await hydratePosts(postRows, opts.viewer)) items.push({ type: 'post', id: `post_${p.id}`, at: p.createdAt, post: p })

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return items.slice(0, limit)
}

/** The rail's "Top backers": confirmed, named gifts only. */
export async function topBackers(limit = 5) {
  await freshen()
  const db = await getDb()
  const credited = sql<string>`coalesce(${dropGifts.userId}, ${dropGifts.backer})`
  const rows = await db
    .select({
      address: credited,
      totalMicro: sql<string>`sum(${dropGifts.amountMicro})`,
      gifts: sql<number>`count(*)::int`,
      dropsBacked: sql<number>`count(distinct ${dropGifts.dropId})::int`,
    })
    .from(dropGifts)
    .where(and(eq(dropGifts.cluster, SOLANA_CLUSTER), eq(dropGifts.status, 'confirmed'), eq(dropGifts.anonymous, false)))
    .groupBy(credited)
    .orderBy(desc(sql`sum(${dropGifts.amountMicro})`))
    .limit(limit)
  const named = rows.length ? await db.select({ address: users.address, username: users.username, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.address, rows.map((r) => r.address))) : []
  const byAddress = new Map(named.map((n) => [n.address, n]))
  return rows.map((r) => ({
    address: r.address,
    username: byAddress.get(r.address)?.username ?? null,
    avatarUrl: byAddress.get(r.address)?.avatarUrl ?? null,
    totalUsd: Number(r.totalMicro) / 1e6,
    gifts: r.gifts,
    drops: r.dropsBacked,
  }))
}
export type TopBacker = Awaited<ReturnType<typeof topBackers>>[number]
