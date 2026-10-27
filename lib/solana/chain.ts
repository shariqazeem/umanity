/**
 * Server-side Solana readers (no wallet). Used to verify client-reported
 * transactions against the chain and to sync pool state.
 */
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { SOLANA_RPC } from './constants'
import { DONATIONS_PROGRAM, findPoolPDA, findVaultPDA, findCampaignPDA } from './pda'

let _conn: Connection | null = null
export function getConnection(): Connection {
  if (!_conn) _conn = new Connection(SOLANA_RPC, 'confirmed')
  return _conn
}

export interface OnChainPool {
  authority: string
  name: string
  description: string
  emoji: string
  poolType: number
  totalDonated: number // lamports
  donorCount: number
  isActive: boolean
  vaultBalance: number // lamports
  poolPda: string
  vaultPda: string
  campaignPda: string
  hasCampaign: boolean
}

function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset)
  return [buf.subarray(offset + 4, offset + 4 + len).toString('utf8'), offset + 4 + len]
}

/** Decodes a Pool account without the IDL (layout is stable since v1). */
export function decodePool(data: Buffer) {
  let o = 8
  const authority = new PublicKey(data.subarray(o, o + 32)).toBase58()
  o += 32
  let name: string, description: string, emoji: string
  ;[name, o] = readString(data, o)
  ;[description, o] = readString(data, o)
  ;[emoji, o] = readString(data, o)
  const poolType = data.readUInt8(o)
  o += 1
  const totalDonated = Number(data.readBigUInt64LE(o))
  o += 8
  const donorCount = Number(data.readBigUInt64LE(o))
  o += 8
  const isActive = data.readUInt8(o) === 1
  return { authority, name, description, emoji, poolType, totalDonated, donorCount, isActive }
}

export async function readPool(poolId: string): Promise<OnChainPool | null> {
  const conn = getConnection()
  const [poolPda] = findPoolPDA(poolId)
  const [vaultPda] = findVaultPDA(poolPda)
  const [campaignPda] = findCampaignPDA(poolPda)
  const [pi, vi, ci] = await conn.getMultipleAccountsInfo([poolPda, vaultPda, campaignPda])
  if (!pi) return null
  const p = decodePool(pi.data as Buffer)
  return { ...p, vaultBalance: vi?.lamports ?? 0, poolPda: poolPda.toBase58(), vaultPda: vaultPda.toBase58(), campaignPda: campaignPda.toBase58(), hasCampaign: !!ci }
}

export async function readPools(poolIds: string[]): Promise<Record<string, OnChainPool | null>> {
  const out: Record<string, OnChainPool | null> = {}
  await Promise.all(poolIds.map(async (id) => (out[id] = await readPool(id).catch(() => null))))
  return out
}

export interface VerifiedDonation {
  signature: string
  donor: string
  poolPda: string
  amountLamports: number
  blockTime: number | null
  slot: number
}

/**
 * Confirms that `signature` is a finalized/confirmed transaction that invoked
 * the donations program and moved `lamports` from `donor` into the vault of
 * `poolId`. Returns null if anything does not line up.
 */
export async function verifyDonationTx(signature: string, expected: { donor: string; poolId: string; minLamports?: number }): Promise<VerifiedDonation | null> {
  const conn = getConnection()
  const tx = await conn.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
  if (!tx || tx.meta?.err) return null
  const [poolPda] = findPoolPDA(expected.poolId)
  const [vaultPda] = findVaultPDA(poolPda)
  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses }).staticAccountKeys.map((k) => k.toBase58())
  const programInvoked = keys.includes(DONATIONS_PROGRAM.toBase58())
  if (!programInvoked) return null
  const vaultIdx = keys.indexOf(vaultPda.toBase58())
  const donorIdx = keys.indexOf(expected.donor)
  if (vaultIdx < 0 || donorIdx < 0) return null
  const pre = tx.meta!.preBalances
  const post = tx.meta!.postBalances
  const vaultDelta = post[vaultIdx] - pre[vaultIdx]
  if (vaultDelta <= 0) return null
  if (expected.minLamports && vaultDelta < expected.minLamports) return null
  return { signature, donor: expected.donor, poolPda: poolPda.toBase58(), amountLamports: vaultDelta, blockTime: tx.blockTime ?? null, slot: tx.slot }
}

/** Generic: does this signature exist, succeed, and credit `to` by at least `minLamports`? */
export async function verifyTransfer(signature: string, to: string, minLamports: number): Promise<{ from: string; lamports: number } | null> {
  const conn = getConnection()
  const tx = await conn.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
  if (!tx || tx.meta?.err) return null
  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses }).staticAccountKeys.map((k) => k.toBase58())
  const toIdx = keys.indexOf(to)
  if (toIdx < 0) return null
  const delta = tx.meta!.postBalances[toIdx] - tx.meta!.preBalances[toIdx]
  if (delta < minLamports) return null
  return { from: keys[0], lamports: delta }
}

