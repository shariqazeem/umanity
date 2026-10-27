'use client'

/**
 * Instant demo wallet: a burner keypair generated in the browser, persisted in
 * localStorage, funded with devnet SOL by the Umanity treasury. It lets anyone
 * (judges included) sign real devnet transactions in seconds without installing
 * a wallet. It is never used on mainnet.
 */
import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'

const KEY = 'umanity.demoWallet.v1'

export interface DemoWallet {
  publicKey: PublicKey
  keypair: Keypair
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

function wrap(keypair: Keypair): DemoWallet {
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

export function loadDemoWallet(): DemoWallet | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return wrap(Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw))))
  } catch {
    return null
  }
}

export function createDemoWallet(): DemoWallet {
  const kp = Keypair.generate()
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(kp.secretKey)))
  } catch {
    /* private mode: wallet lives for this tab only */
  }
  return wrap(kp)
}

export function clearDemoWallet() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function exportDemoSecret(w: DemoWallet): string {
  return JSON.stringify(Array.from(w.keypair.secretKey))
}
