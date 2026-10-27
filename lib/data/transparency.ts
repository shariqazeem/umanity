/** The public ledger (lib/contracts.ts: TransparencyReport). Every number comes from chain-synced rows or recorded receipts. */
import { eq, inArray, sql } from 'drizzle-orm'
import { getDb, donations, dares, intents, x402Receipts, routedTransfers } from '@/lib/db'
import { CAUSES, CAUSE_IDS } from '@/lib/causes'
import { getPools } from './donations'
import { getCampaigns } from './governance'
import { getFieldUpdates } from './field'
import { LAMPORTS_PER_SOL, SOLANA_CLUSTER, UMANITY_DONATIONS_PROGRAM_ID, UMANITY_TIPS_PROGRAM_ID, UMANITY_ORG_WALLET, UMANITY_TREASURY } from '@/lib/solana/constants'
import { CROSSCHAIN_VAULT } from '@/lib/intents/config'
import { INTEGRATOR_FEE_BPS } from '@/lib/intents/oneclick'
import { getAuthorityKeypair } from '@/lib/solana/server-signer'
import type { TransparencyReport } from '@/lib/contracts'

const DARE_FEE_BPS = 150
const ROUTING_FEE_BPS = 50

export async function getTransparencyReport(): Promise<TransparencyReport> {
  const db = await getDb()
  const [pools, campaigns, deliveries] = await Promise.all([getPools(), getCampaigns(), getFieldUpdates({ limit: 50 })])

  const [agg] = await db
    .select({
      donors: sql<number>`count(distinct ${donations.donorAddress})::int`,
      gifts: sql<number>`count(*)::int`,
      crossCount: sql<number>`coalesce(sum(case when ${donations.route} = 'intents' then 1 else 0 end), 0)::int`,
      crossLamports: sql<number>`coalesce(sum(case when ${donations.route} = 'intents' then ${donations.amountLamports} else 0 end), 0)::bigint`,
    })
    .from(donations)
    .where(inArray(donations.poolId, CAUSE_IDS))

  const settledDares = await db.select({ pot: dares.potLamports }).from(dares).where(inArray(dares.status, ['completed', 'expired']))
  const dareFeesSol = settledDares.reduce((s, d) => s + (d.pot * DARE_FEE_BPS) / 10_000, 0) / LAMPORTS_PER_SOL

  const settledIntents = await db.select({ quote: intents.quote, bps: intents.integratorFeeBps }).from(intents).where(eq(intents.status, 'success'))
  const intentsFeeUsd = settledIntents.reduce((s, i) => {
    const q = (i.quote ?? {}) as { quote?: { amountInUsd?: string | number }; amountInUsd?: string | number }
    const usd = Number(q.quote?.amountInUsd ?? q.amountInUsd ?? 0)
    return s + (isFinite(usd) ? (usd * (i.bps || INTEGRATOR_FEE_BPS)) / 10_000 : 0)
  }, 0)

  const [x] = await db.select({ n: sql<number>`count(*)::int`, usd: sql<string>`coalesce(sum((${x402Receipts.amount})::numeric), 0)::text` }).from(x402Receipts).where(eq(x402Receipts.status, 'settled'))
  const routed = await db.select({ amount: routedTransfers.amountLamports }).from(routedTransfers).where(eq(routedTransfers.status, 'completed'))
  const routingFeesSol = routed.reduce((s, r) => s + (r.amount * ROUTING_FEE_BPS) / 10_000, 0) / LAMPORTS_PER_SOL

  const vaults = pools.map((p) => ({
    poolId: p.id,
    name: p.name,
    vaultPda: p.vaultPda,
    poolPda: p.poolPda,
    balanceSol: p.vaultBalance,
    raisedSol: p.totalDonated,
    releasedSol: Math.max(0, p.totalDonated - p.vaultBalance),
    donorCount: p.donorCount,
    lastSyncedAt: p.lastSyncedAt,
  }))

  const releases: TransparencyReport['releases'] = []
  for (const c of campaigns) {
    if (!CAUSE_IDS.includes(c.pool_id)) continue
    for (const m of c.milestones) {
      if (m.status === 'released' || m.status === 'approved') {
        releases.push({ poolId: c.pool_id, poolName: c.poolName, milestoneIndex: m.index, description: m.description, amountSol: m.amount, txSignature: m.releaseTxSignature, attestation: m.attestation, status: m.status })
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    network: SOLANA_CLUSTER,
    programs: { donations: UMANITY_DONATIONS_PROGRAM_ID, tips: UMANITY_TIPS_PROGRAM_ID },
    wallets: { authority: getAuthorityKeypair()?.publicKey.toBase58() ?? '', treasury: UMANITY_TREASURY, orgWallet: UMANITY_ORG_WALLET, crossChainVault: CROSSCHAIN_VAULT },
    totals: {
      raisedSol: vaults.reduce((s, v) => s + v.raisedSol, 0),
      heldSol: vaults.reduce((s, v) => s + v.balanceSol, 0),
      releasedSol: vaults.reduce((s, v) => s + v.releasedSol, 0),
      donors: agg?.donors ?? 0,
      gifts: agg?.gifts ?? 0,
      crossChainGifts: agg?.crossCount ?? 0,
      crossChainSol: Number(agg?.crossLamports ?? 0) / LAMPORTS_PER_SOL,
      causes: CAUSES.length,
    },
    vaults,
    releases,
    deliveries,
    fees: {
      dareFeeBps: DARE_FEE_BPS,
      dareFeesSol,
      intentsFeeBps: INTEGRATOR_FEE_BPS,
      intentsFeeUsd,
      x402Calls: x?.n ?? 0,
      x402RevenueUsd: Number(x?.usd ?? 0),
      routingFeesSol,
    },
  }
}
