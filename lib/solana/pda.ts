import { PublicKey } from '@solana/web3.js'
import { UMANITY_DONATIONS_PROGRAM_ID, UMANITY_TIPS_PROGRAM_ID } from './constants'

export const DONATIONS_PROGRAM = new PublicKey(UMANITY_DONATIONS_PROGRAM_ID)
export const TIPS_PROGRAM = new PublicKey(UMANITY_TIPS_PROGRAM_ID)

export function findPoolPDA(poolSeed: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('pool'), Buffer.from(poolSeed)], DONATIONS_PROGRAM)
}
export function findVaultPDA(pool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('vault'), pool.toBuffer()], DONATIONS_PROGRAM)
}
export function findCampaignPDA(pool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('campaign'), pool.toBuffer()], DONATIONS_PROGRAM)
}
export function findMilestonePDA(campaign: PublicKey, index: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('milestone'), campaign.toBuffer(), Buffer.from([index])], DONATIONS_PROGRAM)
}
export function findUserProfilePDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('user'), owner.toBuffer()], TIPS_PROGRAM)
}
/** Dare escrow PDA (program v2). */
export function findDarePDA(creator: PublicKey, nonce: bigint | number): [PublicKey, number] {
  const n = Buffer.alloc(8)
  n.writeBigUInt64LE(BigInt(nonce))
  return PublicKey.findProgramAddressSync([Buffer.from('dare'), creator.toBuffer(), n], DONATIONS_PROGRAM)
}
export function findDareVaultPDA(dare: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('dare_vault'), dare.toBuffer()], DONATIONS_PROGRAM)
}

export function derivePoolAddresses(poolId: string) {
  const [poolPda] = findPoolPDA(poolId)
  const [vaultPda] = findVaultPDA(poolPda)
  const [campaignPda] = findCampaignPDA(poolPda)
  return { poolPda: poolPda.toBase58(), vaultPda: vaultPda.toBase58(), campaignPda: campaignPda.toBase58() }
}
