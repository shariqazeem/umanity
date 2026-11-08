/**
 * Keeps money moving without anyone pressing a button. Once the fee inbox
 * holds a dollar it is split (half to drops, half to Umanity); once
 * $UMANITY's Meteora pool owes a dollar in trading fees they are claimed and
 * split in the same step; when a drop misses its date its backers are
 * refunded; and cross-chain gifts that arrived while nobody was watching are
 * put into their pots. The first three are permissionless instructions where
 * the treasury only pays the network fee. Runs from page reads, at most every few minutes per server
 * process. Server-only.
 */
import { ComputeBudgetProgram, type Connection, PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { getTreasuryKeypair } from '@/lib/solana/server-signer'
import { IS_MAINNET } from '@/lib/solana/constants'
import { and, eq, gt } from 'drizzle-orm'
import { drops, getDb } from '@/lib/db'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { FEE_INBOX, fetchConfig, refundsOpen, splitFeesIxs, sweepMeteoraFeesIxs, tokenBalance } from './program'
import { refundBackers } from './admin'
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
  if (!ixs.length) return null

  const tx = new Transaction()
  if (IS_MAINNET) tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }))
  tx.add(...ixs)
  tx.feePayer = payer.publicKey
  tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash
  tx.sign(payer)
  try {
    return await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 })
  } catch (e) {
    console.warn('[keeper] fee step failed:', (e as Error).message)
    return null
  }
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
  }
}
