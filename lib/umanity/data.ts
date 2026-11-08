/**
 * Server-side reads for drops and the money trail. Every read also catches
 * the database up with the chain (at most every few seconds per process).
 * The catch-up runs after the response is sent, so pages render straight from
 * the database and the next read sees the chain's latest.
 */
import { after } from 'next/server'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { dropGifts, drops, dropUpdates, getDb, moneyEvents, spending, trades, users, type Drop } from '@/lib/db'
import { getConnection } from '@/lib/solana/chain'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { CONFIG, DROPS_FUND, FEE_INBOX, UMANITY_PROGRAM_ID, fetchConfig, refundsOpen, tokenBalance, usd } from './program'
import { syncChain } from './indexer'
import { keepFeesMoving } from './keeper'
import { metaMatches, sha256Hex, type DropMeta } from './drops'
import { guardView } from '@/lib/near/flow'

const FRESH_MS = 8_000
let lastSync = 0

export async function freshen(opts: { wait?: boolean } = {}) {
  if (Date.now() - lastSync < FRESH_MS) return
  lastSync = Date.now()
  const run = async () => {
    try {
      await syncChain(getConnection())
      // A split shows up on the next sync.
      await keepFeesMoving(getConnection()).catch(() => null)
    } catch (e) {
      // Serve what the database has; the next read retries.
      lastSync = 0
      console.warn('[umanity] chain sync failed:', (e as Error).message)
    }
  }
  if (opts.wait) return run()
  try {
    after(run)
  } catch {
    // Outside a request (scripts, tests): catch up before reading.
    await run()
  }
}

export type DropView = ReturnType<typeof dropView>

export function dropView(d: Drop) {
  const meta = JSON.parse(d.meta) as DropMeta
  const potUsd = d.potMicro / 1e6
  const goalUsd = d.goalMicro / 1e6
  const deadline = Math.floor(d.deadline.getTime() / 1000)
  return {
    id: d.id,
    address: d.address,
    title: d.title,
    place: d.place,
    story: d.story,
    emoji: d.emoji,
    items: d.items,
    unit: meta.unit,
    meta: d.meta,
    metaHash: d.metaHash,
    goalUsd,
    capUsd: d.capMicro / 1e6,
    potUsd,
    givenUsd: d.givenMicro / 1e6,
    fromFundUsd: d.fromFundMicro / 1e6,
    refundedUsd: d.refundedMicro / 1e6,
    unlockedUsd: d.unlockedMicro / 1e6,
    backers: d.backers,
    deadline,
    payee: d.payee,
    state: d.state as 'open' | 'proven' | 'unlocked' | 'cancelled',
    refundsOpen: refundsOpen({ state: d.state as 'open', deadline }),
    proofHash: d.proofHash,
    proofAt: d.proofAt ? d.proofAt.getTime() / 1000 : null,
    unlockedAt: d.unlockedAt ? d.unlockedAt.getTime() / 1000 : null,
    unlockTx: d.unlockTx,
    createdTx: d.createdTx,
    progress: goalUsd > 0 ? Math.min(1, potUsd / goalUsd) : 0,
  }
}

export async function listDrops() {
  await freshen()
  const db = await getDb()
  const rows = await db.select().from(drops).where(eq(drops.cluster, SOLANA_CLUSTER)).orderBy(desc(drops.id))
  return rows.map(dropView)
}

/** The drop the Give button fills: the open one closest to its date. */
export async function nextDrop() {
  const all = await listDrops()
  return all.filter((d) => d.state === 'open' && !d.refundsOpen).sort((a, b) => a.deadline - b.deadline)[0] ?? null
}

