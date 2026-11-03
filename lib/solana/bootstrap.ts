/**
 * Bootstraps the on-chain state for every cause in lib/causes.ts, on whatever
 * cluster the server is configured for. Idempotent: run it on a fresh
 * deployment, after adding a cause, or after a mainnet program deploy.
 *
 *   1. initialize_pool  → Pool PDA + vault PDA   (skipped if it exists)
 *   2. create_campaign  → Campaign PDA           (skipped if it exists)
 *   3. init_milestone   → one Milestone PDA each (skipped if it exists)
 *   4. mirror pools + campaigns into the database
 */
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { eq } from 'drizzle-orm'
import { CAUSES, type CauseMeta } from '@/lib/causes'
import { getDb, campaigns } from '@/lib/db'
import { getAuthorityProgram, getAuthorityKeypair } from './server-signer'
import { findPoolPDA, findVaultPDA, derivePoolAddresses } from './pda'
import { getConnection, readCampaign, decodeMilestone } from './chain'
import { LAMPORTS_PER_SOL } from './constants'
import { createCampaignOnChain } from './authority-ops'
import { ensurePools } from '@/lib/data/donations'
import { getCampaignByPool, setMilestoneStatus } from '@/lib/data/governance'
import { syncPoolsFromChain } from './sync'

/** Read at call time: scripts load dotenv after this module is imported. */
export function campaignTargetScale(): number {
  const n = Number(process.env.CAMPAIGN_TARGET_SCALE || '1')
  return Number.isFinite(n) && n > 0 ? n : 1
}

export interface BootstrapStep {
  poolId: string
  pool: 'created' | 'exists'
  poolSignature?: string
  campaign: 'created' | 'exists'
  campaignSignature?: string
  targetSol: number
}

/** The pool PDA is seeded by the cause id, so the id is the on-chain `name`; display copy lives in lib/causes.ts. */
export async function initializePoolOnChain(cause: CauseMeta): Promise<{ created: boolean; signature?: string }> {
  const program = getAuthorityProgram()
  const authority = getAuthorityKeypair()
  if (!program || !authority) throw new Error('Authority signer is not configured (UMANITY_AUTHORITY_KEYPAIR)')
  const conn = getConnection()
  const [poolPda] = findPoolPDA(cause.id)
  const [vaultPda] = findVaultPDA(poolPda)
  const info = await conn.getAccountInfo(poolPda)
  if (info) return { created: false }
  const signature = await program.methods
    .initializePool(cause.id, cause.description.slice(0, 200), cause.emoji.slice(0, 10), cause.deliveryMode === 'field' ? 0 : 1)
    .accounts({ pool: poolPda, poolVault: vaultPda, authority: authority.publicKey, systemProgram: SystemProgram.programId })
    .rpc()
  return { created: true, signature }
}

export async function bootstrapCauses(log: (line: string) => void = () => {}): Promise<BootstrapStep[]> {
  const steps: BootstrapStep[] = []
  await ensurePools(derivePoolAddresses)
  for (const cause of CAUSES) {
    const pool = await initializePoolOnChain(cause)
    log(`${cause.id}: pool ${pool.created ? `created ${pool.signature?.slice(0, 12)}…` : 'exists'}`)
    // An existing on-chain campaign keeps its target: the database mirrors the chain, never the other way round.
    const onchain = await readCampaign(cause.id).catch(() => null)
    const targetSol = onchain ? onchain.targetAmount / LAMPORTS_PER_SOL : Math.max(0.1, cause.plan.targetSol * campaignTargetScale())
    const camp = await createCampaignOnChain({ poolId: cause.id, targetSol, deadlineDays: cause.plan.days, milestones: cause.plan.milestones })
    log(`${cause.id}: campaign ${camp.createSignature ? `created ${camp.createSignature.slice(0, 12)}…` : 'exists'} (target ${targetSol} SOL, ${cause.plan.milestones.length} milestones)`)
    await mirrorCampaignFromChain(cause.id, log)
    steps.push({ poolId: cause.id, pool: pool.created ? 'created' : 'exists', poolSignature: pool.signature, campaign: camp.createSignature ? 'created' : 'exists', campaignSignature: camp.createSignature ?? undefined, targetSol })
  }
  await syncPoolsFromChain(15_000)
  return steps
}

/** On-chain Milestone.status: 0 pending, 1 approved, 2 released, 3 rejected. */
const MILESTONE_STATUS: Record<number, string> = { 1: 'approved', 2: 'released', 3: 'rejected' }

/**
 * Copies what the program says about a campaign into its database row: the
 * recipient, deadline and raised total, and every milestone that has moved
 * on-chain. A fresh database then starts in step with the chain instead of
 * showing a released milestone as still being funded.
 */
async function mirrorCampaignFromChain(poolId: string, log: (line: string) => void) {
  const [onchain, view] = await Promise.all([readCampaign(poolId), getCampaignByPool(poolId)])
  if (!onchain || !view) return
  const db = await getDb()
  await db
    .update(campaigns)
    .set({ recipient: onchain.recipient, deadline: new Date(onchain.deadline * 1000), totalRaisedLamports: onchain.totalRaised, isActive: onchain.isActive })
    .where(eq(campaigns.id, view.id))
  const conn = getConnection()
  for (const m of view.milestones) {
    if (!m.milestonePda) continue
    const info = await conn.getAccountInfo(new PublicKey(m.milestonePda), 'confirmed')
    const status = info ? MILESTONE_STATUS[decodeMilestone(info.data as Buffer).status] : undefined
    if (!status || status === m.status) continue
    const releaseTxSignature = status === 'released' && !m.releaseTxSignature ? await findReleaseTx(m.milestonePda) : null
    await setMilestoneStatus(m.id, status, releaseTxSignature ? { releaseTxSignature } : {})
    log(`${poolId}: milestone ${m.index + 1} is ${status} on-chain${releaseTxSignature ? ` (release ${releaseTxSignature.slice(0, 12)}…)` : ''}`)
  }
}

/** The release_milestone_funds transaction that touched this milestone, if any. */
async function findReleaseTx(milestonePda: string): Promise<string | null> {
  const conn = getConnection()
  const sigs = await conn.getSignaturesForAddress(new PublicKey(milestonePda), { limit: 25 }, 'confirmed')
  for (const s of sigs) {
    if (s.err) continue
    const tx = await conn.getTransaction(s.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
    if (tx?.meta?.logMessages?.some((l) => l.includes('Instruction: ReleaseMilestoneFunds'))) return s.signature
  }
  return null
}
