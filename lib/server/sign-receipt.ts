import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { getAuthorityKeypair } from '@/lib/solana/server-signer'
import { receiptMessage, type ReceiptProof } from '@/lib/receipt'

/** Adds an ed25519 `proof` signed by the program authority. Returns the receipt unchanged if no key is configured. */
export function signReceipt<T extends Record<string, unknown>>(receipt: T): T & { proof?: ReceiptProof } {
  const kp = getAuthorityKeypair()
  if (!kp) return receipt
  const signature = nacl.sign.detached(receiptMessage(receipt), kp.secretKey)
  return { ...receipt, proof: { alg: 'ed25519', signer: kp.publicKey.toBase58(), signature: bs58.encode(signature), message: 'canonical-json(receipt without proof)' } }
}