export async function getDrop(id: number) {
  await freshen()
  const db = await getDb()
  const row = (await db.select().from(drops).where(and(eq(drops.cluster, SOLANA_CLUSTER), eq(drops.id, id))))[0]
  if (!row) return null
  const [gifts, updates, events] = await Promise.all([
    db
      .select({
        ref: dropGifts.ref,
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
      // Credited account, else the backer's own profile.
      .leftJoin(users, eq(users.address, sql`coalesce(${dropGifts.userId}, ${dropGifts.backer})`))
      .where(and(eq(dropGifts.cluster, SOLANA_CLUSTER), eq(dropGifts.dropId, id), eq(dropGifts.status, 'confirmed')))
      .orderBy(desc(dropGifts.createdAt))
      .limit(200),
    db
      .select()
      .from(dropUpdates)
      .where(and(eq(dropUpdates.cluster, SOLANA_CLUSTER), eq(dropUpdates.dropId, id)))
      .orderBy(desc(dropUpdates.createdAt)),
    db
      .select({ kind: moneyEvents.kind, signature: moneyEvents.signature, blockTime: moneyEvents.blockTime, amountMicro: moneyEvents.amountMicro, party: moneyEvents.party })
      .from(moneyEvents)
      .where(and(eq(moneyEvents.cluster, SOLANA_CLUSTER), eq(moneyEvents.dropId, id)))
      .orderBy(asc(moneyEvents.slot)),
  ])
  const view = dropView(row)
  const currentProof = updates.find((u) => u.kind === 'proof' && u.proofHash && u.proofHash === row.proofHash)
  const [config, guard] = await Promise.all([fetchConfig(getConnection()).catch(() => null), guardView(id, row.proofHash, currentProof?.guard ?? null).catch(() => null)])
  return {
    ...view,
    reviewHours: config ? config.reviewSecs / 3600 : 0,
    guard,
    metaVerified: await metaMatches(row.meta, row.metaHash),
    gifts: gifts.map((g) => ({
      ref: g.ref,
      amountUsd: g.amountMicro / 1e6,
      channel: g.channel,
      sourceChain: g.sourceChain,
      signature: g.signature,
      at: g.createdAt.toISOString(),
      message: g.anonymous ? null : g.message,
      who: g.anonymous ? null : g.username ? { username: g.username, displayName: g.displayName, avatarUrl: g.avatarUrl } : { address: g.backer },
    })),
    updates: await Promise.all(
      updates.map(async (u) => ({
        id: u.id,
        kind: u.kind,
        title: u.title,
        body: u.body,
        media: u.media,
        proofHash: u.proofHash,
        proofTx: u.proofTx,
        xPostUrl: u.xPostUrl,
        // The stored bundle hashes to what was posted, and the latest proof is the one on-chain.
        proofCheck: !u.proofHash || !u.proofBundle ? null : (await sha256Hex(u.proofBundle)) === u.proofHash ? (u.proofHash === row.proofHash ? 'on-chain' : 'superseded') : 'mismatch',
        at: u.createdAt.toISOString(),
      }))
    ),
    timeline: events.map((e) => ({ kind: e.kind, signature: e.signature, at: e.blockTime?.toISOString() ?? null, amountUsd: e.amountMicro == null ? null : e.amountMicro / 1e6, party: e.party })),
  }
}
export type DropDetail = NonNullable<Awaited<ReturnType<typeof getDrop>>>

/** The Money page: every total checked against the chain, plus the flows behind it. */
export async function moneySummary() {
  await freshen()
  const db = await getDb()
  const conn = getConnection()
  const [config, inbox, fund, totals, recent, spent, swaps, claimed] = await Promise.all([
    fetchConfig(conn).catch(() => null),
    tokenBalance(conn, FEE_INBOX).catch(() => 0n),
    tokenBalance(conn, DROPS_FUND).catch(() => 0n),
    db
      .select({ kind: moneyEvents.kind, total: sql<string>`coalesce(sum(${moneyEvents.amountMicro}), 0)`, count: sql<number>`count(*)::int` })
      .from(moneyEvents)
      .where(eq(moneyEvents.cluster, SOLANA_CLUSTER))
      .groupBy(moneyEvents.kind),
    db
      .select()
      .from(moneyEvents)
      .where(and(eq(moneyEvents.cluster, SOLANA_CLUSTER), inArray(moneyEvents.kind, ['gave', 'fundedDrop', 'unlocked', 'refunded', 'returnedToFund', 'feesSplit', 'meteoraFeesClaimed'])))
      .orderBy(desc(moneyEvents.slot))
      .limit(60),
    db.select().from(spending).where(eq(spending.cluster, SOLANA_CLUSTER)).orderBy(desc(spending.spentAt)),
    db
      .select({ n: sql<number>`count(*)::int`, usd: sql<string>`coalesce(sum(${trades.usdMicro}), 0)`, fees: sql<string>`coalesce(sum(${trades.feeMicro}), 0)` })
      .from(trades)
      .where(and(eq(trades.cluster, SOLANA_CLUSTER), eq(trades.status, 'confirmed'))),
    db
      .select({ total: sql<string>`coalesce(sum(${moneyEvents.amountMicro}), 0)` })
      .from(moneyEvents)
      .where(and(eq(moneyEvents.cluster, SOLANA_CLUSTER), eq(moneyEvents.kind, 'meteoraFeesClaimed'))),
  ])
  const sum = (kind: string) => Number(totals.find((t) => t.kind === kind)?.total ?? 0) / 1e6
  const count = (kind: string) => totals.find((t) => t.kind === kind)?.count ?? 0
  const all = await listDrops()
  return {
    cluster: SOLANA_CLUSTER,
    totals: {
      cameIn: sum('gave'),
      gifts: count('gave'),
      inPots: all.reduce((s, d) => s + (d.state === 'unlocked' ? 0 : d.potUsd), 0),
      unlocked: sum('unlocked'),
      refunded: sum('refunded'),
      feesSplit: sum('feesSplit'),
      umanitySpent: spent.reduce((s, r) => s + r.amountMicro / 1e6, 0),
    },
    fees: {
      split: config ? usd(config.feesSplit) : 0,
      toDrops: config ? usd(config.fundIn) : 0,
      toOps: config ? usd(config.opsOut) : 0,
      fundBalance: usd(fund),
      fundIntoPots: config ? usd(config.fundOut) : 0,
      fundReturned: config ? usd(config.fundBack) : 0,
      inboxWaiting: usd(inbox),
      /** Of the fees split, how much came from $UMANITY's Meteora pool. */
      fromToken: Number(claimed[0]?.total ?? 0) / 1e6,
    },
    swaps: { count: swaps[0]?.n ?? 0, volumeUsd: Number(swaps[0]?.usd ?? 0) / 1e6, feesUsd: Number(swaps[0]?.fees ?? 0) / 1e6 },
    config: config && {
      admin: config.admin,
      releaseAuthority: config.releaseAuthority,
      releaseLocked: config.releaseLocked,
      ops: config.ops,
      maxPotUsd: usd(config.maxPot),
      reviewHours: config.reviewSecs / 3600,
    },
    addresses: { program: UMANITY_PROGRAM_ID.toBase58(), config: CONFIG.toBase58(), feeInbox: FEE_INBOX.toBase58(), dropsFund: DROPS_FUND.toBase58() },
    drops: all,
    recent: recent.map((e) => ({ id: e.id, kind: e.kind, dropId: e.dropId, amountUsd: e.amountMicro == null ? null : e.amountMicro / 1e6, party: e.party, signature: e.signature, at: e.blockTime?.toISOString() ?? null })),
    spending: spent.map((r) => ({ id: r.id, at: r.spentAt.toISOString(), amountUsd: r.amountMicro / 1e6, category: r.category, description: r.description, receiptUrl: r.receiptUrl, tx: r.txSignature, dropId: r.dropId })),
  }
}
export type MoneySummary = Awaited<ReturnType<typeof moneySummary>>
