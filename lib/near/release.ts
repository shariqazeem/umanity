/**
 * A guarded release: the Solana unlock signed by the release key that only
 * the NEAR guard can use. Server-only.
 *
 * The server builds the unlock (compute budget + `unlock`, nothing else), the
 * guard checks it against its rules and has the MPC network sign it, and the
 * server adds the fee payer's signature and sends it. The payee's USDC account
 * is created first in a transaction of its own, because the guard signs
 * nothing but the unlock.
 */
import bs58 from 'bs58'
import { ComputeBudgetProgram, type Connection, type Keypair, PublicKey, Transaction, sendAndConfirmRawTransaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { IS_MAINNET } from '@/lib/solana/constants'
import { fetchConfig, fetchDrop, payeeAccountIx, unlockIx, usdcAccount } from '@/lib/umanity/program'
import { guardConfig, releaseBlocker, requestRelease } from './guard'

export type GuardRelease = { signature: string; nearTx: string }

export async function releaseThroughGuard(conn: Connection, dropId: number, payer: Keypair): Promise<GuardRelease> {
  const [drop, config, guard] = await Promise.all([fetchDrop(conn, dropId), fetchConfig(conn), guardConfig()])
  if (!drop || !config) throw new Error('No such drop')
  if (drop.state !== 'proven' || !drop.proofHash) throw new Error('This drop has no proof waiting to be released')
  if (!guard.release_key || guard.release_key !== config.releaseAuthority) throw new Error("The Solana program's release key is not the guard's")
  const blocker = await releaseBlocker(dropId, drop.proofHash)
  if (blocker) throw new Error(blocker)

  const payee = new PublicKey(drop.payee)
  if (!(await conn.getAccountInfo(usdcAccount(payee)))) {
    await sendAndConfirmTransaction(conn, new Transaction().add(payeeAccountIx(payer.publicKey, payee)), [payer], { commitment: 'confirmed' })
  }
  const releaseKey = new PublicKey(guard.release_key)
  const unlock = await unlockIx(conn, { dropId, payee, releaseAuthority: releaseKey, proofHash: Uint8Array.from(Buffer.from(drop.proofHash, 'hex')) })

  // A blockhash lives ~60–90 s; the MPC network usually signs in seconds. If it signs too late, ask again.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
    const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight })
    if (IS_MAINNET) tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }))
    tx.add(unlock)
    const { value: mpcSignature, txHash } = await requestRelease(dropId, tx.serializeMessage())
    if ((await conn.getBlockHeight('confirmed')) > lastValidBlockHeight) continue
    tx.addSignature(releaseKey, Buffer.from(bs58.decode(mpcSignature)))
    tx.partialSign(payer)
    const signature = await sendAndConfirmRawTransaction(conn, tx.serialize(), { signature: bs58.encode(tx.signature!), blockhash, lastValidBlockHeight }, { commitment: 'confirmed' })
    return { signature, nearTx: txHash }
  }
  throw new Error('The MPC signature came after the blockhash expired; try again')
}
