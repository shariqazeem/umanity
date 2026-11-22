/**
 * Keeps money moving without anyone pressing a button. Once the fee inbox
 * holds a dollar it is split (half to drops, half to Umanity); once
 * $UMANITY's Meteora pool owes a dollar in trading fees they are claimed and
 * split in the same step; when a drop misses its date its backers are
 * refunded and any fund money in its pot goes back to the fund; and cross-chain gifts that arrived while nobody was watching are
 * put into their pots, and the drops fund pours into the drop that closes
 * soonest. The first three are permissionless instructions where
 * the treasury only pays the network fee. Runs from page reads, at most every few minutes per server
 * process. Server-only.
 */
import { ComputeBudgetProgram, type Connection, PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { getAuthorityKeypair, getTreasuryKeypair } from '@/lib/solana/server-signer'
import { PRIORITY_MICROLAMPORTS, sendAndLand } from '@/lib/solana/send'
import { IS_MAINNET } from '@/lib/solana/constants'
import { and, eq, gt } from 'drizzle-orm'
import { circles, drops, getDb } from '@/lib/db'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { DROPS_FUND, FEE_INBOX, fetchConfig, fetchDrop, fetchDrops, fundDropIx, potAddress, refundsOpen, returnToFundIx, splitFeesIxs, sweepMeteoraFeesIxs, tokenBalance } from './program'
import { refundBackers } from './admin'
import { isCirclesOn, mintPendingCircles, thawCircles } from './circles'
import { reconcileDropIntents } from './intents'

const EVERY_MS = 5 * 60_000
const MIN_MICRO = 1_000_000n
let last = 0

export async function keepFeesMoving(conn: Connection) {
  if (Date.now() - last < EVERY_MS) return null
  last = Date.now()
  const payer = getTreasuryKeypair()
  const config = payer && (await fetchConfig(conn).catch(() => null))
  if (!payer || !config) return null
  const ops = new PublicKey(config.ops)

  let ixs: TransactionInstruction[] = []
  const pool = process.env.UMANITY_DBC_POOL
  if (pool) {
    const state = ((await new DynamicBondingCurveClient(conn, 'confirmed').state.getPool(new PublicKey(pool)).catch(() => null)) as { poolState?: Record<string, { toString(): string } & PublicKey> } | null)?.poolState
    if (state && BigInt(state.partnerQuoteFee.toString()) >= MIN_MICRO) {
      ixs = await sweepMeteoraFeesIxs(conn, { ops, payer: payer.publicKey, dbcConfig: state.config, pool: new PublicKey(pool), baseMint: state.baseMint, baseVault: state.baseVault, quoteVault: state.quoteVault })
    }
  }
  if (!ixs.length && (await tokenBalance(conn, FEE_INBOX).catch(() => 0n)) >= MIN_MICRO) ixs = await splitFeesIxs(conn, { ops, payer: payer.publicKey })
  await refundMissedDrops(conn)
  await reconcileDropIntents(conn).catch((e) => console.warn('[keeper] cross-chain gifts failed:', (e as Error).message))
  await fundNextDrop(conn).catch((e) => console.warn('[keeper] funding a drop failed:', (e as Error).message))
  await keepCirclesMoving().catch((e) => console.warn('[keeper] circles failed:', (e as Error).message))
  if (!ixs.length) return null

  const tx = new Transaction()
  if (IS_MAINNET) tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }))
  tx.add(...ixs)
  tx.feePayer = payer.publicKey
  const latest = await conn.getLatestBlockhash('confirmed')
  tx.recentBlockhash = latest.blockhash
  tx.sign(payer)
  try {
    return (await sendAndLand(conn, tx.serialize(), { lastValidBlockHeight: latest.lastValidBlockHeight, timeoutMs: 30_000 })).signature
  } catch (e) {
    console.warn('[keeper] fee step failed:', (e as Error).message)
    return null
  }
}

/**
 * The drops fund pours into the open drop that closes soonest, up to the room in its pot, once it holds a
 * dollar. Fee money then lands in a real pot without anyone choosing where, and if that drop misses its
 * date the program sends it back to the fund (return_to_fund), never to a person. fund_drop needs the admin.
 */
