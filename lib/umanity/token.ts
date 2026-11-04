/**
 * $UMANITY as the app shows it, read from its Meteora DBC pool: price, market
 * cap, progress to graduation, and the trading fees owed to the program.
 * Null until the token exists (NEXT_PUBLIC_UMANITY_MINT and UMANITY_DBC_POOL). Server-only.
 */
import type { Connection } from '@solana/web3.js'
import { DynamicBondingCurveClient, TokenDecimal, getPriceFromSqrtPrice } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { UMANITY_SUPPLY } from '@/lib/token/curve'

type PoolState = { sqrtPrice: { toString(): string }; quoteReserve: { toString(): string }; partnerQuoteFee: { toString(): string }; isMigrated: number | boolean }

export async function tokenSummary(conn: Connection) {
  const pool = process.env.UMANITY_DBC_POOL
  const mint = process.env.NEXT_PUBLIC_UMANITY_MINT
  if (!pool || !mint) return null
  const client = new DynamicBondingCurveClient(conn, 'confirmed')
  // SDK 2.0 returns { poolState } despite its typings.
  const raw = (await client.state.getPool(pool)) as unknown as { poolState?: PoolState } | PoolState | null
  const st = raw && 'poolState' in raw ? raw.poolState : (raw as PoolState | null)
  if (!st) return null
  const [progress, threshold] = await Promise.all([client.state.getPoolQuoteTokenCurveProgress(pool), client.state.getPoolMigrationQuoteThreshold(pool)])
  const price = Number(getPriceFromSqrtPrice(st.sqrtPrice as never, TokenDecimal.SIX, 6).toString())
  return {
    mint,
    pool,
    priceUsd: price,
    marketCapUsd: price * UMANITY_SUPPLY,
    raisedUsd: Number(st.quoteReserve.toString()) / 1e6,
    graduateAtUsd: Number(threshold.toString()) / 1e6,
    progress: Math.min(1, Math.max(0, progress)),
    graduated: !!st.isMigrated,
    feesOwedUsd: Number(st.partnerQuoteFee.toString()) / 1e6,
  }
}
export type TokenSummary = NonNullable<Awaited<ReturnType<typeof tokenSummary>>>
