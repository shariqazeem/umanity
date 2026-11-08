/**
 * One person's side of drops: what they gave, where it went, what came back,
 * and what their trades sent to drops. Server-only.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { dropGifts, drops, getDb, moneyEvents, trades } from '@/lib/db'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { dropView, freshen } from './data'
import { refundsOpen } from './program'

export async function backerProfile(address: string) {
  await freshen()
  const db = await getDb()
  const credited = sql`coalesce(${dropGifts.userId}, ${dropGifts.backer})`
  const [gifts, refunds, tradeRows] = await Promise.all([
    db
      .select({ ref: dropGifts.ref, dropId: dropGifts.dropId, amountMicro: dropGifts.amountMicro, signature: dropGifts.signature, channel: dropGifts.channel, createdAt: dropGifts.createdAt })
      .from(dropGifts)
      .where(and(eq(dropGifts.cluster, SOLANA_CLUSTER), eq(dropGifts.status, 'confirmed'), sql`${credited} = ${address}`))
      .orderBy(desc(dropGifts.createdAt))
      .limit(200),
    db
      .select({ dropId: moneyEvents.dropId, amountMicro: moneyEvents.amountMicro })
      .from(moneyEvents)
      .where(and(eq(moneyEvents.cluster, SOLANA_CLUSTER), eq(moneyEvents.kind, 'refunded'), eq(moneyEvents.party, address))),
    db
      .select({ n: sql<number>`count(*)::int`, usd: sql<string>`coalesce(sum(${trades.usdMicro}), 0)`, fees: sql<string>`coalesce(sum(${trades.feeMicro}), 0)` })
      .from(trades)
      .where(and(eq(trades.cluster, SOLANA_CLUSTER), eq(trades.address, address), eq(trades.status, 'confirmed'))),
  ])
  const ids = Array.from(new Set(gifts.map((g) => g.dropId)))
  const dropRows = ids.length ? await db.select().from(drops).where(and(eq(drops.cluster, SOLANA_CLUSTER), inArray(drops.id, ids))) : []
  const byId = new Map(dropRows.map((d) => [d.id, d]))

  const perDrop = new Map<number, { amountUsd: number; gifts: number; refundedUsd: number }>()
  for (const g of gifts) {
    const x = perDrop.get(g.dropId) ?? { amountUsd: 0, gifts: 0, refundedUsd: 0 }
    x.amountUsd += g.amountMicro / 1e6
    x.gifts += 1
    perDrop.set(g.dropId, x)
  }
  for (const r of refunds) if (r.dropId != null && perDrop.has(r.dropId)) perDrop.get(r.dropId)!.refundedUsd += (r.amountMicro ?? 0) / 1e6

  const backed = [...perDrop.entries()].flatMap(([id, x]) => {
    const d = byId.get(id)
    if (!d) return []
    const state = d.state as 'open' | 'proven' | 'unlocked' | 'cancelled'
    return [{ id, title: d.title, emoji: d.emoji, state, refundsOpen: refundsOpen({ state, deadline: Math.floor(d.deadline.getTime() / 1000) }), drop: dropView(d), ...x }]
  })
  const t = tradeRows[0] ?? { n: 0, usd: '0', fees: '0' }
  return {
    totals: {
      givenUsd: backed.reduce((s, d) => s + d.amountUsd, 0),
      gifts: gifts.length,
      drops: backed.length,
      deliveredUsd: backed.filter((d) => d.state === 'unlocked').reduce((s, d) => s + d.amountUsd, 0),
      refundedUsd: backed.reduce((s, d) => s + d.refundedUsd, 0),
      trades: t.n,
      tradedUsd: Number(t.usd) / 1e6,
      feesToDropsUsd: Number(t.fees) / 2e6,
    },
    drops: backed.sort((a, b) => b.id - a.id),
    gifts: gifts.map((g) => ({ ref: g.ref, dropId: g.dropId, title: byId.get(g.dropId)?.title ?? `Drop #${g.dropId + 1}`, emoji: byId.get(g.dropId)?.emoji ?? '🍲', amountUsd: g.amountMicro / 1e6, signature: g.signature, channel: g.channel, at: g.createdAt.toISOString() })),
  }
}
export type BackerProfile = Awaited<ReturnType<typeof backerProfile>>
