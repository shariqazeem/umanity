/**
 * Operations signed by the pool/campaign authority (server-side keypair).
 * Every call returns the transaction signature so the UI can link Solscan.
 */
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { createHash } from 'crypto'
import { getAuthorityProgram, getAuthorityKeypair } from './server-signer'
import { findPoolPDA, findVaultPDA, findCampaignPDA, findMilestonePDA, findDareVaultPDA } from './pda'
import { getConnection } from './chain'
import { getMilestone, setMilestoneStatus, upsertCampaign, getCampaignByPool } from '@/lib/data/governance'
import { getDare, resolveDare } from '@/lib/data/dares'
import { readDare } from './dare-chain'
import { UMANITY_TREASURY, LAMPORTS_PER_SOL, UMANITY_ORG_WALLET } from './constants'
import { syncPoolsFromChain } from './sync'
import { createPost } from '@/lib/data/social'
import { findUserByUsername } from '@/lib/data/users'
import { getCause } from '@/lib/causes'
import type { OracleAttestation } from '@/lib/db'

function requireProgram() {
  const program = getAuthorityProgram()
  const kp = getAuthorityKeypair()
  if (!program || !kp) throw new Error('Authority signer is not configured on this server (set UMANITY_AUTHORITY_KEYPAIR)')
  return { program, authority: kp }
}

/** Creates the on-chain campaign + milestone accounts for a pool (idempotent) and mirrors them in the DB. */
export async function createCampaignOnChain(input: { poolId: string; targetSol: number; deadlineDays: number; recipient?: string; milestones: { description: string; percentage: number }[] }) {
  const { program, authority } = requireProgram()
  const conn = getConnection()
  const [poolPda] = findPoolPDA(input.poolId)
  const [campaignPda] = findCampaignPDA(poolPda)
  const recipient = new PublicKey(input.recipient || UMANITY_ORG_WALLET)
  const deadline = Math.floor(Date.now() / 1000) + input.deadlineDays * 86_400
  let createSig: string | undefined
  const existing = await conn.getAccountInfo(campaignPda)
  if (!existing) {
    createSig = await program.methods
      .createCampaign(recipient, new BN(Math.round(input.targetSol * LAMPORTS_PER_SOL)), new BN(deadline), input.milestones.map((m) => m.description), Buffer.from(input.milestones.map((m) => m.percentage)))
      .accounts({ campaign: campaignPda, pool: poolPda, authority: authority.publicKey, systemProgram: SystemProgram.programId })
      .rpc()
  }
  const msPdas: string[] = []
  for (let i = 0; i < input.milestones.length; i++) {
    const [msPda] = findMilestonePDA(campaignPda, i)
    msPdas.push(msPda.toBase58())
    const info = await conn.getAccountInfo(msPda)
    if (!info) {
      await program.methods
        .initMilestone(i, input.milestones[i].description.slice(0, 100), input.milestones[i].percentage)
        .accounts({ milestone: msPda, campaign: campaignPda, authority: authority.publicKey, systemProgram: SystemProgram.programId })
        .rpc()
    }
  }
  const view = await upsertCampaign({
    poolId: input.poolId,
    recipient: recipient.toBase58(),
    targetLamports: Math.round(input.targetSol * LAMPORTS_PER_SOL),
    deadline: new Date(deadline * 1000),
    campaignPda: campaignPda.toBase58(),
    createTxSignature: createSig,
    milestones: input.milestones.map((m, i) => ({ ...m, milestonePda: msPdas[i] })),
  })
  return { campaign: view, createSignature: createSig ?? null }
}

/** Writes the oracle's attestation hash + confidence to the Milestone account. */
export async function attestMilestoneOnChain(milestoneId: string, attestation: OracleAttestation): Promise<string | null> {
  const m = await getMilestone(milestoneId)
  if (!m || !m.campaign.campaignPda) return null
  const program = getAuthorityProgram()
  const kp = getAuthorityKeypair()
  if (!program || !kp) return null
  const campaignPda = new PublicKey(m.campaign.campaignPda)
  const [msPda] = findMilestonePDA(campaignPda, m.index)
  const hash = createHash('sha256').update(attestation.attestationHash).digest()
  try {
    return await program.methods
      .attestMilestone(Array.from(hash), Math.round(attestation.confidence))
      .accounts({ milestone: msPda, campaign: campaignPda, authority: kp.publicKey })
      .rpc()
  } catch (e) {
    console.error('attest on-chain failed', e)
    return null
  }
}