export async function fundNextDrop(conn: Connection): Promise<string | null> {
  const admin = getAuthorityKeypair()
  const config = admin && (await fetchConfig(conn).catch(() => null))
  if (!admin || !config || config.admin !== admin.publicKey.toBase58()) return null
  const fund = await tokenBalance(conn, DROPS_FUND).catch(() => 0n)
  if (fund < MIN_MICRO) return null
  const now = Date.now() / 1000
  // Umanity's own drops come first, then community drops; within each, the one that closes soonest.
  const db = await getDb()
  const community = new Set((await db.select({ id: drops.id }).from(drops).where(and(eq(drops.cluster, SOLANA_CLUSTER), eq(drops.kind, 'community')))).map((r) => r.id))
  const open = (await fetchDrops(conn))
    .filter((d) => d.state === 'open' && d.deadline - now > 3600)
    .sort((a, b) => Number(community.has(a.id)) - Number(community.has(b.id)) || a.deadline - b.deadline)
  for (const d of open) {
    const room = d.cap - (await tokenBalance(conn, new PublicKey(d.pot)))
    const amount = fund < room ? fund : room
    if (amount <= 0n) continue
    const tx = new Transaction()
    if (IS_MAINNET) tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }))
    tx.add(await fundDropIx(conn, { dropId: d.id, admin: admin.publicKey, amount }))
    tx.feePayer = admin.publicKey
    const latest = await conn.getLatestBlockhash('confirmed')
    tx.recentBlockhash = latest.blockhash
    tx.sign(admin)
    return (await sendAndLand(conn, tx.serialize(), { lastValidBlockHeight: latest.lastValidBlockHeight, timeoutMs: 30_000 })).signature
  }
  return null
}

/** Backers of a drop that missed its date (or was called off) get their money back without asking. */
async function refundMissedDrops(conn: Connection) {
  const db = await getDb()
  const rows = await db
    .select({ id: drops.id, state: drops.state, deadline: drops.deadline })
    .from(drops)
    .where(and(eq(drops.cluster, SOLANA_CLUSTER), gt(drops.potMicro, 0)))
  for (const d of rows) {
    if (!refundsOpen({ state: d.state as 'open', deadline: Math.floor(d.deadline.getTime() / 1000) })) continue
    await refundBackers(conn, d.id, 6).catch((e) => console.warn('[keeper] refunds failed:', (e as Error).message))
    await returnSpareToFund(conn, d.id).catch((e) => console.warn('[keeper] return to fund failed:', (e as Error).message))
  }
}

/**
 * What a missed drop's pot holds beyond what its backers are owed (money from the drops fund, plain
 * transfers) goes back to the fund through the permissionless return_to_fund. The treasury only pays the
 * network fee, and the money never leaves the program.
 */
async function returnSpareToFund(conn: Connection, dropId: number) {
  const payer = getTreasuryKeypair()
  const drop = payer && (await fetchDrop(conn, dropId))
  if (!payer || !drop || !refundsOpen(drop)) return null
  const pot = await tokenBalance(conn, potAddress(dropId))
  if (pot - (drop.given - drop.refunded) <= 0n) return null
  const tx = new Transaction()
  if (IS_MAINNET) tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }))
  tx.add(await returnToFundIx(conn, { dropId }))
  tx.feePayer = payer.publicKey
  const latest = await conn.getLatestBlockhash('confirmed')
  tx.recentBlockhash = latest.blockhash
  tx.sign(payer)
  return (await sendAndLand(conn, tx.serialize(), { lastValidBlockHeight: latest.lastValidBlockHeight, timeoutMs: 30_000 })).signature
}

/**
 * Circles that have a number get minted; and once the first filmed drop has paid out, every Circle
 * thaws for good, so its holder can keep it or sell it.
 */
async function keepCirclesMoving() {
  if (!isCirclesOn()) return
  await mintPendingCircles()
  const db = await getDb()
  const delivered = await db.select({ id: drops.id }).from(drops).where(and(eq(drops.cluster, SOLANA_CLUSTER), eq(drops.state, 'unlocked'))).limit(1)
  if (!delivered.length) return
  const stillFrozen = await db.select({ n: circles.number }).from(circles).where(and(eq(circles.cluster, SOLANA_CLUSTER), eq(circles.frozen, true))).limit(1)
  if (stillFrozen.length) await thawCircles()
}
