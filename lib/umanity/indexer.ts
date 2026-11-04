/**
 * Indexes program v3 into the database: every event into `money_events`,
 * every gift into `drop_gifts` (confirming the ones the app recorded as
 * pending), and each drop's live numbers into `drops`. Server-only.
 *
 * Resumes from the newest signature it has seen, so it is cheap to run on
 * every page load that needs fresh numbers and from a cron.
 */
import type { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { and, eq, sql } from 'drizzle-orm'
import { dropGifts, drops, getDb, moneyEvents, syncState, users } from '@/lib/db'
import { bumpStreak } from '@/lib/data/users'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { UMANITY_PROGRAM_ID, fetchDrops, parseEvents, potAddress, tokenBalance, type UmanityEvent } from './program'

const CURSOR = `umanity-v3:${SOLANA_CLUSTER}:newest-signature`

/** PublicKey → base58, BN → string, byte arrays → hex, so events store as plain JSON. */
function plain(v: unknown): unknown {
  if (v instanceof PublicKey) return v.toBase58()
  if (BN.isBN(v)) return (v as BN).toString()
  if (Array.isArray(v)) {
    return v.every((x) => typeof x === 'number' && x >= 0 && x < 256) ? v.map((b) => b.toString(16).padStart(2, '0')).join('') : v.map(plain)
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
  return v
}

async function credit(address: string, amountMicro: number, at: Date) {
  const db = await getDb()
  const points = Math.max(1, Math.round(amountMicro / 100_000))
  await db
    .update(users)
    .set({ rewardPoints: sql`${users.rewardPoints} + ${points}`, donationCount: sql`${users.donationCount} + 1` })
    .where(eq(users.address, address))
  await bumpStreak(address, at).catch(() => {})
}

function amountOf(e: UmanityEvent): number | null {
  const d = e.data as Record<string, unknown>
  const v = d.amount ?? d.total ?? d.quote
  return BN.isBN(v) ? Number((v as BN).toString()) : null
}

function partyOf(e: UmanityEvent): string | null {
  const d = e.data as Record<string, unknown>
  const v = d.backer ?? d.payee ?? null
  return v instanceof PublicKey ? v.toBase58() : null
}

export type SyncResult = { signatures: number; events: number; drops: number }

let running: Promise<SyncResult> | null = null

/** One sync at a time per process; concurrent callers share it. */
export function syncChain(connection: Connection): Promise<SyncResult> {
  running ??= runSync(connection).finally(() => {
    running = null
  })
  return running
}

async function runSync(connection: Connection): Promise<SyncResult> {
  const db = await getDb()
  const chainDrops = await fetchDrops(connection)
  const idByAddress = new Map(chainDrops.map((d) => [d.address, d.id]))

  const until = (await db.select().from(syncState).where(eq(syncState.key, CURSOR)))[0]?.value
  const sigs: Awaited<ReturnType<Connection['getSignaturesForAddress']>> = []
  let before: string | undefined
  for (;;) {
    const page = await connection.getSignaturesForAddress(UMANITY_PROGRAM_ID, { before, until, limit: 1000 }, 'confirmed')
    sigs.push(...page)
    if (page.length < 1000) break
    before = page[page.length - 1].signature
  }
  sigs.reverse() // oldest first

  let events = 0
  for (const s of sigs) {
    if (s.err) continue
    const tx = await connection.getTransaction(s.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
    const parsed = parseEvents(tx?.meta?.logMessages ?? [])
    const blockTime = s.blockTime ? new Date(s.blockTime * 1000) : null
    for (const [i, e] of parsed.entries()) {
      const data = plain(e.data) as Record<string, unknown>
      const dropKey = typeof data.drop === 'string' ? data.drop : null
      const dropId = e.name === 'dropCreated' ? Number(data.id) : dropKey ? (idByAddress.get(dropKey) ?? null) : null
      const fresh = await db
        .insert(moneyEvents)
        .values({
          id: `${s.signature}:${i}`,
          cluster: SOLANA_CLUSTER,
          signature: s.signature,
          slot: s.slot,
          blockTime,
          kind: e.name,
          dropId,
          amountMicro: amountOf(e),
          party: partyOf(e),
          data,
        })
        .onConflictDoNothing()
        .returning()
      events++

      if (e.name === 'gave' && dropId !== null) {
        const ref = String(data.giftRef)
        const gift = await db
          .insert(dropGifts)
          .values({
            ref: /^0+$/.test(ref) ? `${s.signature}:${i}` : ref,
            cluster: SOLANA_CLUSTER,
            dropId,
            backer: String(data.backer),
            giver: String(data.giver),
            amountMicro: Number(data.amount),
            channel: 'wallet',
            status: 'confirmed',
            signature: s.signature,
            createdAt: blockTime ?? new Date(),
          })
          .onConflictDoUpdate({
            target: dropGifts.ref,
            set: { status: 'confirmed', signature: s.signature, amountMicro: Number(data.amount) },
          })
          .returning()
          .then((rows) => rows[0])
        // Credit the account once, when the event is first seen: 10 points a dollar, one gift, the streak.
        if (fresh.length && gift) await credit(gift.userId ?? gift.backer, Number(data.amount), blockTime ?? new Date())
      }
    }
  }
  if (sigs.length) {
    const newest = sigs[sigs.length - 1].signature
    await db
      .insert(syncState)
      .values({ key: CURSOR, value: newest })
      .onConflictDoUpdate({ target: syncState.key, set: { value: newest, updatedAt: new Date() } })
  }

  for (const d of chainDrops) {
    const pot = await tokenBalance(connection, potAddress(d.id))
    const unlockTx =
      d.state === 'unlocked'
        ? ((
            await db
              .select({ sig: moneyEvents.signature })
              .from(moneyEvents)
              .where(and(eq(moneyEvents.cluster, SOLANA_CLUSTER), eq(moneyEvents.kind, 'unlocked'), eq(moneyEvents.dropId, d.id)))
          )[0]?.sig ?? null)
        : null
    await db
      .update(drops)
      .set({
        state: d.state,
        potMicro: Number(pot),
        givenMicro: Number(d.given),
        fromFundMicro: Number(d.fromFund),
        refundedMicro: Number(d.refunded),
        unlockedMicro: Number(d.unlocked),
        backers: d.backers,
        proofHash: d.proofHash,
        proofAt: d.proofAt ? new Date(d.proofAt * 1000) : null,
        unlockedAt: d.unlockedAt ? new Date(d.unlockedAt * 1000) : null,
        unlockTx,
        lastSyncedAt: sql`now()`,
      })
      .where(and(eq(drops.cluster, SOLANA_CLUSTER), eq(drops.id, d.id)))
  }

  return { signatures: sigs.length, events, drops: chainDrops.length }
}
