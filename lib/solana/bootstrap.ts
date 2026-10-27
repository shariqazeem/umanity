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
import { SystemProgram } from '@solana/web3.js'
import { CAUSES, type CauseMeta } from '@/lib/causes'
import { getAuthorityProgram, getAuthorityKeypair } from './server-signer'
import { findPoolPDA, findVaultPDA, derivePoolAddresses } from './pda'
import { getConnection, readCampaign } from './chain'
import { LAMPORTS_PER_SOL } from './constants'
import { createCampaignOnChain } from './authority-ops'
import { ensurePools } from '@/lib/data/donations'
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
    steps.push({ poolId: cause.id, pool: pool.created ? 'created' : 'exists', poolSignature: pool.signature, campaign: camp.createSignature ? 'created' : 'exists', campaignSignature: camp.createSignature ?? undefined, targetSol })
  }
  await syncPoolsFromChain(15_000)
  return steps
}
