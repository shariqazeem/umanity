/**
 * Raw instruction builders for the v2 donations program. Used by Blinks,
 * server routes and the browser (no Anchor Provider needed).
 */
import { PublicKey, SystemProgram, TransactionInstruction, Connection } from '@solana/web3.js'
import { DONATIONS_PROGRAM, findPoolPDA, findVaultPDA, findCampaignPDA, findDarePDA, findDareVaultPDA } from './pda'

const encoder = new TextEncoder()

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  // WebCrypto exists in browsers and in Node >= 19 (globalThis.crypto)
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', buf))
}

/** Anchor instruction discriminator: sha256("global:<name>")[0..8]. */
export async function disc(name: string): Promise<Buffer> {
  const h = await sha256(encoder.encode(`global:${name}`))
  return Buffer.from(h.subarray(0, 8))
}

function u64(n: bigint | number): Buffer {
  const b = Buffer.alloc(8)
  b.writeBigUInt64LE(BigInt(n))
  return b
}
function i64(n: bigint | number): Buffer {
  const b = Buffer.alloc(8)
  b.writeBigInt64LE(BigInt(n))
  return b
}
function str(s: string): Buffer {
  const bytes = Buffer.from(s, 'utf8')
  const len = Buffer.alloc(4)
  len.writeUInt32LE(bytes.length)
  return Buffer.concat([len, bytes])
}

export function findDonationRecordPDA(pool: PublicKey, donor: PublicKey, nonce: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('donation'), pool.toBuffer(), donor.toBuffer(), u64(nonce)], DONATIONS_PROGRAM)
}

/** `donate(amount, nonce)` — PDA record, optional campaign account. */
export async function buildDonateIx(connection: Connection, poolId: string, donor: PublicKey, lamports: number, nonce: bigint = BigInt(Date.now())) {
  const [poolPda] = findPoolPDA(poolId)
  const [vaultPda] = findVaultPDA(poolPda)
  const [campaignPda] = findCampaignPDA(poolPda)
  const [recordPda] = findDonationRecordPDA(poolPda, donor, nonce)
  const campaignInfo = await connection.getAccountInfo(campaignPda)
  const data = Buffer.concat([await disc('donate'), u64(lamports), u64(nonce)])
  const keys = [
    { pubkey: poolPda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
    { pubkey: recordPda, isSigner: false, isWritable: true },
    // Anchor optional account: pass the program id when absent.
    { pubkey: campaignInfo ? campaignPda : DONATIONS_PROGRAM, isSigner: false, isWritable: !!campaignInfo },
    { pubkey: donor, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]
  return { ix: new TransactionInstruction({ keys, programId: DONATIONS_PROGRAM, data }), recordPda, nonce, poolPda, vaultPda }
}

/** `create_dare(nonce, target_handle, text, stake, duration_secs, target_wallet)` */
export async function buildCreateDareIx(poolId: string, creator: PublicKey, input: { targetHandle: string; text: string; stakeLamports: number; durationSecs: number; targetWallet?: PublicKey | null; nonce?: bigint }) {
  const nonce = input.nonce ?? BigInt(Date.now())
  const [poolPda] = findPoolPDA(poolId)
  const [darePda] = findDarePDA(creator, nonce)
  const [dareVault] = findDareVaultPDA(darePda)
  const option = input.targetWallet ? Buffer.concat([Buffer.from([1]), input.targetWallet.toBuffer()]) : Buffer.from([0])
  const data = Buffer.concat([await disc('create_dare'), u64(nonce), str(input.targetHandle.slice(0, 32)), str(input.text.slice(0, 200)), u64(input.stakeLamports), i64(input.durationSecs), option])
  const keys = [
    { pubkey: darePda, isSigner: false, isWritable: true },
    { pubkey: dareVault, isSigner: false, isWritable: true },
    { pubkey: poolPda, isSigner: false, isWritable: false },
    { pubkey: creator, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]
  return { ix: new TransactionInstruction({ keys, programId: DONATIONS_PROGRAM, data }), darePda, dareVault, nonce }
}

/** `boost_dare(amount)` */
export async function buildBoostDareIx(darePda: PublicKey, backer: PublicKey, lamports: number) {
  const [dareVault] = findDareVaultPDA(darePda)
  const data = Buffer.concat([await disc('boost_dare'), u64(lamports)])
  const keys = [
    { pubkey: darePda, isSigner: false, isWritable: true },
    { pubkey: dareVault, isSigner: false, isWritable: true },
    { pubkey: backer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]
  return new TransactionInstruction({ keys, programId: DONATIONS_PROGRAM, data })
}

/** v1 `one_tap_donate()` with a keypair record (kept for the classic button). */
export async function buildOneTapIx(poolId: string, donor: PublicKey, donationRecord: PublicKey) {
  const [poolPda] = findPoolPDA(poolId)
  const [vaultPda] = findVaultPDA(poolPda)
  const keys = [
    { pubkey: poolPda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
    { pubkey: donationRecord, isSigner: true, isWritable: true },
    { pubkey: donor, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]
  return new TransactionInstruction({ keys, programId: DONATIONS_PROGRAM, data: await disc('one_tap_donate') })
}
