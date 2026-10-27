/**
 * Admin authorisation for the field team's endpoints (deliveries, media,
 * bootstrap). A request carries a wallet signature over
 * `umanity-admin:<unix seconds>`; see lib/contracts.ts for the header names.
 *
 * Admin wallets: ADMIN_WALLETS (comma separated) ∪ { org wallet, program authority }.
 */
import type { NextRequest } from 'next/server'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import { ADMIN_MESSAGE_PREFIX, ADMIN_MESSAGE_TTL_SECONDS } from '@/lib/contracts'
import { UMANITY_ORG_WALLET } from '@/lib/solana/constants'
import { getAuthorityKeypair } from '@/lib/solana/server-signer'

export function adminAddresses(): Set<string> {
  const set = new Set<string>()
  for (const a of (process.env.ADMIN_WALLETS || '').split(',')) {
    const t = a.trim()
    if (t) set.add(t)
  }
  if (UMANITY_ORG_WALLET) set.add(UMANITY_ORG_WALLET)
  const authority = getAuthorityKeypair()
  if (authority) set.add(authority.publicKey.toBase58())
  return set
}

export function isAdminAddress(address: string | null | undefined): boolean {
  return !!address && adminAddresses().has(address)
}

export interface AdminAuth {
  ok: boolean
  address?: string
  error?: string
}

/** Verifies the signed admin headers on a request. Never throws. */
export function verifyAdminRequest(req: NextRequest): AdminAuth {
  const address = req.headers.get('x-umanity-address') || ''
  const message = req.headers.get('x-umanity-message') || ''
  const signature = req.headers.get('x-umanity-signature') || ''
  if (!address || !message || !signature) return { ok: false, error: 'Missing admin signature headers' }
  if (!isAdminAddress(address)) return { ok: false, error: 'This wallet is not an admin' }
  if (!message.startsWith(ADMIN_MESSAGE_PREFIX)) return { ok: false, error: 'Malformed admin message' }
  const ts = Number(message.slice(ADMIN_MESSAGE_PREFIX.length))
  if (!Number.isFinite(ts)) return { ok: false, error: 'Malformed admin message timestamp' }
  const age = Math.floor(Date.now() / 1000) - ts
  if (age > ADMIN_MESSAGE_TTL_SECONDS || age < -60) return { ok: false, error: 'Admin signature expired; sign again' }
  try {
    const pub = new PublicKey(address).toBytes()
    const sig = bs58.decode(signature)
    const valid = nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub)
    if (!valid) return { ok: false, error: 'Invalid admin signature' }
  } catch {
    return { ok: false, error: 'Invalid admin signature' }
  }
  return { ok: true, address }
}
