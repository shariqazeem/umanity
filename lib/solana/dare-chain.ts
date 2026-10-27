import { PublicKey } from '@solana/web3.js'
import { getConnection } from './chain'
import { DONATIONS_PROGRAM } from './pda'

export interface OnChainDare {
  address: string
  creator: string
  pool: string
  targetWallet: string | null
  targetHandle: string
  text: string
  stake: number
  pot: number
  backerCount: number
  deadline: number
  status: number
  createdAt: number
  settledAt: number
}

function readString(buf: Buffer, o: number): [string, number] {
  const len = buf.readUInt32LE(o)
  return [buf.subarray(o + 4, o + 4 + len).toString('utf8'), o + 4 + len]
}

/** Decodes a Dare account (Anchor Borsh layout, see programs/risen-donations). */
export function decodeDare(address: string, data: Buffer): OnChainDare {
  let o = 8
  const creator = new PublicKey(data.subarray(o, o + 32)).toBase58()
  o += 32
  const pool = new PublicKey(data.subarray(o, o + 32)).toBase58()
  o += 32
  const hasTarget = data.readUInt8(o) === 1
  o += 1
  let targetWallet: string | null = null
  if (hasTarget) {
    targetWallet = new PublicKey(data.subarray(o, o + 32)).toBase58()
    o += 32
  }
  let targetHandle: string, text: string
  ;[targetHandle, o] = readString(data, o)
  ;[text, o] = readString(data, o)
  const stake = Number(data.readBigUInt64LE(o))
  o += 8
  const pot = Number(data.readBigUInt64LE(o))
  o += 8
  const backerCount = data.readUInt32LE(o)
  o += 4
  const deadline = Number(data.readBigInt64LE(o))
  o += 8
  const status = data.readUInt8(o)
  o += 1
  const createdAt = Number(data.readBigInt64LE(o))
  o += 8
  const settledAt = Number(data.readBigInt64LE(o))
  return { address, creator, pool, targetWallet, targetHandle, text, stake, pot, backerCount, deadline, status, createdAt, settledAt }
}

export async function readDare(darePda: string): Promise<OnChainDare | null> {
  const conn = getConnection()
  const info = await conn.getAccountInfo(new PublicKey(darePda), 'confirmed')
  if (!info || !info.owner.equals(DONATIONS_PROGRAM)) return null
  return decodeDare(darePda, info.data as Buffer)
}

/** Verifies a create_dare transaction landed and returns the on-chain dare state. */
export async function verifyDareCreateTx(signature: string, darePda: string, creator: string): Promise<OnChainDare | null> {
  const conn = getConnection()
  for (let i = 0; i < 6; i++) {
    const tx = await conn.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
    if (tx && !tx.meta?.err) {
      const dare = await readDare(darePda)
      if (dare && dare.creator === creator) return dare
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  return null
}
