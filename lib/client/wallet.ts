'use client'

/**
 * The Umanity wallet: a self-custodial keypair created in the browser and kept
 * in localStorage. It lets someone start giving in one tap without installing
 * anything, and can be backed up (base58 secret) and imported into Phantom,
 * Solflare or Backpack at any time. It is a real wallet on whatever cluster the
 * app runs on; nothing about it is simulated.
 */
import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'

const KEY = 'umanity.wallet.v1'
const LEGACY_KEY = 'umanity.demoWallet.v1'

export interface LocalWallet {
  publicKey: PublicKey
  keypair: Keypair
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

function wrap(keypair: Keypair): LocalWallet {
  return {
    publicKey: keypair.publicKey,
    keypair,
    async signTransaction(tx) {
      if (tx instanceof VersionedTransaction) tx.sign([keypair])
      else tx.partialSign(keypair)
      return tx
    },
    async signAllTransactions(txs) {
      for (const tx of txs) {
        if (tx instanceof VersionedTransaction) tx.sign([keypair])
        else tx.partialSign(keypair)
      }
      return txs
    },
    async signMessage(message) {
      const nacl = await import('tweetnacl')
      return nacl.sign.detached(message, keypair.secretKey)
    },
  }
}

function persist(kp: Keypair) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(kp.secretKey)))
  } catch {
    /* private mode: the wallet lives for this tab only */
  }
}

export function loadLocalWallet(): LocalWallet | null {
  if (typeof window === 'undefined') return null
  try {
    let raw = localStorage.getItem(KEY)
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY)
      if (raw) {
        localStorage.setItem(KEY, raw)
        localStorage.removeItem(LEGACY_KEY)
      }
    }
    if (!raw) return null
    return wrap(Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw))))
  } catch {
    return null
  }
}

export function createLocalWallet(): LocalWallet {
  const kp = Keypair.generate()
  persist(kp)
  return wrap(kp)
}

/** Accepts a base58 secret key (Phantom export) or a JSON byte array (Solana CLI). */
export function importLocalWallet(secret: string): LocalWallet {
  const s = secret.trim()
  let bytes: Uint8Array
  if (s.startsWith('[')) bytes = Uint8Array.from(JSON.parse(s))
  else bytes = bs58.decode(s)
  if (bytes.length !== 64) throw new Error('That does not look like a Solana secret key')
  const kp = Keypair.fromSecretKey(bytes)
  persist(kp)
  return wrap(kp)
}

export function forgetLocalWallet() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}

export function exportSecretBase58(w: LocalWallet): string {
  return bs58.encode(w.keypair.secretKey)
}

export function exportSecretJson(w: LocalWallet): string {
  return JSON.stringify(Array.from(w.keypair.secretKey))
}
