/**
 * The Hundred (Season 0). Each of the first 100 wallets from outside the team that gives to the fund
 * gets one Circle: a numbered, one-of-one artwork minted as a Metaplex Core asset in the Circles
 * collection. The collection's permanent freeze locks every Circle until the first filmed drop pays out ("the circle
 * closes when the film rolls"). After that it can be kept or sold; the collection's royalty sends a
 * share of every resale to the giving fund's royalty wallet.
 *
 * Each Circle is drawn by its own gift (lib/umanity/tally.ts): the cut turns to the hour it was given,
 * tally strokes count its number, and a notch marks every gift its giver has made. It is drawn once its
 * Circle is minted, so its holder sees it first, and anyone can redraw it from the record. Server-only.
 */
import { Keypair, PublicKey } from '@solana/web3.js'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { createNoopSigner, publicKey, type Instruction } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { fromWeb3JsKeypair, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters'
import { createSignerFromKeypair } from '@metaplex-foundation/umi'
import { approveCollectionPluginAuthority, create, fetchAssetV1, fetchCollection, mplCore, revokeCollectionPluginAuthority, updateCollectionPlugin } from '@metaplex-foundation/mpl-core'
import { circles, drops, fundGifts, getDb, type Circle } from '@/lib/db'
import { getConnection } from '@/lib/solana/chain'
import { getAuthorityKeypair, getTreasuryKeypair } from '@/lib/solana/server-signer'
import { signAndLand } from '@/lib/solana/send'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { isTeam } from './team'

export const CIRCLES_LIMIT = 100
/** The Circles collection on this cluster. Circles are off until it is set. */
export const CIRCLES_COLLECTION = process.env.NEXT_PUBLIC_CIRCLES_COLLECTION || ''
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.gives'

export const circleName = (n: number) => `Circle No. ${String(n).padStart(3, '0')}`
/** Season 1's colour, sampled from a frame of the first delivery film and published with it. Until then, none. */
export const SEASON_ONE_COLOUR = process.env.NEXT_PUBLIC_SEASON_ONE_COLOUR || null

/**
 * Gives the wallet its Circle number, once: team wallets and wallets that already hold one get
 * nothing new. Returns the number, or null when the hundred are taken or Circles are off.
 */
export async function claimCircle(owner: string, giftRef: string | null): Promise<number | null> {
  if (!CIRCLES_COLLECTION || isTeam(owner)) return null
  const db = await getDb()
  // The Hundred are the people who gave before there was anything to see: the season closes for good
  // once the first filmed drop pays out, even with fewer than a hundred (Circles minted after the thaw
  // would be born unlocked).
  if (await hundredClosed()) return null
  const mine = async () => (await db.select({ number: circles.number }).from(circles).where(and(eq(circles.cluster, SOLANA_CLUSTER), eq(circles.owner, owner))))[0]?.number ?? null
  const had = await mine()
  if (had != null) return had
  for (let attempt = 0; attempt < 6; attempt++) {
    const [row] = await db.select({ max: sql<number>`coalesce(max(${circles.number}), 0)::int` }).from(circles).where(eq(circles.cluster, SOLANA_CLUSTER))
    const next = (row?.max ?? 0) + 1
    if (next > CIRCLES_LIMIT) return null
    try {
      await db.insert(circles).values({ cluster: SOLANA_CLUSTER, number: next, owner, giftRef })
      return next
    } catch {
      // Someone took this number at the same moment, or this wallet just claimed one: look again.
      const now = await mine()
      if (now != null) return now
    }
  }
  return null
}

/** True once the first filmed drop has paid out: no new Circles after that. */
export async function hundredClosed() {
  const db = await getDb()
  const delivered = await db.select({ id: drops.id }).from(drops).where(and(eq(drops.cluster, SOLANA_CLUSTER), eq(drops.state, 'unlocked'))).limit(1)
  return delivered.length > 0
}

let umiCache: ReturnType<typeof createUmi> | null = null
function umi() {
  if (!umiCache) umiCache = createUmi(getConnection().rpcEndpoint).use(mplCore())
  return umiCache
}
let collectionCache: Awaited<ReturnType<typeof fetchCollection>> | null = null

async function mintOne(c: Circle, assetKp: Keypair) {
  const authority = getAuthorityKeypair()
  const payer = getTreasuryKeypair()
  if (!authority || !payer) throw new Error('No keys on this server can mint Circles')
  const u = umi()
  collectionCache ??= await fetchCollection(u, publicKey(CIRCLES_COLLECTION))
  const builder = create(
    { ...u, payer: createNoopSigner(publicKey(payer.publicKey.toBase58())), identity: createNoopSigner(publicKey(authority.publicKey.toBase58())) },
    {
      asset: createSignerFromKeypair(u, fromWeb3JsKeypair(assetKp)),
      collection: collectionCache,
      name: circleName(c.number),
      uri: `${APP}/api/circles/${c.number}`,
      owner: publicKey(c.owner),
      authority: createNoopSigner(publicKey(authority.publicKey.toBase58())),
      // No freeze of its own: the collection's permanent freeze locks every Circle until the first film.
    }
  )
  const ixs = builder.getInstructions().map((ix: Instruction) => toWeb3JsInstruction(ix))
  return signAndLand(getConnection(), ixs, [payer, authority, assetKp], { units: 120_000 })
}

/**
 * Mints every Circle that has a number but no asset yet. Safe to call from anywhere, often: each
 * Circle is taken by one worker at a time through a conditional update, and an attempt that timed
 * out is checked on-chain before anything is minted again.
 */
export async function mintPendingCircles(limit = 6) {
  if (!CIRCLES_COLLECTION) return 0
  const db = await getDb()
  const rows = await db
    .select()
    .from(circles)
    .where(and(eq(circles.cluster, SOLANA_CLUSTER), inArray(circles.status, ['assigned', 'minting', 'failed'])))
    .orderBy(asc(circles.number))
    .limit(limit)
  let done = 0
  for (const c of rows) {
    const where = and(eq(circles.cluster, SOLANA_CLUSTER), eq(circles.number, c.number))
    // An earlier attempt may have landed after its request gave up.
    if (c.asset && (await fetchAssetV1(umi(), publicKey(c.asset)).catch(() => null))) {
      await db.update(circles).set({ status: 'minted', mintedAt: new Date(), error: null }).where(where)
      done++
      continue
    }
    if (c.status === 'minting' && c.attemptedAt && Date.now() - c.attemptedAt.getTime() < 180_000) continue
    const assetKp = Keypair.generate()
    const taken = await db
      .update(circles)
      .set({ status: 'minting', asset: assetKp.publicKey.toBase58(), attemptedAt: new Date(), error: null })
      .where(and(where, eq(circles.status, c.status), c.attemptedAt ? eq(circles.attemptedAt, c.attemptedAt) : sql`${circles.attemptedAt} is null`))
      .returning()
    if (!taken.length) continue
    try {
      const signature = await mintOne(c, assetKp)
      await db.update(circles).set({ status: 'minted', signature, mintedAt: new Date(), error: null }).where(where)
      done++
    } catch (e) {
      await db.update(circles).set({ status: 'failed', error: (e as Error).message.slice(0, 300) }).where(where)
    }
  }
  return done
}

/**
 * Thaws the whole collection in one update, once: from then on every holder can keep their Circle or
 * sell it. Then the freeze authority is set to None, so no one can lock the Circles again.
 */
export async function thawCircles() {
  const authority = getAuthorityKeypair()
  const payer = getTreasuryKeypair()
  if (!CIRCLES_COLLECTION || !authority || !payer) return false
  const u = { ...umi(), payer: createNoopSigner(publicKey(payer.publicKey.toBase58())) }
  const signer = createNoopSigner(publicKey(authority.publicKey.toBase58()))
  const collection = await fetchCollection(umi(), publicKey(CIRCLES_COLLECTION))
  if (collection.permanentFreezeDelegate?.frozen) {
    const ixs = updateCollectionPlugin(u, { collection: publicKey(CIRCLES_COLLECTION), plugin: { type: 'PermanentFreezeDelegate', frozen: false }, authority: signer })
      .getInstructions()
      .map((ix: Instruction) => toWeb3JsInstruction(ix))
    await signAndLand(getConnection(), ixs, [payer, authority], { units: 60_000 })
  }
  // Then the freeze key is given up. When the server owns the collection it sets the freeze authority to
  // None itself, so no one can ever lock the Circles again (checked on devnet). When the founder's wallet
  // owns it, the server can only hand the key back to the owner, who signs the final "None" once.
  const freeze = collection.permanentFreezeDelegate
  const ownsCollection = collection.updateAuthority === authority.publicKey.toBase58()
  if (freeze && freeze.authority.type === 'Address' && freeze.authority.address === authority.publicKey.toBase58()) {
    const builder = ownsCollection
      ? approveCollectionPluginAuthority(u, { collection: publicKey(CIRCLES_COLLECTION), plugin: { type: 'PermanentFreezeDelegate' }, newAuthority: { type: 'None' }, authority: signer })
      : revokeCollectionPluginAuthority(u, { collection: publicKey(CIRCLES_COLLECTION), plugin: { type: 'PermanentFreezeDelegate' }, authority: signer })
    const ixs = builder.getInstructions().map((ix: Instruction) => toWeb3JsInstruction(ix))
    await signAndLand(getConnection(), ixs, [payer, authority], { units: 60_000 }).catch((e) => console.warn('[circles] could not give up the freeze authority:', (e as Error).message))
  }
  const db = await getDb()
  await db.update(circles).set({ frozen: false }).where(and(eq(circles.cluster, SOLANA_CLUSTER), eq(circles.frozen, true)))
  return true
}

export async function listCircles() {
  const db = await getDb()
  return db.select().from(circles).where(eq(circles.cluster, SOLANA_CLUSTER)).orderBy(asc(circles.number))
}

export async function getCircle(n: number) {
  const db = await getDb()
  return (await db.select().from(circles).where(and(eq(circles.cluster, SOLANA_CLUSTER), eq(circles.number, n))))[0] ?? null
}

/**
 * What each Circle is drawn from: its number, the moment its gift was confirmed, how many gifts its
 * giver has made to the fund (one notch each, up to nine; never the amount), and whether the first film
 * has rolled (open while locked, closed once thawed).
 */
export async function circleRecords(rows: Circle[]) {
  if (!rows.length) return new Map<number, { n: number; at: string; gifts: number; state: 'open' | 'closed' }>()
  const db = await getDb()
  const giver = sql<string>`coalesce(${fundGifts.userId}, ${fundGifts.giver})`
  const counts = await db
    .select({ owner: giver, k: sql<number>`count(*)::int` })
    .from(fundGifts)
    .where(and(eq(fundGifts.cluster, SOLANA_CLUSTER), eq(fundGifts.status, 'confirmed'), inArray(giver, rows.map((r) => r.owner))))
    .groupBy(giver)
  const byOwner = new Map(counts.map((c) => [c.owner, c.k]))
  return new Map(
    rows.map((r) => [
      r.number,
      { n: r.number, at: r.createdAt.toISOString(), gifts: Math.max(1, Math.min(byOwner.get(r.owner) ?? 1, 9)), state: (r.frozen ? 'open' : 'closed') as 'open' | 'closed' },
    ])
  )
}

export const isCirclesOn = () => !!CIRCLES_COLLECTION
export type { Circle }
export { PublicKey }
