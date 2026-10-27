/**
 * Server-held keys (never shipped to the browser):
 *  - AUTHORITY: pool/campaign authority + program upgrade authority. Creates
 *    campaigns, attests milestones, releases escrow after a vote, settles dares.
 *  - TREASURY: funds instant demo wallets on devnet, receives fees.
 *
 * Loaded from env (JSON array or base58 secret) or, for local dev, from a path.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { getConnection } from './chain'
import { DONATIONS_PROGRAM } from './pda'
import donationsIdl from '@/lib/idl/umanity_donations.json'

function loadKeypair(envValue?: string, envPath?: string, defaultPath?: string): Keypair | null {
  const tryParse = (raw: string): Keypair | null => {
    const trimmed = raw.trim()
    try {
      if (trimmed.startsWith('[')) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)))
      const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }
      return Keypair.fromSecretKey(bs58.decode(trimmed))
    } catch {
      return null
    }
  }
  if (envValue) {
    const k = tryParse(envValue)
    if (k) return k
  }
  for (const p of [envPath, defaultPath].filter(Boolean) as string[]) {
    const full = p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
    try {
      if (fs.existsSync(full)) {
        const k = tryParse(fs.readFileSync(full, 'utf8'))
        if (k) return k
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

let _authority: Keypair | null | undefined
let _treasury: Keypair | null | undefined

export function getAuthorityKeypair(): Keypair | null {
  if (_authority === undefined) {
    _authority = loadKeypair(process.env.UMANITY_AUTHORITY_KEYPAIR, process.env.UMANITY_AUTHORITY_KEYPAIR_PATH, process.env.NODE_ENV === 'production' ? undefined : '~/.config/solana/devnet.json')
  }
  return _authority
}

export function getTreasuryKeypair(): Keypair | null {
  if (_treasury === undefined) {
    _treasury = loadKeypair(process.env.UMANITY_TREASURY_KEYPAIR, process.env.UMANITY_TREASURY_KEYPAIR_PATH, process.env.NODE_ENV === 'production' ? undefined : '~/.config/solana/umanity-treasury.json') ?? getAuthorityKeypair()
  }
  return _treasury
}

export function hasAuthority(): boolean {
  return !!getAuthorityKeypair()
}

/** Minimal Anchor wallet (the bundled `anchor.Wallet` is Node-only and not exported in browser builds). */
class KeypairWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey() {
    return this.payer.publicKey
  }
  async signTransaction<T extends Transaction | import('@solana/web3.js').VersionedTransaction>(tx: T): Promise<T> {
    if ('version' in tx) (tx as import('@solana/web3.js').VersionedTransaction).sign([this.payer])
    else (tx as Transaction).partialSign(this.payer)
    return tx
  }
  async signAllTransactions<T extends Transaction | import('@solana/web3.js').VersionedTransaction>(txs: T[]): Promise<T[]> {
    for (const tx of txs) await this.signTransaction(tx)
    return txs
  }
}

/** Anchor program bound to the authority signer. */
export function getAuthorityProgram(): anchor.Program | null {
  const kp = getAuthorityKeypair()
  if (!kp) return null
  const provider = new anchor.AnchorProvider(getConnection(), new KeypairWallet(kp), { commitment: 'confirmed' })
  return new anchor.Program(donationsIdl as anchor.Idl, provider)
}

/** Send devnet SOL from the treasury to a fresh demo wallet. */
export async function fundFromTreasury(to: string, sol = 0.25): Promise<{ signature: string; lamports: number }> {
  const kp = getTreasuryKeypair()
  if (!kp) throw new Error('Treasury signer not configured')
  const conn = getConnection()
  const lamports = Math.round(sol * LAMPORTS_PER_SOL)
  const bal = await conn.getBalance(kp.publicKey)
  if (bal < lamports + 5_000_000) throw new Error('Treasury is low on devnet SOL')
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(to), lamports }))
  const signature = await sendAndConfirmTransaction(conn, tx, [kp], { commitment: 'confirmed' })
  return { signature, lamports }
}

export { DONATIONS_PROGRAM }