export async function getBalanceSol(address: string): Promise<number> {
  const conn = getConnection()
  const lamports = await conn.getBalance(new PublicKey(address), 'confirmed')
  return lamports / LAMPORTS_PER_SOL
}

/** Count DonationRecord accounts for the program (both v1 keypair records and v2 PDA records share the layout). */
export async function countDonationRecords(): Promise<number> {
  const conn = getConnection()
  const accounts = await conn.getProgramAccounts(DONATIONS_PROGRAM, { filters: [{ dataSize: 8 + 32 + 32 + 8 + 8 + 1 }], dataSlice: { offset: 0, length: 0 } })
  return accounts.length
}

export interface OnChainDonationRecord {
  address: string
  donor: string
  pool: string
  amount: number
  timestamp: number
  donationType: number
}

export async function listDonationRecords(limit = 200): Promise<OnChainDonationRecord[]> {
  const conn = getConnection()
  const accounts = await conn.getProgramAccounts(DONATIONS_PROGRAM, { filters: [{ dataSize: 8 + 32 + 32 + 8 + 8 + 1 }] })
  return accounts
    .map((a) => {
      const d = a.account.data as Buffer
      return {
        address: a.pubkey.toBase58(),
        donor: new PublicKey(d.subarray(8, 40)).toBase58(),
        pool: new PublicKey(d.subarray(40, 72)).toBase58(),
        amount: Number(d.readBigUInt64LE(72)),
        timestamp: Number(d.readBigInt64LE(80)),
        donationType: d.readUInt8(88),
      }
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}

export interface OnChainCampaign {
  pool: string
  authority: string
  recipient: string
  targetAmount: number
  totalRaised: number
  donorCount: number
  milestoneCount: number
  milestonesCompleted: number
  deadline: number
  isActive: boolean
}

export function decodeCampaign(data: Buffer): OnChainCampaign {
  let o = 8
  const pool = new PublicKey(data.subarray(o, o + 32)).toBase58()
  o += 32
  const authority = new PublicKey(data.subarray(o, o + 32)).toBase58()
  o += 32
  const recipient = new PublicKey(data.subarray(o, o + 32)).toBase58()
  o += 32
  const targetAmount = Number(data.readBigUInt64LE(o))
  o += 8
  const totalRaised = Number(data.readBigUInt64LE(o))
  o += 8
  const donorCount = Number(data.readBigUInt64LE(o))
  o += 8
  const milestoneCount = data.readUInt8(o)
  o += 1
  const milestonesCompleted = data.readUInt8(o)
  o += 1
  const deadline = Number(data.readBigInt64LE(o))
  o += 8
  const isActive = data.readUInt8(o) === 1
  return { pool, authority, recipient, targetAmount, totalRaised, donorCount, milestoneCount, milestonesCompleted, deadline, isActive }
}

export async function readCampaign(poolId: string): Promise<OnChainCampaign | null> {
  const conn = getConnection()
  const [poolPda] = findPoolPDA(poolId)
  const [campaignPda] = findCampaignPDA(poolPda)
  const info = await conn.getAccountInfo(campaignPda, 'confirmed')
  if (!info) return null
  return decodeCampaign(info.data as Buffer)
}

export interface OnChainMilestone {
  index: number
  description: string
  percentage: number
  status: number
  approvedAt: number
  releasedAt: number
  amountReleased: number
  attestationHash: string
  attestationConfidence: number
  attestedAt: number
}

export function decodeMilestone(data: Buffer): OnChainMilestone {
  let o = 8 + 32
  const index = data.readUInt8(o)
  o += 1
  const len = data.readUInt32LE(o)
  const description = data.subarray(o + 4, o + 4 + len).toString('utf8')
  o += 4 + len
  const percentage = data.readUInt8(o)
  o += 1
  const status = data.readUInt8(o)
  o += 1
  const approvedAt = Number(data.readBigInt64LE(o))
  o += 8
  const releasedAt = Number(data.readBigInt64LE(o))
  o += 8
  const amountReleased = Number(data.readBigUInt64LE(o))
  o += 8
  const attestationHash = data.subarray(o, o + 32).toString('hex')
  o += 32
  const attestationConfidence = data.readUInt8(o)
  o += 1
  const attestedAt = Number(data.readBigInt64LE(o))
  return { index, description, percentage, status, approvedAt, releasedAt, amountReleased, attestationHash, attestationConfidence, attestedAt }
}
