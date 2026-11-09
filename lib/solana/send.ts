/**
 * Lands a signed transaction on a busy cluster. One send through a free RPC
 * tier is often dropped without any error, so this sends through the main RPC
 * with preflight (a transaction that would fail is refused with its reason),
 * then rebroadcasts it through the main RPC and a public one every two seconds
 * until it confirms, fails, or its blockhash expires. Server-only.
 */
import { ComputeBudgetProgram, Connection, Transaction, type Signer, type TransactionInstruction } from '@solana/web3.js'
import { IS_MAINNET } from './constants'

/** What a server transaction pays per compute unit on mainnet: enough to land when the network is busy, still under a cent. */
export const PRIORITY_MICROLAMPORTS = 200_000

const PUBLIC_RPC = IS_MAINNET ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com'
let fallback: Connection | null = null

export type Landed = { signature: string; confirmed: boolean }

export async function sendAndLand(conn: Connection, raw: Uint8Array | Buffer, opts: { lastValidBlockHeight?: number; timeoutMs?: number } = {}): Promise<Landed> {
  fallback ??= new Connection(PUBLIC_RPC, 'confirmed')
  const signature = await conn.sendRawTransaction(raw, { preflightCommitment: 'confirmed', maxRetries: 0 })
  const until = Date.now() + (opts.timeoutMs ?? 45_000)
  while (Date.now() < until) {
    for (const c of [conn, fallback]) c.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => null)
    await new Promise((r) => setTimeout(r, 2000))
    const st = (await conn.getSignatureStatuses([signature]).catch(() => null))?.value[0]
    if (st?.err) throw new Error(`The transaction failed on-chain: ${JSON.stringify(st.err)}`)
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return { signature, confirmed: true }
    if (opts.lastValidBlockHeight && (await conn.getBlockHeight('confirmed').catch(() => 0)) > opts.lastValidBlockHeight) {
      throw new Error('The transaction expired before it landed; try again')
    }
  }
  return { signature, confirmed: false }
}

/** Builds, signs and lands instructions with a mainnet priority fee. The first signer pays. Throws unless confirmed. */
export async function signAndLand(conn: Connection, ixs: TransactionInstruction[], signers: Signer[], opts: { units?: number; timeoutMs?: number } = {}): Promise<string> {
  const tx = new Transaction()
  if (IS_MAINNET) tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: opts.units ?? 300_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }))
  tx.add(...ixs)
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  tx.feePayer = signers[0].publicKey
  tx.sign(...signers)
  const r = await sendAndLand(conn, tx.serialize(), { lastValidBlockHeight, timeoutMs: opts.timeoutMs })
  if (!r.confirmed) throw new Error(`Sent, but not confirmed yet: ${r.signature}`)
  return r.signature
}
