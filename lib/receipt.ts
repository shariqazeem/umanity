/**
 * Signed receipts. The server signs the canonical JSON of a receipt (keys
 * sorted, no whitespace, `proof` left out) with the program authority's
 * ed25519 key; anyone can check it with that public key. Shared by the server
 * (signing) and the browser (verifying), so it has no Node imports.
 */
import nacl from 'tweetnacl'
import bs58 from 'bs58'

export interface ReceiptProof {
  alg: 'ed25519'
  /** Base58 public key of the signer (the Umanity program authority). */
  signer: string
  /** Base58 detached signature over canonical(receipt without proof). */
  signature: string
  /** What was signed, for humans: how to rebuild the message. */
  message: 'canonical-json(receipt without proof)'
}

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}

export function receiptMessage(receipt: Record<string, unknown>): Uint8Array {
  const { proof: _proof, ...rest } = receipt
  return new TextEncoder().encode(canonical(rest))
}

/** True when `receipt.proof` is a valid signature by `expectedSigner` (or by whoever it names). */
export function verifyReceipt(receipt: Record<string, unknown>, expectedSigner?: string): boolean {
  const proof = receipt.proof as ReceiptProof | undefined
  if (!proof || proof.alg !== 'ed25519') return false
  if (expectedSigner && proof.signer !== expectedSigner) return false
  try {
    return nacl.sign.detached.verify(receiptMessage(receipt), bs58.decode(proof.signature), bs58.decode(proof.signer))
  } catch {
    return false
  }
}