/** approve_milestone + release_milestone_funds for a milestone whose proposal passed. */
export async function releaseMilestoneOnChain(milestoneId: string): Promise<{ signature: string; amount: number; recipient: string }> {
  const { program, authority } = requireProgram()
  const m = await getMilestone(milestoneId)
  if (!m) throw new Error('Milestone not found')
  if (m.status !== 'approved') throw new Error(`Milestone is ${m.status}; a passed fund-release vote is required first`)
  const campaignPdaStr = m.campaign.campaignPda
  if (!campaignPdaStr) throw new Error('Campaign is not on-chain yet')
  const campaignPda = new PublicKey(campaignPdaStr)
  const [poolPda] = findPoolPDA(m.campaign.poolId)
  const [vaultPda] = findVaultPDA(poolPda)
  const [msPda] = findMilestonePDA(campaignPda, m.index)
  const recipient = new PublicKey(m.campaign.recipient)
  const conn = getConnection()

  // approve if still pending on-chain
  const msInfo = await conn.getAccountInfo(msPda)
  if (!msInfo) throw new Error('Milestone account missing on-chain')
  const statusOffset = 8 + 32 + 1 + 4 + msInfo.data.readUInt32LE(8 + 32 + 1) + 1
  const onchainStatus = msInfo.data.readUInt8(statusOffset)
  if (onchainStatus === 2) throw new Error('Milestone already released on-chain')
  if (onchainStatus === 0) {
    await program.methods.approveMilestone().accounts({ milestone: msPda, campaign: campaignPda, authority: authority.publicKey }).rpc()
  }
  const before = await conn.getBalance(recipient)
  const signature = await program.methods
    .releaseMilestoneFunds()
    .accounts({ milestone: msPda, campaign: campaignPda, pool: poolPda, poolVault: vaultPda, recipient, authority: authority.publicKey, systemProgram: SystemProgram.programId })
    .rpc()
  const after = await conn.getBalance(recipient)
  const amount = (after - before) / LAMPORTS_PER_SOL
  await setMilestoneStatus(milestoneId, 'released', { releaseTxSignature: signature })
  const cause = getCause(m.campaign.poolId)
  await createPost(authority.publicKey.toBase58(), `Escrow released: ${amount.toFixed(3)} SOL for "${m.description}" (${cause?.emoji ?? ''} ${cause?.name ?? m.campaign.poolId}) after a passed community vote. Delivery proof follows.`, 'proof', { milestoneId, poolId: m.campaign.poolId, amount: amount.toFixed(3) }, signature).catch(() => {})
  syncPoolsFromChain(5000).catch(() => {})
  return { signature, amount, recipient: recipient.toBase58() }
}

/** settle_dare: completed by authority (oracle) or expired by anyone. */
export async function settleDareOnChain(dareId: string, completed: boolean, proofPostId?: string): Promise<{ signature: string; completed: boolean; toCause: number }> {
  const { program, authority } = requireProgram()
  const dare = await getDare(dareId)
  if (!dare || !dare.darePda) throw new Error('Dare not found or not on-chain')
  if (dare.status !== 'open') throw new Error(`Dare is already ${dare.status}`)
  const onchain = await readDare(dare.darePda)
  if (!onchain) throw new Error('Dare account missing on-chain')
  const now = Math.floor(Date.now() / 1000)
  if (!completed && now < onchain.deadline) throw new Error('Dare has not expired yet')
  if (completed) {
    // Oracle check: when the target has a wallet on file, require a matching donation in-window.
    const target = await findUserByUsername(dare.targetHandle)
    if (target) {
      const { getDonationsByDonor } = await import('@/lib/data/donations')
      const dons = await getDonationsByDonor(target.address, 50)
      const matched = dons.find((d) => d.poolId === dare.poolId && d.createdAt.getTime() >= onchain.createdAt * 1000 && d.amountLamports >= Math.min(onchain.stake, 10_000_000))
      if (!matched) throw new Error(`@${dare.targetHandle} has not donated to ${dare.poolName} since the dare was created`)
    }
  }
  const darePda = new PublicKey(dare.darePda)
  const [dareVault] = findDareVaultPDA(darePda)
  const [poolPda] = findPoolPDA(dare.poolId)
  const [vaultPda] = findVaultPDA(poolPda)
  const signature = await program.methods
    .settleDare(completed)
    .accounts({ dare: darePda, dareVault, pool: poolPda, poolVault: vaultPda, treasury: new PublicKey(UMANITY_TREASURY), settler: authority.publicKey, systemProgram: SystemProgram.programId })
    .rpc()
  const toCause = (onchain.pot * (10_000 - 150)) / 10_000 / LAMPORTS_PER_SOL
  await resolveDare(dareId, completed ? 'completed' : 'expired', { resolveTxSignature: signature, proofPostId })
  await createPost(dare.creator.address, completed ? `✅ Dare completed by @${dare.targetHandle}. ${toCause.toFixed(3)} SOL moved from the dare pot into ${dare.poolEmoji} ${dare.poolName}'s escrow.` : `⏰ Dare for @${dare.targetHandle} expired. The ${toCause.toFixed(3)} SOL pot still went to ${dare.poolEmoji} ${dare.poolName}. The cause never loses.`, completed ? 'dare_accepted' : 'impact_dare', { dareId, settled: completed ? 'completed' : 'expired' }, signature).catch(() => {})
  syncPoolsFromChain(5000).catch(() => {})
  return { signature, completed, toCause }
}

export { getCampaignByPool }
